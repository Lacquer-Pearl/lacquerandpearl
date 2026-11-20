extends CraftStepBase

var _pieces_label: Label
var _preview: SubViewportContainer
var _piece_3d: Node


func setup(d: Dictionary) -> void:
	super.setup(d)
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var box := VBoxContainer.new()
	box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	box.add_theme_constant_override("separation", 10)
	add_child(box)
	box.add_child(UiKit.make_label(I18n.t("design.tip"), 14, UiKit.BROWN_LIGHT))

	_preview = _make_preview()
	_preview.custom_minimum_size = Vector2(0, 200)
	box.add_child(_preview)

	box.add_child(UiKit.make_label("Shape", 13, UiKit.BROWN_LIGHT))
	box.add_child(_choice_row(GameData.SHAPES.keys(), func(id):
		design["shape"] = id
		_refresh_preview()
	, str(design.get("shape", "box"))))

	box.add_child(UiKit.make_label("Lacquer", 13, UiKit.BROWN_LIGHT))
	box.add_child(_choice_row(GameData.LACQUERS.keys(), func(id):
		design["lacquer"] = id
		_refresh_preview()
	, str(design.get("lacquer", "black"))))

	box.add_child(UiKit.make_label("Pearl", 13, UiKit.BROWN_LIGHT))
	box.add_child(_choice_row(GameData.PEARLS.keys(), func(id):
		design["pearl"] = id
	, str(design.get("pearl", "white"))))

	var add_row := HBoxContainer.new()
	add_row.add_theme_constant_override("separation", 8)
	box.add_child(add_row)
	for m in GameData.MOTIFS.keys():
		var name_key := "name_ko" if I18n.lang() == "ko" else "name_en"
		var b := UiKit.make_button(str(GameData.MOTIFS[m][name_key]), UiKit.MINT, 40)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var motif_id := str(m)
		b.pressed.connect(func():
			var pieces: Array = design.get("pieces", [])
			pieces.append({
				"id": GameData.uid(),
				"motif": motif_id,
				"pearl": design.get("pearl", "white"),
				"x": 120 + randi() % 60,
				"y": 120 + randi() % 60,
			})
			design["pieces"] = pieces
			_update_pieces()
		)
		add_row.add_child(b)

	_pieces_label = UiKit.make_label("", 14)
	box.add_child(_pieces_label)
	_update_pieces()

	var done := UiKit.make_button(I18n.t("craft.next"), UiKit.PINK, 52)
	done.pressed.connect(func():
		GameState.draft = design.duplicate(true)
		emit_done(GameData.score_design(design, GameState.commission))
	)
	box.add_child(done)


func _choice_row(ids: Array, on_pick: Callable, current: String) -> HBoxContainer:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 6)
	for id in ids:
		var label := str(id)
		if GameData.SHAPES.has(id):
			label = GameData.SHAPES[id]["name_ko" if I18n.lang() == "ko" else "name_en"]
		elif GameData.LACQUERS.has(id):
			label = GameData.LACQUERS[id]["name_ko" if I18n.lang() == "ko" else "name_en"]
		elif GameData.PEARLS.has(id):
			label = GameData.PEARLS[id]["name_ko" if I18n.lang() == "ko" else "name_en"]
		var b := UiKit.make_button(label, UiKit.GOLD if id == current else UiKit.CREAM, 38)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var picked := str(id)
		b.pressed.connect(func(): on_pick.call(picked))
		row.add_child(b)
	return row


func _update_pieces() -> void:
	var pieces: Array = design.get("pieces", [])
	_pieces_label.text = I18n.t("design.add") + " · %d" % pieces.size()


func _refresh_preview() -> void:
	if _piece_3d and _piece_3d.has_method("apply_look"):
		_piece_3d.apply_look(str(design.get("shape", "box")), str(design.get("lacquer", "black")), 0.3)


func _make_preview() -> SubViewportContainer:
	var wrap := SubViewportContainer.new()
	wrap.stretch = true
	var vp := SubViewport.new()
	vp.size = Vector2i(460, 200)
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	wrap.add_child(vp)
	var world := Node3D.new()
	vp.add_child(world)
	var cam := Camera3D.new()
	cam.look_at_from_position(Vector3(0, 0.85, 2.1), Vector3.ZERO)
	world.add_child(cam)
	_piece_3d = load("res://scenes/workshop/workshop_piece.tscn").instantiate()
	world.add_child(_piece_3d)
	call_deferred("_refresh_preview")
	return wrap
