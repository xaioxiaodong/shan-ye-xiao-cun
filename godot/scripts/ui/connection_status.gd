## 连接状态指示器
##
## 显示当前连接状态：连接类型（P2P/中继/局域网）、延迟、网络质量。
## 通过监听 NetworkManager 和 ConnectionMonitor 的信号自动更新。
extends HBoxContainer
class_name ConnectionStatus

## 状态标签
var _status_label: Label
## 延迟标签
var _latency_label: Label
## 质量指示器
var _quality_indicator: ColorRect
## 房间码标签
var _room_code_label: Label

func _ready() -> void:
	_setup_ui()
	# 监听网络状态变化
	NetworkManager.state_changed.connect(_on_state_changed)
	NetworkManager.connection_established.connect(_on_established)
	ConnectionMonitor.quality_changed.connect(_on_quality_changed)

func _setup_ui() -> void:
	add_theme_constant_override("separation", 8)

	# 状态标签
	_status_label = Label.new()
	_status_label.name = "StatusLabel"
	_status_label.text = "未连接"
	add_child(_status_label)

	# 房间码标签
	_room_code_label = Label.new()
	_room_code_label.name = "RoomCodeLabel"
	_room_code_label.visible = false
	add_child(_room_code_label)

	# 质量指示器（彩色圆点）
	_quality_indicator = ColorRect.new()
	_quality_indicator.name = "QualityIndicator"
	_quality_indicator.custom_minimum_size = Vector2(10, 10)
	_quality_indicator.size = Vector2(10, 10)
	_quality_indicator.color = Color.DIM_GRAY
	add_child(_quality_indicator)

	# 延迟标签
	_latency_label = Label.new()
	_latency_label.name = "LatencyLabel"
	_latency_label.text = "---"
	_latency_label.add_theme_font_size_override("font_size", 10)
	add_child(_latency_label)

func _on_state_changed(state: NetworkManager.ConnectionState) -> void:
	match state:
		NetworkManager.ConnectionState.DISCONNECTED:
			_status_label.text = "未连接"
			_quality_indicator.color = Color.DIM_GRAY
			_latency_label.text = "---"
			_room_code_label.visible = false
		NetworkManager.ConnectionState.CONNECTING:
			_status_label.text = "正在连接..."
			_quality_indicator.color = Color.YELLOW
		NetworkManager.ConnectionState.CONNECTED:
			var conn_type := NetworkManager.connection_type
			match conn_type:
				"lan": _status_label.text = "局域网"
				"p2p_direct": _status_label.text = "P2P直连"
				"turn_relay": _status_label.text = "中继连接"
				_: _status_label.text = conn_type
			# 显示房间码
			if not NetworkManager.room_code.is_empty():
				_room_code_label.text = "房间: %s" % NetworkManager.format_room_code(
					NetworkManager.room_code, NetworkManager.check_digit
				)
				_room_code_label.visible = true
		NetworkManager.ConnectionState.RECONNECTING:
			_status_label.text = "重连中..."
			_quality_indicator.color = Color.ORANGE

func _on_established(mode: NetworkManager.NetworkMode, role: NetworkManager.PlayerRole) -> void:
	# 连接建立后，每隔1秒更新延迟显示
	var timer := Timer.new()
	timer.wait_time = 1.0
	timer.one_shot = false
	timer.timeout.connect(_update_latency_display)
	add_child(timer)
	timer.start()

func _on_quality_changed(quality: ConnectionMonitor.Quality, latency_ms: int, _loss: float) -> void:
	_quality_indicator.color = ConnectionMonitor.get_quality_color()

func _update_latency_display() -> void:
	var lat := NetworkManager.average_latency
	_latency_label.text = "%dms" % lat
	# 延迟颜色
	if lat < 50:
		_latency_label.add_theme_color_override("font_color", Color.GREEN)
	elif lat < 150:
		_latency_label.add_theme_color_override("font_color", Color.YELLOW)
	elif lat < 300:
		_latency_label.add_theme_color_override("font_color", Color.ORANGE)
	else:
		_latency_label.add_theme_color_override("font_color", Color.RED)