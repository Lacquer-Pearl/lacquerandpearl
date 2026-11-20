extends CraftStepBase
## Shared drag-to-cover minigame for cloth/lacquer/fill/sand/iron/peel

var _mode: String = "lacquer"
var _cover := 0.0
var _ink := 0.0
var _cells: PackedFloat32Array
var _grid := 12
var _canvas: Control
var _meter: ProgressBar
var _ink_bar: ProgressBar
var _drawing := false
var _last := Vector2.ZERO
var _over := 0.0


func configure(mode: String) -> void:
	_mode = mode


func setup(d: Dictionary) -> void:
	super.setup(d)
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_cells.resize(_grid * _grid)
	_cells.fill(0.0)
	var box := VBoxContainer.new()
	box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	box.add_theme_constant_override("separation", 8)
	add_child(box)
	box.add_child(UiKit.make_label(I18n.t("%s.tip" % _mode), 14, UiKit.BROWN_LIGHT))

	if _mode == "lacquer":
		var dip := UiKit.make_button(I18n.t("lacquer.dip"), UiKit.GOLD, 44)
		dip.pressed.connect(func():
			_ink = 1.0
			_ink_bar.value = 100
		)
		box.add_child(dip)
		_ink_bar = ProgressBar.new()
		_ink_bar.max_value = 100
		_ink_bar.value = 0
		_ink_bar.custom_minimum_size = Vector2(0, 18)
		box.add_child(_ink_bar)
		_ink = 0.0

	_canvas = Control.new()
	_canvas.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_canvas.custom_minimum_size = Vector2(0, 280)
	_canvas.mouse_filter = Control.MOUSE_FILTER_STOP
	_canvas.draw.connect(_on_draw)
	_canvas.gui_input.connect(_on_input)
	box.add_child(_canvas)

	_meter = ProgressBar.new()
	_meter.max_value = 100
	_meter.custom_minimum_size = Vector2(0, 20)
	box.add_child(_meter)

	var done := UiKit.make_button(I18n.t("craft.done"), UiKit.PINK, 52)
	done.pressed.connect(func(): emit_done(_score()))
	box.add_child(done)


func _on_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		_drawing = event.pressed
		_last = event.position
		if _drawing:
			_paint_at(event.position)
	elif event is InputEventScreenTouch:
		_drawing = event.pressed
		_last = event.position
		if _drawing:
			_paint_at(event.position)
	elif _drawing and (event is InputEventMouseMotion or event is InputEventScreenDrag):
		_paint_at(event.position)
		_last = event.position


func _paint_at(pos: Vector2) -> void:
	if _mode == "lacquer" and _ink < 0.03:
		return
	var size := _canvas.size
	if size.x <= 1 or size.y <= 1:
		return
	var gx := clampi(int(pos.x / size.x * _grid), 0, _grid - 1)
	var gy := clampi(int(pos.y / size.y * _grid), 0, _grid - 1)
	var idx := gy * _grid + gx
	var add := 0.18
	if _mode == "lacquer":
		add *= maxf(_ink, 0.05)
		_ink = maxf(0.0, _ink * 0.9887)
		if _ink_bar:
			_ink_bar.value = _ink * 100.0
	elif _mode == "dry":
		# humidity nudging feel: center band is good
		add = 0.08
	_cells[idx] = minf(2.2, _cells[idx] + add)
	if _cells[idx] > 1.7:
		_over += 0.01
	_recompute()
	_canvas.queue_redraw()


func _recompute() -> void:
	var touched := 0
	var good := 0
	for v in _cells:
		if v > 0.05:
			touched += 1
		if v >= 0.7 and v <= 1.6:
			good += 1
	_cover = float(touched) / float(_cells.size())
	progress = _cover
	_meter.value = _cover * 100.0


func _score() -> int:
	var touched := 0
	var good := 0
	for v in _cells:
		if v > 0.05:
			touched += 1
		if v >= 0.65 and v <= 1.55:
			good += 1
	var cover := float(touched) / float(_cells.size())
	var quality := float(good) / float(maxi(touched, 1))
	var base := cover * 70.0 + quality * 40.0 - _over * 25.0
	if _mode == "dry":
		base = 55.0 + cover * 40.0
	return clampi(int(round(base)), 20, 100)


func _on_draw() -> void:
	var size := _canvas.size
	var lac: Color = GameData.LACQUERS.get(design.get("lacquer", "black"), GameData.LACQUERS["black"])["color"]
	_canvas.draw_rect(Rect2(Vector2.ZERO, size), Color("#cbb58c"))
	var cw := size.x / _grid
	var ch := size.y / _grid
	for y in _grid:
		for x in _grid:
			var v := _cells[y * _grid + x]
			if v <= 0.01:
				continue
			var col := lac
			match _mode:
				"cloth":
					col = Color("#d8c3a0")
				"fill":
					col = lac.darkened(0.1)
				"sand":
					col = Color(1, 1, 1, 0.35)
				"iron":
					col = Color(1, 0.85, 0.55, 0.35)
				"peel":
					col = Color("#f4efe4")
				"dry":
					col = Color(0.55, 0.75, 0.9, 0.45)
			col.a = clampf(v * 0.55, 0.15, 0.95)
			_canvas.draw_rect(Rect2(x * cw, y * ch, cw + 1, ch + 1), col)
