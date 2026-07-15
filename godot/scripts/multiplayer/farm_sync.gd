## 农场状态同步
##
## 同步地块状态变化（翻地/播种/浇水/生长/收获）。
## 使用 @rpc 可靠传输，事件触发式同步（非轮询）。
extends Node
class_name FarmSync

## 所有地块数据（仅在主机端维护完整状态）
var _plots: Dictionary = {}  ## {plot_key: {x, y, crop_id, growth_progress, watered, fertilized, ...}}

## 地块键格式 "x,y"
func _plot_key(x: int, y: int) -> String:
	return "%d,%d" % [x, y]

## 获取所有地块（供快照使用）
func get_all_plots() -> Array:
	var result: Array = []
	for key in _plots:
		result.append(_plots[key])
	return result

## 从快照恢复地块状态
func restore_from_snapshot(plots: Array) -> void:
	_plots.clear()
	for plot in plots:
		var key := _plot_key(plot.x, plot.y)
		_plots[key] = plot

# ── 主机端操作 ──

## 翻地（主机端执行后广播）
func till_plot(x: int, y: int, player_id: int) -> void:
	var key := _plot_key(x, y)
	if _plots.has(key):
		return
	_plots[key] = {
		"x": x, "y": y,
		"crop_id": null,
		"growth_progress": 0.0,
		"watered": false,
		"fertilized": false,
		"fertilizer_type": null,
		"regrowing": false,
	}
	_broadcast_farming_action.rpc(x, y, "till", {})

## 播种（主机端执行后广播）
func plant_seed(x: int, y: int, seed_id: String) -> void:
	var key := _plot_key(x, y)
	if not _plots.has(key):
		return
	_plots[key].crop_id = seed_id
	_plots[key].growth_progress = 0.0
	_plots[key].watered = true
	_broadcast_farming_action.rpc(x, y, "plant", {"seed_id": seed_id})

## 浇水（主机端执行后广播）
func water_plot(x: int, y: int) -> void:
	var key := _plot_key(x, y)
	if not _plots.has(key):
		return
	_plots[key].watered = true
	_broadcast_farming_action.rpc(x, y, "water", {})

## 收获（主机端执行后广播）
func harvest_plot(x: int, y: int, quality: String) -> void:
	var key := _plot_key(x, y)
	if not _plots.has(key):
		return
	var plot := _plots[key]
	var crop_id := plot.crop_id
	if crop_id == null:
		return
	_plots.erase(key)
	_broadcast_farming_action.rpc(x, y, "harvest", {"crop_id": crop_id, "quality": quality})

## 生长推进（每日结束时主机端调用）
func advance_growth() -> void:
	for key in _plots:
		var plot := _plots[key]
		if plot.crop_id == null or not plot.watered:
			continue
		plot.growth_progress = min(1.0, plot.growth_progress + 0.25)
		plot.watered = false

## 全部浇水（雨天/洒水器调用）
func water_all() -> void:
	for key in _plots:
		_plots[key].watered = true
	_broadcast_water_all.rpc()

# ── RPC 广播 ──

@rpc("authority", "reliable")
func _broadcast_farming_action(x: int, y: int, action: String, data: Dictionary) -> void:
	# 客户端更新本地地块状态
	match action:
		"till":
			var key := _plot_key(x, y)
			_plots[key] = {"x": x, "y": y, "crop_id": null, "growth_progress": 0.0, "watered": false, "fertilized": false, "fertilizer_type": null, "regrowing": false}
		"plant":
			var key := _plot_key(x, y)
			if _plots.has(key):
				_plots[key].crop_id = data.get("seed_id", "")
				_plots[key].growth_progress = 0.0
				_plots[key].watered = true
		"water":
			var key := _plot_key(x, y)
			if _plots.has(key):
				_plots[key].watered = true
		"harvest":
			var key := _plot_key(x, y)
			_plots.erase(key)

@rpc("authority", "reliable")
func _broadcast_water_all() -> void:
	for key in _plots:
		_plots[key].watered = true