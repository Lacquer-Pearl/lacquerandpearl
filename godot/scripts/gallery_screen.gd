extends Control


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 16)
	margin.add_theme_constant_override("margin_right", 16)
	margin.add_theme_constant_override("margin_top", 16)
	margin.add_theme_constant_override("margin_bottom", 16)
	add_child(margin)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 10)
	margin.add_child(box)

	var header := HBoxContainer.new()
	box.add_child(header)
	var back := UiKit.make_button("←", UiKit.CREAM, 40)
	back.custom_minimum_size = Vector2(48, 40)
	back.pressed.connect(func(): GameState.go("title"))
	header.add_child(back)
	var title := UiKit.make_label(I18n.t("gallery.title"), 22, UiKit.ON_DARK)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)

	if GameState.gallery.is_empty():
		box.add_child(UiKit.make_label(I18n.t("gallery.empty"), 16, UiKit.ON_DARK, HORIZONTAL_ALIGNMENT_CENTER))
		return

	var scroll := UiKit.scroll_body()
	box.add_child(scroll)
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 8)
	scroll.add_child(list)
	for art in GameState.gallery:
		list.add_child(_card(art))


func _card(art: Dictionary) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", UiKit.panel_style())
	var row := HBoxContainer.new()
	panel.add_child(row)
	var grade := str(art.get("grade", "B"))
	var g := UiKit.make_label(grade, 28, GameData.GRADE_INFO[grade]["color"])
	g.custom_minimum_size = Vector2(48, 0)
	row.add_child(g)
	var info := VBoxContainer.new()
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(info)
	var design: Dictionary = art.get("design", {})
	var shape: String = design.get("shape", "box")
	var lacquer: String = design.get("lacquer", "black")
	var nk := "name_ko" if I18n.lang() == "ko" else "name_en"
	info.add_child(UiKit.make_label("%s %s" % [GameData.LACQUERS[lacquer][nk], GameData.SHAPES[shape][nk]], 15))
	info.add_child(UiKit.make_label("%s · 🪙 %s" % [art.get("total", 0), art.get("value", 0)], 13, UiKit.BROWN_LIGHT))
	return panel
