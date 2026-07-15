## 背包物品同步
##
## 同步物品变化：添加/移除/使用/交易。
## 使用 @rpc 可靠传输，主机端验证后广播。
extends Node
class_name InventorySync

## 所有玩家的背包数据（仅在主机端维护）{player_id: [{item_id, amount, quality}, ...]}
var _inventories: Dictionary = {}

## 获取玩家背包
func get_inventory(player_id: int) -> Array:
	return _inventories.get(player_id, [])

## 从快照恢复
func restore_from_snapshot(data: Dictionary) -> void:
	_inventories = data

## 获取所有背包快照
func get_all_snapshot() -> Dictionary:
	return _inventories

## 添加物品（主机端验证并广播）
func add_item(player_id: int, item_id: String, amount: int, quality: String = "normal") -> void:
	if not InputValidator.validate_item_operation(item_id, amount):
		return
	if not _inventories.has(player_id):
		_inventories[player_id] = []
	# 更新主机端数据
	_inventories[player_id].append({"item_id": item_id, "amount": amount, "quality": quality})
	# 广播给所有客户端
	_broadcast_item_change.rpc(player_id, item_id, amount, "add", quality)

## 移除物品
func remove_item(player_id: int, item_id: String, amount: int) -> bool:
	if not _inventories.has(player_id):
		return false
	# 主机端验证并更新
	_broadcast_item_change.rpc(player_id, item_id, amount, "remove", "")
	return true

## 广播物品变化
@rpc("authority", "reliable")
func _broadcast_item_change(player_id: int, item_id: String, amount: int, action: String, quality: String) -> void:
	# 客户端更新本地背包
	# 实际渲染由各客户端UI处理
	pass