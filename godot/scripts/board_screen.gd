extends Control


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	GameState.ensure_commissions()
	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 16)
	margin.add_theme_constant_override("margin_right", 16)
	margin.add_theme_constant_override("margin_top", 16)
	margin.add_theme_constant_override("margin_bottom", 16)
	add_child(margin)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 12)
	margin.add_child(box)

	var header := HBoxContainer.new()
	box.add_child(header)
	var back := UiKit.make_button("←", UiKit.CREAM, 40)
	back.custom_minimum_size = Vector2(48, 40)
	back.pressed.connect(func(): GameState.go("title"))
	header.add_child(back)
	var title := UiKit.make_label(I18n.t("board.title"), 22, UiKit.ON_DARK)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	var refresh := UiKit.make_button(I18n.t("board.refresh"), UiKit.GOLD, 40)
	refresh.pressed.connect(func():
		GameState.refresh_commissions()
		GameState.go("board")
	)
	header.add_child(refresh)

	var scroll := UiKit.scroll_body()
	box.add_child(scroll)
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 12)
	scroll.add_child(list)

	for c in GameState.commissions:
		list.add_child(_card(c))


func _card(c: Dictionary) -> PanelContainer:
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", UiKit.panel_style())
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	panel.add_child(box)
	var name := c["name_ko"] if I18n.lang() == "ko" else c["name_en"]
	box.add_child(UiKit.make_label(str(name), 18))
	var line := c["line_ko"] if I18n.lang() == "ko" else c["line_en"]
	box.add_child(UiKit.make_label(str(line), 14, UiKit.BROWN_LIGHT))
	var shape: String = c["shape"]
	var lacquer: String = c["lacquer"]
	var shape_name: String = GameData.SHAPES[shape]["name_ko" if I18n.lang() == "ko" else "name_en"]
	var lac_name: String = GameData.LACQUERS[lacquer]["name_ko" if I18n.lang() == "ko" else "name_en"]
	var motif_bits: PackedStringArray = []
	for m in c.get("motifs", {}).keys():
		var mn: String = GameData.MOTIFS[m]["name_ko" if I18n.lang() == "ko" else "name_en"]
		motif_bits.append("%s×%s" % [mn, c["motifs"][m]])
	box.add_child(UiKit.make_label("%s · %s · %s" % [shape_name, lac_name, ", ".join(motif_bits)], 13))
	var row := HBoxContainer.new()
	box.add_child(row)
	var reward := UiKit.make_label("%s 🪙 %s" % [I18n.t("board.reward"), c["reward"]], 16, UiKit.GOLD_DEEP)
	reward.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(reward)
	var accept := UiKit.make_button(I18n.t("board.accept"), UiKit.PINK, 42)
	accept.pressed.connect(func(): GameState.start_craft(c))
	row.add_child(accept)
	return panel
