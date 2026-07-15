## 快照管理器
##
## 定期生成游戏状态快照，用于断线重连和主机迁移。
## 快照包含：世界状态、所有玩家状态、地块状态、NPC状态。
extends Node
class_name SnapshotManager

## 快照发送间隔（秒）
@export var snapshot_interval: float = 60.0

## 上一个快照数据
var _last_snapshot: Dictionary = {}
var _snapshot_timer: Timer

func _ready() -> void:
	_snapshot_timer = Timer.new()
	_snapshot_timer.wait_time = snapshot_interval
	_snapshot_timer.one_shot = false
	_snapshot_timer.timeout.connect(_create_and_broadcast)
	add_child(_snapshot_timer)

## 开始定期快照（主机端调用）
func start(interval: float = -1.0) -> void:
	if interval > 0:
		snapshot_interval = interval
		_snapshot_timer.wait_time = interval
	_snapshot_timer.start()

## 停止快照
func stop() -> void:
	_snapshot_timer.stop()

## 创建并广播快照
func _create_and_broadcast() -> void:
	if NetworkManager.role != NetworkManager.PlayerRole.HOST:
		return
	var snapshot := create_snapshot()
	_last_snapshot = snapshot
	_broadcast_snapshot.rpc(snapshot)

## 创建当前状态快照
func create_snapshot() -> Dictionary:
	return {
		"game_time": 0,  # TODO: 接入 TimeSystem
		"season": "spring",
		"day": 1,
		"farm_plots": [],  # TODO: FarmSync.get_all_plots()
		"players": [],  # TODO: 所有玩家状态
		"timestamp": Time.get_ticks_msec(),
	}

## 请求主机发送快照（客户端重连后调用）
func request_snapshot() -> void:
	if NetworkManager.role == NetworkManager.PlayerRole.CLIENT:
		_request_snapshot_rpc.rpc_id(1)

## 应用快照到本地状态
func apply_snapshot(snapshot: Dictionary) -> void:
	_last_snapshot = snapshot
	# 恢复世界状态
	# 实际恢复逻辑在游戏系统迁移后补充

## 获取上一个快照
func get_last_snapshot() -> Dictionary:
	return _last_snapshot

@rpc("authority", "reliable")
func _broadcast_snapshot(snapshot: Dictionary) -> void:
	apply_snapshot(snapshot)

@rpc("authority", "reliable")
func _request_snapshot_rpc() -> void:
	var snapshot := create_snapshot()
	_send_snapshot_to.rpc(multiplayer.get_remote_sender_id(), snapshot)

@rpc("authority", "reliable")
func _send_snapshot_to(snapshot: Dictionary) -> void:
	apply_snapshot(snapshot)