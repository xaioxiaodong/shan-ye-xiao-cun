## RPC输入校验器
##
## 所有从客户端收到的RPC调用必须经过此类验证后才允许执行。
## 主机端运行，防止客户端篡改数据或发送非法操作。
class_name InputValidator
extends RefCounted

# ── 耕种操作校验 ──

## 验证耕种动作（坐标+工具合法性）
static func validate_farming_action(tile_x: int, tile_y: int, tool: String) -> bool:
	if tile_x < 0 or tile_x > 59 or tile_y < 0 or tile_y > 49:
		return false
	if tool not in ["hoe", "watering_can", "seed", "pickaxe", "axe", "scythe"]:
		return false
	return true

## 验证播种操作（额外检查作物ID和季节）
static func validate_planting(tile_x: int, tile_y: int, seed_id: String, current_season: String) -> bool:
	if not validate_farming_action(tile_x, tile_y, "seed"):
		return false
	if not is_valid_id(seed_id):
		return false
	# 季节检查由 DataRegistry 在运行时验证
	return true

# ── 物品操作校验 ──

## 验证物品ID格式
static func validate_item_id(item_id: String) -> bool:
	return is_valid_id(item_id)

## 验证物品数量范围
static func validate_item_amount(amount: int) -> bool:
	return amount >= 0 and amount <= 999

## 验证背包操作
static func validate_item_operation(item_id: String, amount: int) -> bool:
	if not validate_item_id(item_id):
		return false
	if not validate_item_amount(amount):
		return false
	return true

# ── 聊天消息校验 ──

## 验证聊天消息
static func validate_chat_message(message: String) -> bool:
	if message.length() > 200:
		return false
	if message.strip_edges().is_empty():
		return false
	return true

# ── 玩家移动校验 ──

## 验证玩家位置（防止传送外挂）
static func validate_position(x: float, y: float, map_width: int = 60, map_height: int = 50) -> bool:
	var tile_size := 16.0
	if x < 0 or x > map_width * tile_size or y < 0 or y > map_height * tile_size:
		return false
	return true

## 验证移动速度（防止加速外挂，HARD_LIMIT: 8 tile/s）
static func validate_move_speed(current_pos: Vector2, new_pos: Vector2, delta: float) -> bool:
	var distance := current_pos.distance_to(new_pos)
	var max_distance := 8.0 * 16.0 * delta  # 8 tile/s * 16px/tile * delta
	return distance <= max_distance * 1.2  # 留20%余量

# ── 通用校验 ──

## 验证字符串ID格式（仅允许小写字母、数字、下划线）
static func is_valid_id(value: String) -> bool:
	if value.is_empty():
		return false
	for ch in value:
		if not (ch >= 'a' and ch <= 'z') and not (ch >= '0' and ch <= '9') and ch != '_':
			return false
	return value.length() <= 50

## 验证房间码格式
static func validate_room_code(code: String) -> bool:
	if code.length() != 4:
		return false
	for ch in code:
		if ch < '0' or ch > '9':
			return false
	return true

## 验证玩家昵称
static func validate_player_name(name: String) -> bool:
	if name.length() < 2 or name.length() > 8:
		return false
	# 允许中文、英文、数字
	return not name.strip_edges().is_empty()

## 验证金钱变动（防经济外挂）
static func validate_money_change(amount: int, current_money: int) -> bool:
	# 单次变动不能超过合理范围
	if abs(amount) > 100000:
		return false
	# 金钱不能为负
	if current_money + amount < 0:
		return false
	return true