## 房间管理统一接口（ENet/WebRTC 抽象层）
##
## 封装 ENetMultiplayerPeer 和 WebRTCMultiplayerPeer 的差异，
## 为 NetworkManager 提供统一的房间创建/加入/管理接口。
extends Node
class_name GameRoomModule

# ── 信号 ──

signal peer_connected(peer_id: int)
signal peer_disconnected(peer_id: int)
signal server_disconnected()

# ── 内部状态 ──

var _lan_discovery: LanDiscoveryModule

func _ready() -> void:
	_lan_discovery = LanDiscoveryModule.new()
	_lan_discovery.name = "LanDiscovery"
	add_child(_lan_discovery)

# ── 局域网模式 ──

## 创建局域网主机（ENet 服务器 + UDP 广播）
## 返回 OK 或错误码，成功后 room_code 已设置
func create_lan_host(room_code: String) -> Error:
	# 端口自动探测
	var port := _find_available_port(
		NetworkConfig.ENET_PORT_START,
		NetworkConfig.ENET_PORT_START - NetworkConfig.ENET_PORT_RANGE
	)
	if port < 0:
		print("[GameRoom] 所有端口被占用")
		return ERR_CANT_CREATE

	# 创建 ENet 服务器
	var enet_peer := ENetMultiplayerPeer.new()
	var err := enet_peer.create_server(
		port,
		NetworkConfig.MAX_PLAYERS,
		NetworkConfig.MAX_CHANNELS
	)
	if err != OK:
		print("[GameRoom] 创建 ENet 服务器失败: %s" % error_string(err))
		return err

	multiplayer.multiplayer_peer = enet_peer
	NetworkManager.peer_id = multiplayer.get_unique_id()
	NetworkManager.connection_type = "lan"
	NetworkManager.mode = NetworkManager.NetworkMode.LAN
	NetworkManager.role = NetworkManager.PlayerRole.HOST
	NetworkManager.room_code = room_code

	# 连接信号
	multiplayer.peer_connected.connect(_on_peer_connected)
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)
	multiplayer.server_disconnected.connect(_on_server_disconnected)

	# 启动 UDP 广播
	_lan_discovery.start_broadcast(room_code, port)

	# 启动心跳
	NetworkManager._heartbeat_timer.start()
	NetworkManager._last_heartbeat_received = 0.0
	NetworkManager._heartbeat_miss_count = 0

	NetworkManager._set_state(NetworkManager.ConnectionState.CONNECTED)
	NetworkManager.connection_established.emit(
		NetworkManager.NetworkMode.LAN, NetworkManager.PlayerRole.HOST
	)
	print("[GameRoom] 局域网主机已创建，端口 %d，房间码 %s" % [port, room_code])
	return OK

## 加入局域网房间（ENet 客户端 + UDP 广播发现）
func join_lan_room(room_code: String) -> Error:
	NetworkManager._set_state(NetworkManager.ConnectionState.CONNECTING)

	# 搜索主机
	var host_info := await _lan_discovery.find_host_all_interfaces(room_code)
	if host_info.is_empty():
		NetworkManager._set_state(NetworkManager.ConnectionState.DISCONNECTED)
		return ERR_DOES_NOT_EXIST

	# 版本校验
	var version: String = host_info.get("version", "")
	if not GameVersion.is_compatible(version):
		NetworkManager._set_state(NetworkManager.ConnectionState.DISCONNECTED)
		return ERR_INVALID_DATA

	# 连接 ENet 服务器
	var enet_peer := ENetMultiplayerPeer.new()
	var err := enet_peer.create_client(
		host_info.ip,
		host_info.port,
		NetworkConfig.MAX_CHANNELS
	)
	if err != OK:
		NetworkManager._set_state(NetworkManager.ConnectionState.DISCONNECTED)
		return err

	multiplayer.multiplayer_peer = enet_peer
	NetworkManager.peer_id = multiplayer.get_unique_id()
	NetworkManager.connection_type = "lan"
	NetworkManager.mode = NetworkManager.NetworkMode.LAN
	NetworkManager.role = NetworkManager.PlayerRole.CLIENT
	NetworkManager.room_code = room_code

	# 连接信号
	multiplayer.peer_connected.connect(_on_peer_connected)
	multiplayer.peer_disconnected.connect(_on_peer_disconnected)
	multiplayer.server_disconnected.connect(_on_server_disconnected)

	# 启动心跳
	NetworkManager._heartbeat_timer.start()
	NetworkManager._last_heartbeat_received = 0.0
	NetworkManager._heartbeat_miss_count = 0

	NetworkManager._set_state(NetworkManager.ConnectionState.CONNECTED)
	NetworkManager.connection_established.emit(
		NetworkManager.NetworkMode.LAN, NetworkManager.PlayerRole.CLIENT
	)
	print("[GameRoom] 已加入局域网房间 %s (%s:%d)" % [room_code, host_info.ip, host_info.port])
	return OK

# ── 跨地区模式（WebRTC）──

## 创建跨地区主机（等待信令服务器分配房间码后调用）
func setup_internet_host() -> void:
	NetworkManager.mode = NetworkManager.NetworkMode.INTERNET
	NetworkManager.role = NetworkManager.PlayerRole.HOST
	NetworkManager.connection_type = "p2p_direct"
	# WebRTC 连接将在后续信号回调中建立
	print("[GameRoom] 跨地区主机准备就绪")

## 设置跨地区客户端（信令握手成功后调用）
func setup_internet_client() -> void:
	NetworkManager.mode = NetworkManager.NetworkMode.INTERNET
	NetworkManager.role = NetworkManager.PlayerRole.CLIENT
	NetworkManager.connection_type = "p2p_direct"
	print("[GameRoom] 跨地区客户端准备就绪")

# ── 断开与清理 ──

## 关闭房间，断开所有连接
func close_room() -> void:
	_lan_discovery.stop_broadcast()

	# 断开信号连接
	if multiplayer.peer_connected.is_connected(_on_peer_connected):
		multiplayer.peer_connected.disconnect(_on_peer_connected)
	if multiplayer.peer_disconnected.is_connected(_on_peer_disconnected):
		multiplayer.peer_disconnected.disconnect(_on_peer_disconnected)
	if multiplayer.server_disconnected.is_connected(_on_server_disconnected):
		multiplayer.server_disconnected.disconnect(_on_server_disconnected)

	NetworkManager.disconnect_from_game()
	print("[GameRoom] 房间已关闭")

# ── 端口探测 ──

func _find_available_port(start: int, end: int) -> int:
	for port in range(start, end - 1, -1):
		var test_peer := ENetMultiplayerPeer.new()
		if test_peer.create_server(port, 1) == OK:
			test_peer.close()
			return port
	return -1

# ── 信号回调 ──

func _on_peer_connected(pid: int) -> void:
	print("[GameRoom] 玩家连接: %d" % pid)
	peer_connected.emit(pid)
	NetworkManager.player_joined.emit(pid, "玩家%d" % pid)

func _on_peer_disconnected(pid: int) -> void:
	print("[GameRoom] 玩家断开: %d" % pid)
	peer_disconnected.emit(pid)
	NetworkManager.player_left.emit(pid)

func _on_server_disconnected() -> void:
	print("[GameRoom] 服务器断开")
	server_disconnected.emit()
