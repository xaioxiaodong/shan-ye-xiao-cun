## 游戏版本管理（Autoload 单例）
##
## 全局版本常量，用于连接时版本校验和数据兼容性检查。
## 版本号格式：主版本.次版本.补丁（语义化版本）
extends Node

## 当前游戏版本号
const CURRENT: String = "0.2.0"

## 主版本号（不兼容变更时递增）
const MAJOR: int = 0

## 次版本号（向后兼容新功能时递增）
const MINOR: int = 2

## 补丁版本号（向后兼容修复时递增）
const PATCH: int = 0

## 协议版本号（网络消息格式版本，变更时需要所有客户端同步更新）
const PROTOCOL_VERSION: int = 1

## 允许联机的兼容版本列表（向后兼容 1 个小版本）
const COMPATIBLE_VERSIONS: Array[String] = ["0.2.0", "0.1.9"]

## 检查给定版本是否与当前版本兼容
static func is_compatible(peer_version: String) -> bool:
	return peer_version in COMPATIBLE_VERSIONS

## 获取版本不匹配的用户友好消息
static func get_mismatch_message(peer_version: String) -> String:
	if peer_version.begins_with("0.1."):
		return "对方游戏版本较旧(%s)，请升级到%s" % [peer_version, CURRENT]
	return "游戏版本不匹配：你的版本%s，对方版本%s" % [CURRENT, peer_version]

## 解析版本字符串为 [主版本, 次版本, 补丁] 数组
static func parse(version_str: String) -> Array[int]:
	var parts := version_str.split(".")
	if parts.size() != 3:
		return [0, 0, 0]
	return [parts[0].to_int(), parts[1].to_int(), parts[2].to_int()]
