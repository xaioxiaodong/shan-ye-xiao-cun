## 聊天面板组件
##
## 联机大厅中的聊天区域：消息列表 + 输入框 + 发送按钮。
## 支持 @rpc 同步聊天消息，Enter 发送，系统消息类型。
extends Control
class_name ChatPanel

@export var max_messages: int = 100

## 消息列表容器
var _message_list: RichTextLabel
## 输入框
var _input: LineEdit
## 发送按钮
var _send_btn: Button

## 消息颜色（按类型）
const COLOR_SYSTEM := Color.WEB_GRAY
const COLOR_SELF := Color.WHITE
const COLOR_OTHER := Color(0.7, 1.0, 0.7)
const COLOR_ERROR := Color(1.0, 0.4, 0.4)

func _ready() -> void:
	_setup_ui()
	# 监听聊天消息
	NetworkManager.chat_received.connect(_on_chat_received)

func _setup_ui() -> void:
	# 消息列表
	_message_list = RichTextLabel.new()
	_message_list.name = "MessageList"
	_message_list.bbcode_enabled = true
	_message_list.scroll_following = true
	_message_list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_message_list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_message_list.custom_minimum_size = Vector2(0, 120)
	add_child(_message_list)

	# 输入区域
	var input_row := HBoxContainer.new()
	input_row.name = "InputRow"
	input_row.add_theme_constant_override("separation", 4)
	add_child(input_row)

	_input = LineEdit.new()
	_input.name = "ChatInput"
	_input.placeholder_text = "输入消息..."
	_input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_input.max_length = 200
	_input.text_submitted.connect(_on_send)
	input_row.add_child(_input)

	_send_btn = Button.new()
	_send_btn.name = "SendBtn"
	_send_btn.text = "发送"
	_send_btn.pressed.connect(_on_send_pressed)
	input_row.add_child(_send_btn)

func _input(event: InputEvent) -> void:
	# Enter 键发送（仅当输入框有焦点时）
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ENTER:
			if _input.has_focus():
				_on_send(_input.text)
				get_viewport().set_input_as_handled()

## 发送消息
func _on_send(text: String) -> void:
	var message := text.strip_edges()
	if message.is_empty():
		return
	# 本地显示
	_add_message(NetworkManager.local_player_name, message, COLOR_SELF)
	# 网络发送
	_send_chat_rpc.rpc(message)
	# 清空输入
	_input.text = ""
	_input.grab_focus()

func _on_send_pressed() -> void:
	_on_send(_input.text)

## 添加消息到列表
func _add_message(sender: String, message: String, color: Color) -> void:
	# 限制消息数量
	var lines := _message_list.text.split("\n")
	if lines.size() >= max_messages:
		# 移除最旧的消息
		_message_list.clear()
		for i in range(max(0, lines.size() - max_messages + 1), lines.size()):
			_message_list.append_text(lines[i] + "\n")

	var color_hex := color.to_html(false)
	_message_list.append_text("[color=%s][%s]: %s[/color]\n" % [color_hex, sender, message])

## 添加系统消息
func add_system_message(message: String) -> void:
	_add_message("系统", message, COLOR_SYSTEM)

## 添加错误消息
func add_error_message(message: String) -> void:
	_add_message("错误", message, COLOR_ERROR)

## 收到远程聊天消息
func _on_chat_received(sender_name: String, message: String) -> void:
	_add_message(sender_name, message, COLOR_OTHER)

## 远程发送聊天（RPC）
@rpc("any_peer", "reliable")
func _send_chat_rpc(message: String) -> void:
	var sender_id := multiplayer.get_remote_sender_id()
	var sender_name := NetworkManager.get_player_name(sender_id)
	NetworkManager.chat_received.emit(sender_name, message)

## 清除所有消息
func clear() -> void:
	_message_list.clear()