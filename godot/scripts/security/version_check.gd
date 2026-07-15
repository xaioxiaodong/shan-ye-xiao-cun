## 版本兼容性检查器
##
## 连接时校验双方游戏版本，确保兼容性。
## 版本管理和校验逻辑已集成到 GameVersion Autoload 中，此为独立检查工具。
class_name VersionCheck
extends RefCounted

## 检查版本是否兼容
static func is_compatible(peer_version: String) -> bool:
	return GameVersion.is_compatible(peer_version)

## 获取不兼容原因的用户友好消息
static func get_mismatch_message(peer_version: String) -> String:
	return GameVersion.get_mismatch_message(peer_version)

## 比较两个版本号
## 返回 -1 表示 v1 < v2, 0 表示相等, 1 表示 v1 > v2
static func compare(v1: String, v2: String) -> int:
	var parts1 := GameVersion.parse(v1)
	var parts2 := GameVersion.parse(v2)
	for i in range(3):
		if parts1[i] < parts2[i]:
			return -1
		if parts1[i] > parts2[i]:
			return 1
	return 0

## 检查是否需要更新（当前版本落后于远端版本）
static func needs_update(peer_version: String) -> bool:
	return compare(GameVersion.CURRENT, peer_version) < 0

## 检查对方是否需要更新
static func peer_needs_update(peer_version: String) -> bool:
	return compare(GameVersion.CURRENT, peer_version) > 0

## 检查协议版本是否兼容
static func is_protocol_compatible(peer_protocol: int) -> bool:
	return peer_protocol == GameVersion.PROTOCOL_VERSION