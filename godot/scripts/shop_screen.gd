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
	var title := UiKit.make_label(I18n.t("shop.title"), 22, UiKit.ON_DARK)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(title)
	header.add_child(UiKit.make_label("🪙 %s" % GameState.money, 16, UiKit.GOLD))

	var scroll := UiKit.scroll_body()
	box.add_child(scroll)
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 8)
	scroll.add_child(list)

	for id in GameData.MATERIALS.keys():
		list.add_child(_row(str(id)))


func _row(id: String) -> PanelContainer:
	var def: Dictionary = GameData.MATERIALS[id]
	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", UiKit.panel_style())
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	panel.add_child(row)
	var name_key := "name_ko" if I18n.lang() == "ko" else "name_en"
	var info := VBoxContainer.new()
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(info)
	info.add_child(UiKit.make_label(str(def[name_key]), 16))
	info.add_child(UiKit.make_label("🪙 %s · %s" % [def["price"], I18n.t("shop.owned", {"n": GameState.inventory.get(id, 0)})], 13, UiKit.BROWN_LIGHT))
	var buy := UiKit.make_button(I18n.t("shop.buy"), UiKit.GOLD, 42)
	buy.pressed.connect(func():
		if GameState.buy(id):
			GameState.go("shop")
	)
	row.add_child(buy)
	return panel
