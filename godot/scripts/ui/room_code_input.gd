## 4位房间码输入组件
##
## 支持自动校验位验证、仅允许数字输入、最多4位。
## 信号 code_valid 在校验通过时发射，code_invalid 在格式错误时发射。
extends LineEdit
class_name RoomCodeInput

signal code_valid(code: String, check_digit: int)
signal code_invalid(reason: String)

## 是否显示校验位验证
@export var enable_check_digit: bool = true

## 输入框最大字符数
const MAX_DIGITS: int = 4

func _ready() -> void:
	max_length = MAX_DIGITS
	placeholder_text = "输入4位房间码"
	editable = true
	select_all_on_focus = true
	text_changed.connect(_on_text_changed)

## 验证当前输入的房间码
func validate() -> void:
	var code := text.strip_edges()
	if code.length() != MAX_DIGITS:
		code_invalid.emit("房间码需要4位数字")
		return
	if not code.is_valid_int():
		code_invalid.emit("房间码只能包含数字")
		return
	if enable_check_digit:
		var cd := NetworkConfig.compute_check_digit(code)
		code_valid.emit(code, cd)
	else:
		code_valid.emit(code, -1)

## 获取格式化的房间码显示（带校验位）
func get_formatted_code() -> String:
	var code := text.strip_edges()
	if code.length() != MAX_DIGITS:
		return code
	var cd := NetworkConfig.compute_check_digit(code)
	return "%s-%d" % [code, cd]

## 清除输入
func clear_input() -> void:
	text = ""
	grab_focus()

func _on_text_changed(new_text: String) -> void:
	# 过滤非数字字符
	var filtered := ""
	for ch in new_text:
		if ch >= "0" and ch <= "9":
			filtered += ch
	if filtered != new_text:
		text = filtered
		caret_column = filtered.length()
	# 自动校验
	if filtered.length() == MAX_DIGITS:
		validate()
	else:
		code_invalid.emit("")

func _on_text_submitted(_new_text: String) -> void:
	validate()