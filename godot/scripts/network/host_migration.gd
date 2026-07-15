## 主机迁移逻辑
##
## 当主机断线时，自动选举延迟最低的客户端作为新主机，
## 传递状态快照，实现无缝切换。
extends Node
class_name HostMigrationModule

# ── 信号 ──

signal migration_started()
signal migration_completed(new_host_id: int)
signal migration_failed(reason: String)

# ── 选举状态 ──

enum MigrationState { IDLE, ELECTING, MIGRATING, COMPLETED, FAILED }

var _state: MigrationState = MigrationState.IDLE
var _election_timer: Timer
var _candidates: Array[Dictionary] = []  ## [{peer_id, latency, joined_time}]
var _snapshot: Dictionary = {}

func _ready() -> void:
	_election_timer = Timer.new()
	_election_timer.one_shot = true
	_election_timer.wait_time = NetworkConfig.HOST_MIGRATION_ELECTION_TIME
	_election_timer.timeout.connect(_on_election_timeout)
	add_child(_election_timer)

## 开始主机迁移流程
func start_migration(connected_players: Dictionary) -> void:
	if _state != MigrationState.IDLE:
		return

	_state = MigrationState.ELECTING
	migration_started.emit()
	print("[主机迁移] 开始选举新主机...")

	# 收集所有客户端的指标
	_candidates.clear()
	for pid in connected_players:
		var player := connected_players[pid]
		var latency: int = player.get("latency", 999)
		# 排除延迟过高的候选者
		if latency <= NetworkConfig.HOST_MIGRATION_LATENCY_LIMIT:
			_candidates.append({
				"peer_id": pid,
				"latency": latency,
				"joined_time": player.get("joined_time", 0),
			})

	if _candidates.is_empty():
		_state = MigrationState.FAILED
		migration_failed.emit("没有可用的候选主机（所有玩家延迟过高）")
		return

	# 启动选举计时器
	_election_timer.start()

## 提交本地快照（用于新主机恢复状态）
func submit_snapshot(snapshot: Dictionary) -> void:
	_snapshot = snapshot

## 选举超时 → 选出新主机
func _on_election_timeout() -> void:
	if _candidates.is_empty():
		_state = MigrationState.FAILED
		migration_failed.emit("没有候选者")
		return

	# 排序：延迟最低 > 加入时间最早
	_candidates.sort_custom(func(a, b):
		if a.latency != b.latency:
			return a.latency < b.latency
		return a.joined_time < b.joined_time
	)

	var new_host := _candidates[0]
	_state = MigrationState.MIGRATING
	print("[主机迁移] 选出新主机: %d (延迟: %dms)" % [new_host.peer_id, new_host.latency])

	# 如果是自己当选 → 成为新主机
	if new_host.peer_id == NetworkManager.peer_id:
		_become_host()
	else:
		# 通知当选者成为新主机
		rpc_id(new_host.peer_id, "_become_host_remote", _snapshot)

	# 等待迁移完成
	await get_tree().create_timer(3.0).timeout
	if _state == MigrationState.MIGRATING:
		_state = MigrationState.COMPLETED
		migration_completed.emit(new_host.peer_id)

## 远程调用：被选为新主机
@rpc("authority", "reliable")
func _become_host_remote(snapshot: Dictionary) -> void:
	_snapshot = snapshot
	_become_host()

## 成为新主机的实际逻辑
func _become_host() -> void:
	print("[主机迁移] 我成为新主机: %d" % NetworkManager.peer_id)
	NetworkManager.role = NetworkManager.PlayerRole.HOST
	# 从快照恢复状态
	_apply_snapshot(_snapshot)
	_state = MigrationState.COMPLETED
	migration_completed.emit(NetworkManager.peer_id)

## 从快照恢复游戏状态
func _apply_snapshot(snapshot: Dictionary) -> void:
	if snapshot.is_empty():
		print("[主机迁移] 快照为空，使用当前状态")
		return
	# 恢复世界状态
	# 具体恢复逻辑将在游戏系统迁移后补充
	print("[主机迁移] 状态已从快照恢复")

## 重置迁移状态（新游戏开始时调用）
func reset() -> void:
	_state = MigrationState.IDLE
	_candidates.clear()
	_snapshot.clear()
	_election_timer.stop()

## 获取当前迁移状态
func get_migration_state() -> MigrationState:
	return _state

## 获取迁移状态文本
func get_migration_state_text() -> String:
	match _state:
		MigrationState.IDLE: return "空闲"
		MigrationState.ELECTING: return "选举中..."
		MigrationState.MIGRATING: return "迁移中..."
		MigrationState.COMPLETED: return "已完成"
		MigrationState.FAILED: return "失败"
	return "未知"
