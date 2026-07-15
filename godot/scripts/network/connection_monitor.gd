## 连接质量监控（Autoload 单例）
##
## 实时监控延迟、丢包率、抖动，提供4级质量评估。
## 当质量变化时发出信号，供 NetworkManager 调整同步参数。
extends Node

# ── 信号 ──

signal quality_changed(new_quality: Quality, latency_ms: int, packet_loss: float)
signal warning_emitted(message: String)

# ── 质量等级 ──

enum Quality {
	GOOD = 0,     ## 延迟 <50ms, 丢包 <1%
	FAIR = 1,     ## 延迟 <150ms, 丢包 <5%
	POOR = 2,     ## 延迟 <300ms, 丢包 <10%
	CRITICAL = 3, ## 延迟 >300ms 或丢包 >10%
}

# ── 阈值配置 ──

const QUALITY_THRESHOLDS := {
	Quality.GOOD: {"latency": 50, "loss": 0.01},
	Quality.FAIR: {"latency": 150, "loss": 0.05},
	Quality.POOR: {"latency": 300, "loss": 0.10},
}

# ── 统计变量 ──

var _latency_history: Array[int] = []
var _packets_sent: int = 0
var _packets_lost: int = 0
var _current_quality: Quality = Quality.GOOD
var _jitter: float = 0.0

## 最近30个延迟样本的最大保留数
const MAX_HISTORY: int = 30

# ── 公开接口 ──

## 获取当前连接质量等级
func get_quality() -> Quality:
	return _current_quality

## 获取平均延迟（ms）
func get_average_latency() -> int:
	if _latency_history.is_empty():
		return 0
	var total := 0
	for v in _latency_history:
		total += v
	return total / _latency_history.size()

## 获取抖动（延迟标准差）
func get_jitter() -> float:
	return _jitter

## 获取丢包率（0.0 ~ 1.0）
func get_packet_loss_rate() -> float:
	if _packets_sent == 0:
		return 0.0
	return float(_packets_lost) / float(_packets_sent)

## 获取质量等级文本描述
func get_quality_text() -> String:
	match _current_quality:
		Quality.GOOD: return "优秀"
		Quality.FAIR: return "良好"
		Quality.POOR: return "较差"
		Quality.CRITICAL: return "极差"
	return "未知"

## 获取质量等级颜色（用于 UI 显示）
func get_quality_color() -> Color:
	match _current_quality:
		Quality.GOOD: return Color.GREEN
		Quality.FAIR: return Color.YELLOW
		Quality.POOR: return Color.ORANGE
		Quality.CRITICAL: return Color.RED
	return Color.WHITE

## 更新指标（由 NetworkManager 的心跳回调调用）
func update_metrics(latency_ms: int, packets_sent: int, packets_lost: int) -> void:
	_latency_history.push_back(latency_ms)
	if _latency_history.size() > MAX_HISTORY:
		_latency_history.pop_front()

	_packets_sent += packets_sent
	_packets_lost += packets_lost

	# 计算抖动（标准差）
	var mean := float(get_average_latency())
	var variance := 0.0
	for v in _latency_history:
		variance += pow(float(v) - mean, 2.0)
	if _latency_history.size() > 0:
		variance /= float(_latency_history.size())
	_jitter = sqrt(variance)

	# 评估质量
	var loss := get_packet_loss_rate()
	var new_quality := _evaluate_quality(mean, loss)
	if new_quality != _current_quality:
		var old_quality := _current_quality
		_current_quality = new_quality
		quality_changed.emit(new_quality, int(mean), loss)

		# 质量恶化时发出警告
		if new_quality > old_quality:
			var msg := "网络质量下降: %s → %s" % [
				_quality_name(old_quality), _quality_name(new_quality)
			]
			warning_emitted.emit(msg)
			print("[网络] ", msg)

## 重置所有统计
func reset() -> void:
	_latency_history.clear()
	_packets_sent = 0
	_packets_lost = 0
	_current_quality = Quality.GOOD
	_jitter = 0.0

# ── 内部方法 ──

func _evaluate_quality(latency: float, loss: float) -> Quality:
	if latency > 300.0 or loss > 0.10:
		return Quality.CRITICAL
	if latency > 150.0 or loss > 0.05:
		return Quality.POOR
	if latency > 50.0 or loss > 0.01:
		return Quality.FAIR
	return Quality.GOOD

func _quality_name(q: Quality) -> String:
	match q:
		Quality.GOOD: return "优秀"
		Quality.FAIR: return "良好"
		Quality.POOR: return "较差"
		Quality.CRITICAL: return "极差"
	return "未知"
