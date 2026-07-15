## 局域网UDP广播发现（多网卡支持）
##
## 主办方：遍历所有本机网卡IP，在每张网卡上发送UDP广播
## 参加方：同时监听所有网卡的UDP端口，匹配房间码后返回主机信息
extends Node
class_name LanDiscoveryModule

## 广播数据包格式（JSON字符串→PackedByteArray）
const BROADCAST_MAGIC: String = "SYXC"  ## 广播包标识（防其他UDP干扰）

## 当前 nonce（30秒刷新一次，防重放攻击）
var _nonce: String = ""
var _nonce_timer: Timer

## 广播发送器（主办方使用）
var _broadcast_peers: Array[PacketPeerUDP] = []

## 广播监听器（参加方使用）
var _listen_server: UDPServer

func _ready() -> void:
	_nonce_timer = Timer.new()
	_nonce_timer.wait_time = NetworkConfig.NONCE_REFRESH_INTERVAL
	_nonce_timer.one_shot = false
	_nonce_timer.timeout.connect(_refresh_nonce)
	add_child(_nonce_timer)
	_nonce_timer.stop()
	_refresh_nonce()

# ── 主办方：开始广播 ──

## 在所有网卡上开始广播房间信息
func start_broadcast(room_code: String, game_port: int) -> void:
	stop_broadcast()
	_nonce_timer.start()
	_refresh_nonce()

	var ips := _get_all_local_ips()
	for ip in ips:
		var peer := PacketPeerUDP.new()
		peer.set_broadcast_enabled(true)
		peer.set_dest_address(NetworkConfig.BROADCAST_ADDR, NetworkConfig.BROADCAST_PORT)
		_broadcast_peers.append(peer)

	# 立即发送第一次广播
	_send_broadcast(room_code, game_port)

	# 启动定时广播
	var timer := Timer.new()
	timer.name = "BroadcastTimer"
	timer.wait_time = NetworkConfig.BROADCAST_INTERVAL
	timer.one_shot = false
	timer.timeout.connect(_send_broadcast.bind(room_code, game_port))
	add_child(timer)
	timer.start()

## 停止广播
func stop_broadcast() -> void:
	for peer in _broadcast_peers:
		peer.close()
	_broadcast_peers.clear()
	var timer := get_node_or_null("BroadcastTimer")
	if timer:
		timer.stop()
		timer.queue_free()
	_nonce_timer.stop()

## 发送广播包
func _send_broadcast(room_code: String, game_port: int) -> void:
	var packet := {
		"magic": BROADCAST_MAGIC,
		"type": "room_announce",
		"room_code": room_code,
		"host_ip": _get_primary_ip(),
		"host_port": game_port,
		"game_version": GameVersion.CURRENT,
		"player_count": NetworkManager.connected_players.size() + 1,
		"max_players": NetworkConfig.MAX_PLAYERS,
		"nonce": _nonce,
		"timestamp": Time.get_unix_time_from_system(),
	}
	var data := JSON.stringify(packet).to_utf8_buffer()
	for peer in _broadcast_peers:
		peer.put_packet(data)

# ── 参加方：发现主机 ──

## 在所有网卡上监听广播，匹配房间码
## 返回 {"ip": String, "port": int, "version": String} 或空 Dictionary
func find_host_all_interfaces(target_code: String, timeout: float = -1.0) -> Dictionary:
	if timeout < 0:
		timeout = NetworkConfig.LAN_SEARCH_TIMEOUT

	_listen_server = UDPServer.new()
	var err := _listen_server.listen(NetworkConfig.BROADCAST_PORT)
	if err != OK:
		print("[局域网发现] 无法监听端口 %d: %s" % [NetworkConfig.BROADCAST_PORT, error_string(err)])
		return {}

	var elapsed := 0.0
	while elapsed < timeout:
		_listen_server.poll()
		if _listen_server.is_connection_available():
			var peer := _listen_server.take_connection()
			var raw := peer.get_packet().get_string_from_utf8()
			var packet = JSON.parse_string(raw)
			if packet and _validate_broadcast(packet, target_code):
				_listen_server.stop()
				return {
					"ip": packet.get("host_ip", ""),
					"port": int(packet.get("host_port", 0)),
					"version": packet.get("game_version", ""),
				}
		await get_tree().process_frame
		elapsed += get_process_delta_time()

	_listen_server.stop()
	return {}

## 验证广播包有效性
func _validate_broadcast(packet: Dictionary, target_code: String) -> bool:
	if packet.get("magic") != BROADCAST_MAGIC:
		return false
	if packet.get("room_code") != target_code:
		return false
	if not packet.has("host_ip") or not packet.has("host_port"):
		return false
	# 版本校验
	var version: String = packet.get("game_version", "")
	if not GameVersion.is_compatible(version):
		print("[局域网发现] 版本不兼容: %s vs %s" % [version, GameVersion.CURRENT])
		return false
	return true

# ── 工具方法 ──

## 获取所有本机局域网IP地址
func _get_all_local_ips() -> Array[String]:
	var ips: Array[String] = []
	for ip in IP.get_local_addresses():
		# 排除回环地址和IPv6
		if ip == "127.0.0.1" or ip.begins_with("::") or ip == "localhost":
			continue
		if ip.begins_with("192.168.") or ip.begins_with("10.") or ip.begins_with("172."):
			ips.append(ip)
	if ips.is_empty():
		# 回退到第一个非回环地址
		for ip in IP.get_local_addresses():
			if ip != "127.0.0.1":
				ips.append(ip)
				break
	return ips

## 获取主要局域网IP（优先返回 192.168.x.x）
func _get_primary_ip() -> String:
	var ips := _get_all_local_ips()
	for ip in ips:
		if ip.begins_with("192.168."):
			return ip
	if not ips.is_empty():
		return ips[0]
	return "127.0.0.1"

## 刷新 nonce（防重放攻击）
func _refresh_nonce() -> void:
	_nonce = str(randi() % 0xFFFFFFFF).pad_zeros(8)
