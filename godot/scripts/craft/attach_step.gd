extends CraftStepBase

var _targets: Array[Vector2] = []
var _placed: Array[Vector2] = []
var _dragging := -1
var _canvas: Control
var _label: Label


func setup(d: Dictionary) -> void:
	super.setup(d)
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var pieces: Array = d.get("pieces", [])
	if pieces.is_empty():
		pieces = [{"motif": "plum"}, {"motif": "crane"}]
	for i in pieces.size():
		var ang := float(i) / float(maxi(pieces.size(), 1)) * TAU
		_targets.append(Vector2(0.5 + cos(ang) * 0.25, 0.5 + sin(ang) * 0.22))
		_placed.append(Vector2(0.15 + (i % 3) * 0.12, 0.82))
	var box := VBoxContainer.new()
	box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(box)
	_label = UiKit.make_label(I18n.t("attach.tip"), 14, UiKit.BROWN_LIGHT)
	box.add_child(_label)
	_canvas = Control.new()
	_canvas.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_canvas.custom_minimum_size = Vector2(0, 320)
	_canvas.gui_input.connect(_on_input)
	_canvas.draw.connect(_on_draw)
	box.add_child(_canvas)
	var done := UiKit.make_button(I18n.t("craft.done"), UiKit.PINK, 52)
	done.pressed.connect(func(): emit_done(_score()))
	box.add_child(done)


func _on_input(event: InputEvent) -> void:
	var pos := Vector2.ZERO
	var pressed := false
	var released := false
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		pos = event.position
		pressed = event.pressed
		released = not event.pressed
	elif event is InputEventScreenTouch:
		pos = event.position
		pressed = event.pressed
		released = not event.pressed
	elif event is InputEventMouseMotion or event is InputEventScreenDrag:
		if _dragging >= 0:
			_placed[_dragging] = Vector2(event.position.x / _canvas.size.x, event.position.y / _canvas.size.y)
			_canvas.queue_redraw()
		return
	if pressed:
		_dragging = _hit(pos)
	if released:
		_dragging = -1
		_canvas.queue_redraw()


func _hit(pos: Vector2) -> int:
	var size := _canvas.size
	for i in range(_placed.size()):
		var p := Vector2(_placed[i].x * size.x, _placed[i].y * size.y)
		if p.distance_to(pos) < 28:
			return i
	return -1


func _score() -> int:
	var sum := 0.0
	for i in _targets.size():
		var d := _placed[i].distance_to(_targets[i])
		sum += maxf(0.0, 1.0 - d / 0.25)
	var avg := sum / float(maxi(_targets.size(), 1))
	return clampi(int(round(avg * 100.0)), 20, 100)


func _on_draw() -> void:
	var size := _canvas.size
	_canvas.draw_rect(Rect2(Vector2.ZERO, size), Color("#3a2a1c"))
	var lac: Color = GameData.LACQUERS.get(design.get("lacquer", "black"), GameData.LACQUERS["black"])["color"]
	_canvas.draw_rect(Rect2(size * 0.15, size * 0.7), lac)
	for t in _targets:
		var p := Vector2(t.x * size.x, t.y * size.y)
		_canvas.draw_circle(p, 16, Color(1, 1, 1, 0.25))
	var pearl: Color = GameData.PEARLS.get(design.get("pearl", "white"), GameData.PEARLS["white"])["color"]
	for p in _placed:
		var q := Vector2(p.x * size.x, p.y * size.y)
		_canvas.draw_circle(q, 18, pearl)
