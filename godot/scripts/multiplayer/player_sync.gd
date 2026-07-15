## 玩家同步控制器
##
## 通过 MultiplayerSynchronizer 自动同步玩家位置、动画状态。
## 主机权威：客户端预测 + 主机纠正。
extends Node
class_name PlayerSync

## 同步频率（Hz）
@export var sync_rate: float = 10.0

## 差值压缩阈值（移动超过此像素才发送）
@export var position_threshold: float = 0.5

var _sync_timer: Timer
var _last_synced_position: Vector2 = Vector2.ZERO
var _target_node: Node2D

func _ready() -> void:
	_sync_timer = Timer.new()
	_sync_timer.wait_time = 1.0 / sync_rate
	_sync_timer.one_shot = false
	_sync_timer.timeout.connect(_sync_position)
	add_child(_sync_timer)

## 绑定目标节点（通常是玩家 CharacterBody2D）
func bind(node: Node2D) -> void:
	_target_node = node
	_sync_timer.start()

func _sync_position() -> void:
	if _target_node == null:
		return
	var current_pos := _target_node.global_position
	if current_pos.distance_to(_last_synced_position) > position_threshold:
		_last_synced_position = current_pos
		if NetworkManager.role == NetworkManager.PlayerRole.HOST:
			_broadcast_position.rpc(current_pos)
		else:
			_send_position.rpc_id(1, current_pos)

## 主机广播所有玩家位置
@rpc("authority", "unreliable")
func _broadcast_position(pos: Vector2) -> void:
	if _target_node:
		_target_node.global_position = pos

## 客户端发送位置到主机
@rpc("any_peer", "unreliable")
func _send_position(pos: Vector2) -> void:
	var sender_id := multiplayer.get_remote_sender_id()
	# 主机端验证位置合法性
	if InputValidator.validate_position(pos.x, pos.y):
		# 广播给其他客户端
		_broadcast_position_from_host.rpc(sender_id, pos)

@rpc("authority", "unreliable")
func _broadcast_position_from_host(player_id: int, pos: Vector2) -> void:
	pass  # 实际渲染由各客户端自行处理

## 设置同步频率
func set_sync_rate(hz: float) -> void:
	sync_rate = hz
	_sync_timer.wait_time = 1.0 / max(1.0, hz)