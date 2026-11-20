extends Control


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 20)
	margin.add_theme_constant_override("margin_right", 20)
	margin.add_theme_constant_override("margin_top", 24)
	margin.add_theme_constant_override("margin_bottom", 24)
	add_child(margin)

	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 12)
	margin.add_child(box)

	var top := HBoxContainer.new()
	box.add_child(top)
	var rank := UiKit.make_label(GameData.rank_title(GameState.reputation, I18n.lang()), 14, UiKit.ON_DARK)
	rank.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(rank)
	var money := UiKit.make_label("🪙 %s" % GameState.money, 16, UiKit.GOLD)
	top.add_child(money)
	var lang_btn := UiKit.make_button("KO" if I18n.lang() == "ko" else "EN", UiKit.GOLD, 36)
	lang_btn.pressed.connect(func():
		I18n.set_lang("en" if I18n.lang() == "ko" else "ko")
		GameState.go("title")
	)
	top.add_child(lang_btn)

	var brand := UiKit.make_label("Lacquer & Pearl", 34, UiKit.GOLD, HORIZONTAL_ALIGNMENT_CENTER)
	box.add_child(brand)
	var sub := UiKit.make_label("래커앤펄 · 나전칠기 공방", 16, UiKit.ON_DARK, HORIZONTAL_ALIGNMENT_CENTER)
	box.add_child(sub)

	var preview := _make_preview()
	preview.custom_minimum_size = Vector2(0, 220)
	box.add_child(preview)

	var tip_panel := PanelContainer.new()
	tip_panel.add_theme_stylebox_override("panel", UiKit.panel_style(UiKit.PAPER))
	box.add_child(tip_panel)
	tip_panel.add_child(UiKit.make_label(I18n.t("title.welcome"), 15))

	var menu := VBoxContainer.new()
	menu.add_theme_constant_override("separation", 10)
	menu.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(menu)

	_add_menu(menu, I18n.t("title.commission"), UiKit.PINK, func(): GameState.go("board"))
	_add_menu(menu, I18n.t("title.free"), UiKit.MINT, func(): GameState.start_craft({}))
	_add_menu(menu, I18n.t("title.workshop"), UiKit.GOLD, func(): GameState.go("gallery"))
	_add_menu(menu, I18n.t("title.shop"), Color("#cbb58c"), func(): GameState.go("shop"))

	if not GameState.craft_progress.is_empty():
		_add_menu(menu, I18n.t("title.resume"), Color("#bdb4d3"), func(): GameState.go("craft"))


func _add_menu(parent: Node, text: String, color: Color, cb: Callable) -> void:
	var b := UiKit.make_button(text, color, 56)
	b.pressed.connect(cb)
	parent.add_child(b)


func _make_preview() -> SubViewportContainer:
	var wrap := SubViewportContainer.new()
	wrap.stretch = true
	var vp := SubViewport.new()
	vp.size = Vector2i(480, 220)
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	wrap.add_child(vp)
	var world := Node3D.new()
	vp.add_child(world)
	var cam := Camera3D.new()
	cam.look_at_from_position(Vector3(0, 0.9, 2.2), Vector3.ZERO)
	world.add_child(cam)
	var piece_scene: PackedScene = load("res://scenes/workshop/workshop_piece.tscn")
	var piece := piece_scene.instantiate()
	world.add_child(piece)
	return wrap
