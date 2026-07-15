## RPC 处理器集合
##
## 所有联机 RPC 调用的统一入口，按系统分组。
## 主机端运行，接收客户端请求 → 验证 → 执行 → 广播结果。
extends Node
class_name RpcHandlers

var _rate_limiter: RateLimiter

func _ready() -> void:
	_rate_limiter = RateLimiter.new()

# ── 玩家操作 ──

## 玩家移动请求
@rpc("any_peer", "unreliable")
func player_move(position: Vector2, direction: Vector2) -> void:
	var sender_id := multiplayer.get_remote_sender_id()
	if not _rate_limiter.check_rate(sender_id, "player_move"):
		return
	if not InputValidator.validate_position(position.x, position.y):
		return
	# 广播给其他客户端
	_broadcast_player_move.rpc(sender_id, position, direction)

## 玩家使用工具
@rpc("any_peer", "reliable")
func player_use_tool(tile_x: int, tile_y: int, tool: String) -> void:
	var sender_id := multiplayer.get_remote_sender_id()
	if not _rate_limiter.check_rate(sender_id, "tool_use"):
		return
	if not InputValidator.validate_farming_action(tile_x, tile_y, tool):
		return
	_broadcast_tool_use.rpc(sender_id, tile_x, tile_y, tool)

# ── 广播方法 ──

@rpc("authority", "unreliable")
func _broadcast_player_move(player_id: int, pos: Vector2, dir: Vector2) -> void:
	pass  # 各客户端自行处理渲染

@rpc("authority", "reliable")
func _broadcast_tool_use(player_id: int, x: int, y: int, tool: String) -> void:
	pass  # 各客户端播放工具动画

# ── 聊天 ──

@rpc("any_peer", "reliable")
func send_chat_message(message: String) -> void:
	var sender_id := multiplayer.get_remote_sender_id()
	if not InputValidator.validate_chat_message(message):
		return
	if not _rate_limiter.check_rate(sender_id, "chat_message"):
		return
	var sender_name := NetworkManager.get_player_name(sender_id)
	NetworkManager.chat_received.emit(sender_name, message)

# ── 系统 ──

## 请求完整状态快照（重连后调用）
@rpc("any_peer", "reliable")
func request_full_snapshot() -> void:
	var sender_id := multiplayer.get_remote_sender_id()
	# 主机生成快照并发送给请求者
	_send_snapshot_to.rpc_id(sender_id, {})

@rpc("authority", "reliable")
func _send_snapshot_to(snapshot: Dictionary) -> void:
	pass  # 客户端应用快照