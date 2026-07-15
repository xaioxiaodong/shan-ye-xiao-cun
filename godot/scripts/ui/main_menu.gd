## 主菜单脚本
##
## 提供游戏入口：单人游戏、局域网联机、跨地区联机。
extends Control

func _ready() -> void:
	print("═══════════════════════════════════════")
	print("  《山野小村》联机版 v%s" % GameVersion.CURRENT)
	print("  引擎: Godot %s" % Engine.get_version_info().string)
	print("  协议版本: %d" % GameVersion.PROTOCOL_VERSION)
	print("═══════════════════════════════════════")

# ── 按钮回调 ──

func _on_single_player() -> void:
	print("[菜单] 单人游戏（暂未实现，请先完成网络层）")

func _on_lan_host() -> void:
	print("[菜单] 局域网 · 创建房间")
	# TODO: 显示房间码输入对话框 → 创建局域网主机

func _on_lan_join() -> void:
	print("[菜单] 局域网 · 加入房间")
	# TODO: 显示房间码输入对话框 → 搜索并加入

func _on_internet_host() -> void:
	print("[菜单] 跨地区 · 创建房间")
	# TODO: 连接信令服务器 → 创建房间

func _on_internet_join() -> void:
	print("[菜单] 跨地区 · 加入房间")
	# TODO: 显示房间码输入对话框 → 连接信令服务器 → 加入

func _on_settings() -> void:
	print("[菜单] 设置（暂未实现）")

func _on_quit() -> void:
	get_tree().quit()
