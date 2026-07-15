## 网络管理器（Autoload 单例）
##
## 统一管理所有网络生命周期：局域网/跨地区连接、心跳、断线重连、主机迁移。
## 所有网络状态变更通过信号通知 UI 层。
extends Node

# ── 枚举 ──

enum NetworkMode { LAN, INTERNET }
enum PlayerRole { HOST, CLIENT, OFFLINE }
enum ConnectionQuality { GOOD, FAIR, POOR, CRITICAL }
enum ConnectionState { DISCONNECTED, CONNECTING, CONNECTED, RECONNECTING }

# ── 信号 ──

## 连接建立成功
signal connection_established(mode: NetworkMode, role: PlayerRole)
## 连接丢失（reason: 断开原因描述）
signal connection_lost(reason: String)
## 连接恢复（重连成功）
signal connection_restored()
## 新玩家加入（peer_id, 玩家昵称）
signal player_joined(peer_id: int, player_name: String)
## 玩家离开
signal player_left(peer_id: int)
## 主机迁移完成（新主机的 peer_id）
signal host_migrated(new_host_id: int)
## 连接质量变化
signal quality_changed(quality: ConnectionQuality, latency_ms: int)
## 连接状态变化
signal state_changed(state: ConnectionState)
## 收到聊天消息
signal chat_received(sender_name: String, message: String)
## 大厅状态更新
signal lobby_updated()

# ── 状态变量 ──

var mode: NetworkMode = NetworkMode.OFFLINE
var role: PlayerRole = PlayerRole.OFFLINE
var room_code: String = ""
var check_digit: int = -1
var peer_id: int = 1
var connection_type: String = "none"  ## "p2p_direct" / "turn_relay" / "lan" / "none"
var connection_state: ConnectionState = ConnectionState.DISCONNECTED
var average_latency: int = 0

## 已连接玩家信息 {peer_id: {name, color, farm_name, latency, is_ready}}
var connected_players: Dictionary = {}

## 玩家昵称（本地设置）
var local_player_name: String = "农场主"
## 玩家农场名称
var local_farm_name: String = "青溪农场"
## 玩家颜色索引（0-11，对应12种预设颜色）
var local_color_index: int = 0

# ── 预设颜色（12色）──
const PLAYER_COLORS: Array[Color] = [
	Color("#4A90D9"), Color("#E74C3C"), Color("#2ECC71"), Color("#F1C40F"),
	Color("#9B59B6"), Color("#E67E22"), Color("#1ABC9C"), Color("#FF69B4"),
	Color("#95A5A6"), Color("#8B4513"), Color("#ECF0F1"), Color("#2C3E50"),
]

# ── 心跳 ──
var _heartbeat_timer: Timer
var _last_heartbeat_received: float = 0.0
var _heartbeat_miss_count: int = 0

# ── 重连 ──
var _is_reconnecting: bool = false
var _reconnect_attempts: int = 0

func _ready() -> void:
	# 心跳定时器
	_heartbeat_timer = Timer.new()
	_heartbeat_timer.wait_time = NetworkConfig.HEARTBEAT_INTERVAL
	_heartbeat_timer.one_shot = false
	_heartbeat_timer.timeout.connect(_on_heartbeat_tick)
	add_child(_heartbeat_timer)
	# 默认不启动，连接建立后才启动
	_heartbeat_timer.stop()

func _process(delta: float) -> void:
	if connection_state == ConnectionState.CONNECTED:
		_last_heartbeat_received += delta
		if _last_heartbeat_received > NetworkConfig.HEARTBEAT_TIMEOUT:
			_on_connection_timeout()

# ── 房间码工具 ──

## 生成4位房间码 + 校验位，返回 {code, check_digit}
func generate_room_code() -> Dictionary:
	var code := str(randi() % 10000).pad_zeros(4)
	var cd := NetworkConfig.compute_check_digit(code)
	return {"code": code, "check_digit": cd}

## 格式化房间码显示（如 "3847-9"）
func format_room_code(code: String, cd: int) -> String:
	return "%s-%d" % [code, cd]

# ── 连接状态管理 ──

func _set_state(new_state: ConnectionState) -> void:
	if connection_state != new_state:
		connection_state = new_state
		state_changed.emit(new_state)

# ── 心跳处理 ──

func _on_heartbeat_tick() -> void:
	if role == PlayerRole.HOST:
		rpc("_heartbeat_response", Time.get_ticks_msec())

@rpc("any_peer", "unreliable")
func _heartbeat_response(server_time: int) -> void:
	_last_heartbeat_received = 0.0
	_heartbeat_miss_count = 0
	var rtt := Time.get_ticks_msec() - server_time
	if rtt < 0:
		rtt = 0
	average_latency = int(lerp(float(average_latency), float(rtt), 0.3))

# ── 断线检测 ──

func _on_connection_timeout() -> void:
	_heartbeat_miss_count += 1
	if _heartbeat_miss_count >= 3:
		_set_state(ConnectionState.RECONNECTING)
		_is_reconnecting = true
		connection_lost.emit("心跳超时（%d秒无响应）" % int(NetworkConfig.HEARTBEAT_TIMEOUT))
		_attempt_reconnect()

# ── 断线重连 ──

func _attempt_reconnect() -> void:
	_reconnect_attempts = 0
	while _reconnect_attempts < NetworkConfig.MAX_RECONNECT_ATTEMPTS:
		_reconnect_attempts += 1
		print("[网络] 重连尝试 %d/%d..." % [_reconnect_attempts, NetworkConfig.MAX_RECONNECT_ATTEMPTS])
		# 尝试直接重连
		var err := _try_reconnect()
		if err == OK:
			_on_reconnect_success()
			return
		await get_tree().create_timer(NetworkConfig.RECONNECT_DELAY).timeout
	_on_reconnect_failed()

func _try_reconnect() -> Error:
	# 实际重连逻辑将在后续实现中填充
	# 局域网模式：重新 ENet 连接
	# 跨地区模式：重新信令握手
	return ERR_CANT_CONNECT

func _on_reconnect_success() -> void:
	_is_reconnecting = false
	_reconnect_attempts = 0
	_heartbeat_miss_count = 0
	_last_heartbeat_received = 0.0
	_set_state(ConnectionState.CONNECTED)
	connection_restored.emit()
	print("[网络] 重连成功")

func _on_reconnect_failed() -> void:
	_is_reconnecting = false
	_set_state(ConnectionState.DISCONNECTED)
	print("[网络] 重连失败")

# ── 断开连接 ──

func disconnect_from_game() -> void:
	_heartbeat_timer.stop()
	_set_state(ConnectionState.DISCONNECTED)
	_is_reconnecting = false
	_reconnect_attempts = 0
	connected_players.clear()
	average_latency = 0
	connection_type = "none"
	mode = NetworkMode.OFFLINE
	role = PlayerRole.OFFLINE
	if multiplayer.has_multiplayer_peer():
		multiplayer.multiplayer_peer = null
	print("[网络] 已断开连接")

# ── 玩家管理 ──

func get_player_name(pid: int) -> String:
	if connected_players.has(pid):
		return connected_players[pid].get("name", "未知")
	return "未知"

func get_player_color(pid: int) -> Color:
	if connected_players.has(pid):
		var idx: int = connected_players[pid].get("color_index", 0)
		return PLAYER_COLORS[idx % PLAYER_COLORS.size()]
	return PLAYER_COLORS[0]

func get_all_ready() -> bool:
	for pid in connected_players:
		if not connected_players[pid].get("is_ready", false):
			return false
	return true
