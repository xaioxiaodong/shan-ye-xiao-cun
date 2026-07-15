## 游戏大厅 UI 脚本
##
## 联机等待大厅：玩家列表、聊天、准备/开始、连接状态。
extends Control

var _is_ready: bool = false
var _ready_btn: Button
var _start_btn: Button
var _chat: ChatPanel
var _player_list: PlayerList
var _room_code_label: Label
var _countdown_timer: Timer
var _countdown_label: Label

func _ready() -> void:
	_ready_btn = get_node("MainArea/LeftPanel/ReadyBtn")
	_start_btn = get_node("BottomBar/StartBtn")
	_chat = get_node("MainArea/RightPanel/ChatPanel")
	_player_list = get_node("MainArea/LeftPanel/PlayerList")
	_room_code_label = get_node("TopBar/RoomCode")

	# 初始状态
	_start_btn.visible = false
	_ready_btn.visible = false

	# 监听网络事件
	NetworkManager.connection_established.connect(_on_connected)
	NetworkManager.player_joined.connect(_on_player_joined)
	NetworkManager.player_left.connect(_on_player_left)
	NetworkManager.lobby_updated.connect(_update_state)

	# 倒计时
	_countdown_label = Label.new()
	_countdown_label.name = "CountdownLabel"
	_countdown_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_countdown_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_countdown_label.visible = false
	_countdown_label.add_theme_font_size_override("font_size", 48)
	add_child(_countdown_label)

func _on_connected(_mode: NetworkManager.NetworkMode, role: NetworkManager.PlayerRole) -> void:
	# 显示房间码
	_room_code_label.text = "房间: %s" % NetworkManager.format_room_code(
		NetworkManager.room_code, NetworkManager.check_digit
	)

	# 主机：显示开始按钮；客户端：显示准备按钮
	if role == NetworkManager.PlayerRole.HOST:
		_start_btn.visible = true
		_start_btn.disabled = true
		_ready_btn.visible = false
	else:
		_start_btn.visible = false
		_ready_btn.visible = true
		_ready_btn.text = "准备"

	# 系统消息
	_chat.add_system_message("已连接到联机房间")

func _on_player_joined(_peer_id: int, player_name: String) -> void:
	_chat.add_system_message("%s 加入了房间" % player_name)
	_update_state()

func _on_player_left(peer_id: int) -> void:
	var name := NetworkManager.get_player_name(peer_id)
	_chat.add_system_message("%s 离开了房间" % name)
	_update_state()

func _on_ready_toggle() -> void:
	_is_ready = not _is_ready
	_ready_btn.text = "取消准备" if _is_ready else "准备"
	# 通知主机
	_set_ready_rpc.rpc_id(1, _is_ready)
	_update_state()

@rpc("authority", "reliable")
func _set_ready_rpc(is_ready: bool) -> void:
	var sender_id := multiplayer.get_remote_sender_id()
	if NetworkManager.connected_players.has(sender_id):
		NetworkManager.connected_players[sender_id]["is_ready"] = is_ready
	NetworkManager.lobby_updated.emit()
	_chat.add_system_message("%s %s" % [NetworkManager.get_player_name(sender_id), "已准备" if is_ready else "取消准备"])

func _on_start_game() -> void:
	# 检查是否全部准备
	if not NetworkManager.get_all_ready():
		_chat.add_error_message("还有玩家未准备")
		return
	_start_countdown()

func _start_countdown() -> void:
	var count := 3
	_countdown_label.visible = true
	_start_btn.disabled = true
	_ready_btn.disabled = true

	while count > 0:
		_countdown_label.text = str(count)
		_countdown_rpc.rpc(count)
		await get_tree().create_timer(1.0).timeout
		count -= 1

	_countdown_label.text = "开始！"
	_countdown_rpc.rpc(0)
	await get_tree().create_timer(0.5).timeout
	_countdown_label.visible = false
	# 加载游戏场景
	_start_game_rpc.rpc()

@rpc("authority", "reliable")
func _countdown_rpc(value: int) -> void:
	if value > 0:
		_countdown_label.text = str(value)
	else:
		_countdown_label.text = "开始！"

@rpc("authority", "reliable")
func _start_game_rpc() -> void:
	# 加载游戏场景（暂用占位）
	_chat.add_system_message("游戏开始！")
	# TODO: get_tree().change_scene_to_file("res://scenes/game/game_scene.tscn")

func _update_state() -> void:
	if NetworkManager.role == NetworkManager.PlayerRole.HOST:
		var all_ready := NetworkManager.get_all_ready()
		_start_btn.disabled = not all_ready or NetworkManager.connected_players.is_empty()