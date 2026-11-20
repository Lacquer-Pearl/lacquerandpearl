extends Control

const SURVEY := {
	"ko": "https://forms.gle/s8UeDQ21n7m3Ug6V8",
	"en": "https://forms.gle/RU2RqV5x2B5sc5nM7",
}


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var art: Dictionary = GameState.last_artwork
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

	box.add_child(UiKit.make_label(I18n.t("result.title"), 28, UiKit.GOLD, HORIZONTAL_ALIGNMENT_CENTER))

	var preview := _preview(art)
	preview.custom_minimum_size = Vector2(0, 220)
	box.add_child(preview)

	var grade: String = str(art.get("grade", "B"))
	var seal := UiKit.make_label(grade, 42, GameData.GRADE_INFO[grade]["color"], HORIZONTAL_ALIGNMENT_CENTER)
	box.add_child(seal)

	var panel := PanelContainer.new()
	panel.add_theme_stylebox_override("panel", UiKit.panel_style())
	box.add_child(panel)
	var info := VBoxContainer.new()
	panel.add_child(info)
	info.add_child(UiKit.make_label("%s %s" % [I18n.t("result.total"), art.get("total", 0)], 18))
	info.add_child(UiKit.make_label("%s %s" % [I18n.t("result.design"), art.get("designScore", 0)], 15))
	info.add_child(UiKit.make_label("%s %s" % [I18n.t("result.craft"), art.get("craftScore", 0)], 15))
	var rep := GameData.reputation_gain(grade, str(art.get("commissionId", "")) != "")
	info.add_child(UiKit.make_label("%s +%s" % [I18n.t("result.repGain"), rep], 15))
	if int(art.get("earned", 0)) > 0:
		info.add_child(UiKit.make_label("🪙 +%s" % art["earned"], 18, UiKit.GOLD_DEEP))

	if str(art.get("commissionId", "")) != "":
		var next_btn := UiKit.make_button(I18n.t("result.next"), UiKit.PINK, 50)
		next_btn.pressed.connect(func(): GameState.go("board"))
		box.add_child(next_btn)

	var home := UiKit.make_button(I18n.t("result.home"), UiKit.CREAM, 50)
	home.pressed.connect(func(): GameState.go("title"))
	box.add_child(home)

	if not GameState.survey_claimed:
		call_deferred("_show_survey")


func _show_survey() -> void:
	var dlg := AcceptDialog.new()
	dlg.title = "Survey" if I18n.lang() == "en" else "설문"
	dlg.dialog_text = (
		"Take the survey for 100 coins."
		if I18n.lang() == "en"
		else "설문에 참여하면 엽전 100개를 드려요."
	)
	dlg.ok_button_text = "Open +100" if I18n.lang() == "en" else "설문 열고 +100"
	add_child(dlg)
	dlg.confirmed.connect(func():
		OS.shell_open(SURVEY[I18n.lang()])
		GameState.claim_survey_reward()
	)
	dlg.popup_centered()


func _preview(art: Dictionary) -> SubViewportContainer:
	var wrap := SubViewportContainer.new()
	wrap.stretch = true
	var vp := SubViewport.new()
	vp.size = Vector2i(460, 220)
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	wrap.add_child(vp)
	var world := Node3D.new()
	vp.add_child(world)
	var cam := Camera3D.new()
	cam.look_at_from_position(Vector3(0, 0.9, 2.2), Vector3.ZERO)
	world.add_child(cam)
	var piece = load("res://scenes/workshop/workshop_piece.tscn").instantiate()
	world.add_child(piece)
	var design: Dictionary = art.get("design", {})
	piece.call_deferred(
		"apply_look",
		str(design.get("shape", "box")),
		str(design.get("lacquer", "black")),
		float(art.get("gloss", 0.4))
	)
	return wrap
