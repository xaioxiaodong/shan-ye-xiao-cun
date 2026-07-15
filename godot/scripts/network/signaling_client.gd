## 信令服务器 WebSocket 客户端
##
## 负责与信令服务器通信：创建房间、加入房间、SDP/ICE转发。
## 连接建立后可断开信令连接（游戏流量完全走P2P）。
extends Node
class_name SignalingClientModule

# ── 信号 ──

signal connected()
signal disconnected()
signal room_created(room_code: String, check_digit: int)
signal room_joined(room_code: String, check_digit: int)
signal sdp_received(from_role: String, sdp_data: Dictionary)
signal ice_received(from_role: String, candidate: String)
signal peer_disconnected(reason: String)
signal error_occurred(message: String)

# ── 内部状态 ──

var _ws: WebSocketPeer
var _connected: bool = false
var _heartbeat_timer: Timer
var _reconnect_timer: Timer

func _ready() -> void:
	_heartbeat_timer = Timer.new()
	_heartbeat_timer.wait_time = NetworkConfig.SIGNALING_HEARTBEAT_INTERVAL
	_heartbeat_timer.one_shot = false
	_heartbeat_timer.timeout.connect(_send_heartbeat)
	add_child(_heartbeat_timer)

func _process(_delta: float) -> void:
	if _ws:
		_ws.poll()
		var state := _ws.get_ready_state()
		if state == WebSocketPeer.STATE_OPEN:
			while _ws.get_available_packet_count() > 0:
				var data := _ws.get_packet().get_string_from_utf8()
				_handle_message(data)
		elif state == WebSocketPeer.STATE_CLOSED:
			if _connected:
				_connected = false
				_heartbeat_timer.stop()
				disconnected.emit()
				print("[信令] 连接已关闭")

# ── 连接管理 ──

## 连接到信令服务器
func connect_to_server(url: String = "") -> void:
	if url.is_empty():
		url = NetworkConfig.SIGNALING_URL

	if _ws and _ws.get_ready_state() == WebSocketPeer.STATE_OPEN:
		print("[信令] 已连接，跳过")
		return

	_ws = WebSocketPeer.new()
	var err := _ws.connect_to_url(url)
	if err != OK:
		error_occurred.emit("无法连接信令服务器: %s" % error_string(err))
		return

	# 等待连接建立
	var timeout := 0.0
	while timeout < NetworkConfig.CONNECTION_TIMEOUT:
		_ws.poll()
		if _ws.get_ready_state() == WebSocketPeer.STATE_OPEN:
			_connected = true
			_heartbeat_timer.start()
			connected.emit()
			print("[信令] 已连接到 %s" % url)
			return
		elif _ws.get_ready_state() == WebSocketPeer.STATE_CLOSED:
			error_occurred.emit("信令服务器连接被关闭")
			return
		await get_tree().process_frame
		timeout += get_process_delta_time()

	error_occurred.emit("信令服务器连接超时")

## 断开信令连接
func disconnect_from_server() -> void:
	_heartbeat_timer.stop()
	if _ws:
		_ws.close()
		_ws = null
	_connected = false

## 是否已连接
func is_connected_to_server() -> bool:
	return _connected

# ── 发送消息 ──

## 请求创建房间
func send_create_room() -> void:
	_send({"type": "create_room"})

## 请求加入房间
func send_join_room(room_code: String) -> void:
	_send({"type": "join_room", "roomCode": room_code})

## 发送 SDP 信息
func send_sdp(sdp_data: Dictionary) -> void:
	_send({"type": "sdp", "sdp": sdp_data})

## 发送 ICE 候选
func send_ice(candidate: String) -> void:
	_send({"type": "ice", "candidate": candidate})

## 离开房间
func send_leave_room() -> void:
	_send({"type": "leave_room"})

## 发送心跳
func _send_heartbeat() -> void:
	_send({"type": "heartbeat"})

func _send(data: Dictionary) -> void:
	if _ws and _ws.get_ready_state() == WebSocketPeer.STATE_OPEN:
		_ws.send_text(JSON.stringify(data))
	else:
		print("[信令] 发送失败：未连接")

# ── 消息处理 ──

func _handle_message(raw: String) -> void:
	var msg = JSON.parse_string(raw)
	if not msg or not msg.has("type"):
		print("[信令] 无效消息: ", raw.left(100))
		return

	match msg.type:
		"room_created":
			room_created.emit(msg.roomCode, msg.checkDigit)
			print("[信令] 房间已创建: %s-%d" % [msg.roomCode, msg.checkDigit])

		"room_joined":
			room_joined.emit(msg.roomCode, msg.get("checkDigit", 0))
			print("[信令] 有人加入房间")

		"sdp":
			sdp_received.emit(msg.get("from", "unknown"), msg.get("sdp", {}))

		"ice":
			ice_received.emit(msg.get("from", "unknown"), msg.get("candidate", ""))

		"peer_disconnected":
			peer_disconnected.emit(msg.get("reason", "unknown"))
			print("[信令] 对方断开: ", msg.get("reason", "unknown"))

		"room_not_found":
			error_occurred.emit("未找到该房间，请确认房间码")

		"room_full":
			error_occurred.emit("房间已满（%d/%d）" % [NetworkConfig.MAX_PLAYERS, NetworkConfig.MAX_PLAYERS])

		"invalid_code":
			error_occurred.emit(msg.get("message", "房间码格式错误"))

		"rate_limited":
			var retry: int = msg.get("retryAfter", 30)
			error_occurred.emit("操作过于频繁，请%d秒后重试" % retry)

		"pong":
			pass  # 心跳响应，无需处理

		"error":
			error_occurred.emit(msg.get("message", "未知错误"))

		"server_shutdown":
			error_occurred.emit("信令服务器正在维护，请稍后重连")

		_:
			print("[信令] 未知消息类型: ", msg.type)
