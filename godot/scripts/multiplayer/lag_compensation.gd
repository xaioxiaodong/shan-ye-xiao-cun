## 延迟补偿与客户端预测
##
## 客户端预测：本地立即执行操作 → 发送到主机验证 → 接收权威状态 → 校正（如有冲突）。
## 平滑插值：其他玩家位置使用 LERP 插值，避免跳帧。
extends Node
class_name LagCompensation

## 插值系数（0.05-0.3，越小越平滑但延迟感越强）
@export var interpolation_factor: float = 0.1

## 客户端预测的待确认操作队列
var _pending_actions: Array[Dictionary] = []

## 其他玩家的插值目标位置 {player_id: {prev_pos, target_pos, timestamp}}
var _interpolation_targets: Dictionary = {}

## 客户端预测：本地执行操作
func predict_action(action_type: String, data: Dictionary) -> Dictionary:
	# 生成一个操作ID用于追踪
	var action_id := str(randi() % 0xFFFFFFFF)
	_pending_actions.append({
		"id": action_id,
		"type": action_type,
		"data": data,
		"timestamp": Time.get_ticks_msec(),
	})
	return {"action_id": action_id, "status": "predicted"}

## 收到主机确认后，匹配并移除预测操作
func confirm_action(action_id: String) -> void:
	for i in range(_pending_actions.size() - 1, -1, -1):
		if _pending_actions[i].id == action_id:
			_pending_actions.remove_at(i)
			return

## 冲突检测：主机返回的权威状态与本地预测不一致时
func correct_state(correct_data: Dictionary) -> void:
	# 丢弃所有冲突操作
	_pending_actions.clear()
	# 应用权威状态
	# 具体校正逻辑由各系统实现

## 设置其他玩家的插值目标
func set_interpolation_target(player_id: int, target_pos: Vector2) -> void:
	if not _interpolation_targets.has(player_id):
		_interpolation_targets[player_id] = {"prev_pos": target_pos, "target_pos": target_pos, "timestamp": Time.get_ticks_msec()}
	var entry := _interpolation_targets[player_id]
	entry.prev_pos = entry.target_pos
	entry.target_pos = target_pos
	entry.timestamp = Time.get_ticks_msec()

## 获取插值后的位置
func get_interpolated_position(player_id: int) -> Vector2:
	if not _interpolation_targets.has(player_id):
		return Vector2.ZERO
	var entry := _interpolation_targets[player_id]
	var elapsed := (Time.get_ticks_msec() - entry.timestamp) / 1000.0
	var t := clamp(elapsed * interpolation_factor * 10.0, 0.0, 1.0)
	return entry.prev_pos.lerp(entry.target_pos, t)

## 清理离线玩家的插值数据
func remove_player(player_id: int) -> void:
	_interpolation_targets.erase(player_id)