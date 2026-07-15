## 带宽管理器
##
## 按优先级分配带宽，确保关键消息优先传输。
## 在弱网环境下自动降级非关键数据的同步频率。
extends Node
class_name BandwidthManager

## 消息优先级
enum Priority { HIGH = 0, MEDIUM = 1, LOW = 2 }

## 每客户端带宽上限（字节/秒）
@export var max_bandwidth_bps: int = 51200

## 当前带宽使用量（字节/秒）
var _current_usage: int = 0
var _usage_timer: Timer
var _usage_reset_time: float = 0.0

## 同步频率表（根据网络质量动态调整）
var _sync_rates := {
	"position": 10.0,  # Hz
	"npc": 2.0,
	"vitals": 5.0,
	"snapshot": 60.0,  # 秒间隔
}

func _ready() -> void:
	_usage_timer = Timer.new()
	_usage_timer.wait_time = 1.0
	_usage_timer.one_shot = false
	_usage_timer.timeout.connect(_reset_usage)
	add_child(_usage_timer)
	_usage_timer.start()

## 检查是否可以发送指定大小的消息
func can_send(bytes: int, priority: Priority = Priority.MEDIUM) -> bool:
	if _current_usage + bytes > max_bandwidth_bps:
		# 高优先级消息始终允许（但会记录警告）
		if priority == Priority.HIGH:
			return true
		return false
	_current_usage += bytes
	return true

## 位置差值压缩：只发送变化超过阈值的位置
func should_send_position(old_pos: Vector2, new_pos: Vector2) -> bool:
	return old_pos.distance_to(new_pos) > 0.5

## 根据网络质量调整同步频率
func adapt_to_quality(quality: ConnectionMonitor.Quality) -> void:
	match quality:
		ConnectionMonitor.Quality.GOOD:
			_sync_rates.position = 10.0
			_sync_rates.npc = 2.0
			_sync_rates.vitals = 5.0
			_sync_rates.snapshot = 60.0
		ConnectionMonitor.Quality.FAIR:
			_sync_rates.position = 5.0
			_sync_rates.npc = 1.0
			_sync_rates.vitals = 3.0
			_sync_rates.snapshot = 30.0
		ConnectionMonitor.Quality.POOR:
			_sync_rates.position = 3.0
			_sync_rates.npc = 0.5
			_sync_rates.vitals = 2.0
			_sync_rates.snapshot = 15.0
		ConnectionMonitor.Quality.CRITICAL:
			_sync_rates.position = 1.0
			_sync_rates.npc = 0.0
			_sync_rates.vitals = 1.0
			_sync_rates.snapshot = 5.0

## 获取同步频率
func get_sync_rate(type: String) -> float:
	return _sync_rates.get(type, 1.0)

func _reset_usage() -> void:
	_current_usage = 0