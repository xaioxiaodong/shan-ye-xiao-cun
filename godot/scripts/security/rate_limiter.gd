## 操作频率限制器
##
## 防止客户端快速重复操作（连点、异常高频操作）。
## 每种操作类型有独立的频率上限，超过则拒绝并记录日志。
class_name RateLimiter
extends RefCounted

## 每种操作每秒最大次数
const MAX_ACTIONS_PER_SECOND := {
	"tool_use": 5,
	"item_pickup": 10,
	"chat_message": 3,
	"npc_interact": 2,
	"trade_request": 2,
	"plant_seed": 5,
	"harvest": 5,
	"player_move": 20,
}

## 默认上限（未定义的操作类型使用此值）
const DEFAULT_MAX: int = 5

## 操作历史 {player_id: [{action, timestamp_ms}]}
var _action_history: Dictionary = {}

## 检查是否允许该操作
## 返回 true 表示允许，false 表示超频
func check_rate(player_id: int, action_type: String) -> bool:
	var now := Time.get_ticks_msec()
	if not _action_history.has(player_id):
		_action_history[player_id] = []

	var history: Array = _action_history[player_id]

	# 清理1秒前的旧记录
	var cutoff := now - 1000
	history = history.filter(func(entry): return entry.timestamp >= cutoff)

	# 统计同类型操作
	var recent_count := 0
	for entry in history:
		if entry.action == action_type:
			recent_count += 1

	var max_allowed := MAX_ACTIONS_PER_SECOND.get(action_type, DEFAULT_MAX)
	if recent_count >= max_allowed:
		return false

	# 记录本次操作
	history.append({"action": action_type, "timestamp": now})
	_action_history[player_id] = history
	return true

## 重置指定玩家的所有限制
func reset_player(player_id: int) -> void:
	_action_history.erase(player_id)

## 清理所有记录（场景切换时调用）
func clear_all() -> void:
	_action_history.clear()

## 获取玩家当前频率（调试用）
func get_player_rate(player_id: int, action_type: String) -> int:
	if not _action_history.has(player_id):
		return 0
	var cutoff := Time.get_ticks_msec() - 1000
	var count := 0
	for entry in _action_history[player_id]:
		if entry.action == action_type and entry.timestamp >= cutoff:
			count += 1
	return count