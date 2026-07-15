## 玩家列表UI组件
##
## 显示联机大厅中所有玩家的信息：昵称、农场名、颜色、延迟、准备状态。
## 通过监听 NetworkManager 的 player_joined/player_left/lobby_updated 信号自动更新。
extends VBoxContainer
class_name PlayerList

## 每个玩家卡片的 PackedScene
@export var player_card_scene: PackedScene = null

## 已显示的玩家卡片（peer_id → Control）
var _cards: Dictionary = {}

## 最大显示玩家数
const MAX_DISPLAY: int = 4

func _ready() -> void:
	# 如果没有外部设置场景，使用默认创建
	if player_card_scene == null:
		player_card_scene = _create_default_card_scene()

	# 监听网络事件
	NetworkManager.player_joined.connect(_add_player)
	NetworkManager.player_left.connect(_remove_player)
	NetworkManager.lobby_updated.connect(_refresh_all)

	# 添加自己
	_add_local_player()

## 添加本地玩家
func _add_local_player() -> void:
	_add_player_card(NetworkManager.peer_id, NetworkManager.local_player_name,
		NetworkManager.local_farm_name, NetworkManager.local_color_index, 0, true)

## 添加远程玩家
func _add_player(peer_id: int, player_name: String) -> void:
	var latency: int = NetworkManager.connected_players.get(peer_id, {}).get("latency", 0)
	var color_idx: int = NetworkManager.connected_players.get(peer_id, {}).get("color_index", 0)
	var farm_name: String = NetworkManager.connected_players.get(peer_id, {}).get("farm_name", "未知")
	_add_player_card(peer_id, player_name, farm_name, color_idx, latency, false)

## 移除玩家
func _remove_player(peer_id: int) -> void:
	if _cards.has(peer_id):
		var card := _cards[peer_id]
		card.queue_free()
		_cards.erase(peer_id)

## 刷新所有玩家
func _refresh_all() -> void:
	for pid in _cards:
		_update_card(pid)
	# 添加新玩家
	for pid in NetworkManager.connected_players:
		if not _cards.has(pid):
			var name: String = NetworkManager.get_player_name(pid)
			_add_player(pid, name)

## 添加玩家卡片
func _add_player_card(peer_id: int, name: String, farm_name: String, color_idx: int, latency: int, is_host: bool) -> void:
	var card := player_card_scene.instantiate() as Control
	card.name = "PlayerCard_%d" % peer_id
	add_child(card)

	# 设置卡片内容
	var name_label := card.get_node_or_null("NameLabel") as Label
	var farm_label := card.get_node_or_null("FarmLabel") as Label
	var latency_label := card.get_node_or_null("LatencyLabel") as Label
	var ready_indicator := card.get_node_or_null("ReadyIndicator") as ColorRect
	var host_badge := card.get_node_or_null("HostBadge") as Label
	var color_rect := card.get_node_or_null("PlayerColor") as ColorRect

	if name_label:
		name_label.text = name
	if farm_label:
		farm_label.text = farm_name
	if latency_label:
		latency_label.text = "%dms" % latency
	if color_rect:
		color_rect.color = NetworkManager.PLAYER_COLORS[color_idx % NetworkManager.PLAYER_COLORS.size()]
	if host_badge:
		host_badge.visible = is_host

	_cards[peer_id] = {
		"card": card,
		"name_label": name_label,
		"latency_label": latency_label,
		"ready_indicator": ready_indicator,
	}
	_update_card(peer_id)

## 更新单张卡片
func _update_card(peer_id: int) -> void:
	var entry := _cards.get(peer_id)
	if entry == null:
		return

	var is_ready := NetworkManager.connected_players.get(peer_id, {}).get("is_ready", false)
	var latency: int = NetworkManager.connected_players.get(peer_id, {}).get("latency", 0)

	var indicator := entry.get("ready_indicator") as ColorRect
	if indicator:
		indicator.color = Color.GREEN if is_ready else Color.DIM_GRAY

	var latency_label := entry.get("latency_label") as Label
	if latency_label:
		latency_label.text = "%dms" % latency

## 创建默认玩家卡片场景（无外部资源时使用）
func _create_default_card_scene() -> PackedScene:
	var scene := PackedScene.new()
	var root := HBoxContainer.new()
	root.name = "PlayerCard"
	root.custom_minimum_size = Vector2(200, 48)
	root.add_theme_constant_override("separation", 8)

	var color := ColorRect.new()
	color.name = "PlayerColor"
	color.custom_minimum_size = Vector2(16, 16)
	color.size = Vector2(16, 16)
	root.add_child(color)

	var vbox := VBoxContainer.new()
	root.add_child(vbox)

	var name_label := Label.new()
	name_label.name = "NameLabel"
	vbox.add_child(name_label)

	var farm_label := Label.new()
	farm_label.name = "FarmLabel"
	farm_label.add_theme_font_size_override("font_size", 10)
	vbox.add_child(farm_label)

	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	root.add_child(spacer)

	var latency_label := Label.new()
	latency_label.name = "LatencyLabel"
	latency_label.add_theme_font_size_override("font_size", 10)
	root.add_child(latency_label)

	var ready := ColorRect.new()
	ready.name = "ReadyIndicator"
	ready.custom_minimum_size = Vector2(12, 12)
	ready.size = Vector2(12, 12)
	ready.color = Color.DIM_GRAY
	root.add_child(ready)

	var host_badge := Label.new()
	host_badge.name = "HostBadge"
	host_badge.text = "★"
	host_badge.visible = false
	root.add_child(host_badge)

	var result := PackedScene.new()
	result.pack(root)
	return result