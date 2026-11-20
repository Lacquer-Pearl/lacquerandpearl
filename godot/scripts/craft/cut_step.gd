extends CraftStepBase

var _path: PackedVector2Array
var _drawn: PackedVector2Array
var _canvas: Control
var _progress_bar: ProgressBar
var _drawing := false
var _cursor := 0
var _off := 0.0
var _scars: Array[PackedVector2Array] = []


func setup(d: Dictionary) -> void:
	super.setup(d)
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_build_path()
	var box := VBoxContainer.new()
	box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	box.add_theme_constant_override("separation", 8)
	add_child(box)
	box.add_child(UiKit.make_label(I18n.t("cut.tip"), 14, UiKit.BROWN_LIGHT))
	_canvas = Control.new()
	_canvas.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_canvas.custom_minimum_size = Vector2(0, 320)
	_canvas.gui_input.connect(_on_input)
	_canvas.draw.connect(_on_draw)
	box.add_child(_canvas)
	_progress_bar = ProgressBar.new()
	_progress_bar.max_value = 100
	box.add_child(_progress_bar)
	var done := UiKit.make_button(I18n.t("craft.done"), UiKit.PINK, 52)
	done.pressed.connect(func(): emit_done(_score()))
	box.add_child(done)


func _build_path() -> void:
	_path.clear()
	var n := 48
	for i in n:
		var t := float(i) / float(n - 1) * TAU
		var x := 0.5 + cos(t) * 0.32 + cos(t * 2.0) * 0.04
		var y := 0.5 + sin(t) * 0.28 + sin(t * 3.0) * 0.03
		_path.append(Vector2(x, y))


func _on_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_drawing = event.pressed
		if event.pressed:
			_sample(event.position)
		else:
			_flush_scar_if_bad()
	elif event is InputEventScreenTouch:
		_drawing = event.pressed
		if event.pressed:
			_sample(event.position)
		else:
			_flush_scar_if_bad()
	elif _drawing and (event is InputEventMouseMotion or event is InputEventScreenDrag):
		_sample(event.position)


func _sample(pos: Vector2) -> void:
	var size := _canvas.size
	if size.x < 2:
		return
	var p := Vector2(pos.x / size.x, pos.y / size.y)
	_drawn.append(p)
	var target: Vector2 = _path[mini(_cursor, _path.size() - 1)]
	var dist := p.distance_to(target)
	if dist < 0.08:
		_cursor = mini(_cursor + 1, _path.size() - 1)
	else:
		_off += dist
	progress = float(_cursor) / float(_path.size() - 1)
	_progress_bar.value = progress * 100.0
	_canvas.queue_redraw()


func _flush_scar_if_bad() -> void:
	if _off > 1.2 and _drawn.size() > 4:
		_scars.append(_drawn.duplicate())
	_drawn.clear()
	_off = 0.0
	_canvas.queue_redraw()


func _score() -> int:
	var follow := progress * 100.0
	var penalty := mini(40.0, _off * 8.0 + _scars.size() * 8.0)
	return clampi(int(round(follow - penalty + 15.0)), 15, 100)


func _on_draw() -> void:
	var size := _canvas.size
	_canvas.draw_rect(Rect2(Vector2.ZERO, size), Color("#2a2118"))
	# guide
	for i in range(_path.size() - 1):
		var a := Vector2(_path[i].x * size.x, _path[i].y * size.y)
		var b := Vector2(_path[i + 1].x * size.x, _path[i + 1].y * size.y)
		_canvas.draw_line(a, b, Color(1, 1, 1, 0.35), 2.0, true)
	for scar in _scars:
		for i in range(scar.size() - 1):
			var a := Vector2(scar[i].x * size.x, scar[i].y * size.y)
			var b := Vector2(scar[i + 1].x * size.x, scar[i + 1].y * size.y)
			_canvas.draw_line(a, b, Color(0.85, 0.35, 0.3, 0.7), 2.0, true)
	for i in range(_drawn.size() - 1):
		var a := Vector2(_drawn[i].x * size.x, _drawn[i].y * size.y)
		var b := Vector2(_drawn[i + 1].x * size.x, _drawn[i + 1].y * size.y)
		_canvas.draw_line(a, b, Color("#d6b46e"), 3.0, true)
