## 网络配置常量（Autoload 单例）
##
## 所有网络相关的配置参数集中管理，禁止硬编码。
## 标注为「BASELINE」的参数可随版本调整，标注为「HARD_LIMIT」的不可突破。
extends Node

# ── 服务器地址 ──

## 信令服务器 WebSocket 地址
## 生产环境使用 wss://，开发环境使用 ws://
const SIGNALING_URL: String = "ws://localhost:8888"

## TURN 服务器地址（兜底中继）
const TURN_SERVER_URL: String = "turn:turn.your-server.com:3478"

## TURN 服务器用户名
const TURN_USERNAME: String = "game"

## TURN 服务器密钥
const TURN_CREDENTIAL: String = "your-secret"

# ── 端口配置 ──

## ENet 游戏服务器默认起始端口
const ENET_PORT_START: int = 9999

## ENet 端口探测范围（从 START 向下尝试）
const ENET_PORT_RANGE: int = 10

## UDP 广播端口（局域网发现）
const BROADCAST_PORT: int = 9998

## UDP 广播地址
const BROADCAST_ADDR: String = "255.255.255.255"

# ── 连接参数 ──

## 最大玩家数（HARD_LIMIT: ENet 支持 4095，设计限制为 4）
const MAX_PLAYERS: int = 4

## ENet 最大通道数
const MAX_CHANNELS: int = 8

## UDP 广播间隔（秒）
const BROADCAST_INTERVAL: float = 1.0

## UDP 广播 nonce 刷新间隔（秒）
const NONCE_REFRESH_INTERVAL: float = 30.0

# ── 心跳与超时 ──

## 心跳发送间隔（秒）
const HEARTBEAT_INTERVAL: float = 3.0

## 心跳超时（秒）——超过此时间无心跳视为断线
const HEARTBEAT_TIMEOUT: float = 10.0

## 连接超时（秒）——WebRTC 连接建立超时
const CONNECTION_TIMEOUT: float = 15.0

## 局域网搜索超时（秒）
const LAN_SEARCH_TIMEOUT: float = 5.0

# ── 重连参数 ──

## 最大重连尝试次数
const MAX_RECONNECT_ATTEMPTS: int = 5

## 重连窗口（秒）
const RECONNECT_WINDOW: float = 30.0

## 重连间隔（秒）
const RECONNECT_DELAY: float = 2.0

# ── 主机迁移 ──

## 主机迁移选举时间（秒）
const HOST_MIGRATION_ELECTION_TIME: float = 3.0

## 主机迁移延迟上限（ms）——超过此延迟不参与选举
const HOST_MIGRATION_LATENCY_LIMIT: int = 200

# ── 带宽限制 ──

## 每客户端最大带宽（字节/秒）BASELINE
const MAX_BANDWIDTH_BPS: int = 51200

## 快照发送间隔（秒）
const SNAPSHOT_INTERVAL: float = 60.0

# ── 信令服务器参数 ──

## 信令层心跳间隔（秒）
const SIGNALING_HEARTBEAT_INTERVAL: float = 30.0

## 房间码 TTL（秒）
const ROOM_TTL_SECONDS: int = 600

## 房间码校验位计算
static func compute_check_digit(code: String) -> int:
	var digits := []
	for ch in code:
		digits.append(ch.to_int())
	if digits.size() != 4:
		return -1
	return (digits[0] * 1 + digits[1] * 2 + digits[2] * 3 + digits[3] * 4) % 10

## 验证房间码校验位
static func verify_check_digit(code: String, check_digit: int) -> bool:
	return compute_check_digit(code) == check_digit
