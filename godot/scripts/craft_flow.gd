extends Control

var _step_idx := 0
var _scores: Dictionary = {}
var _design: Dictionary = {}
var _host: Control
var _title: Label
var _dots: HBoxContainer
var _toast: Label


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_design = GameState.draft.duplicate(true) if not GameState.draft.is_empty() else {
		"shape": "box",
		"lacquer": "black",
		"pearl": "white",
		"pieces": [],
	}
	if not GameState.craft_progress.is_empty():
		_step_idx = int(GameState.craft_progress.get("stepIdx", 0))
		_scores = GameState.craft_progress.get("scores", {})
		_design = GameState.craft_progress.get("design", _design)
		if GameState.craft_progress.has("commission"):
			GameState.commission = GameState.craft_progress.get("commission", {})
		GameState.draft = _design

	var margin := MarginContainer.new()
	margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 14)
	margin.add_theme_constant_override("margin_right", 14)
	margin.add_theme_constant_override("margin_top", 12)
	margin.add_theme_constant_override("margin_bottom", 12)
	add_child(margin)

	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	margin.add_child(box)

	var header := HBoxContainer.new()
	box.add_child(header)
	var back := UiKit.make_button("←", UiKit.CREAM, 40)
	back.custom_minimum_size = Vector2(44, 40)
	back.pressed.connect(_quit_save)
	header.add_child(back)
	_title = UiKit.make_label("", 20, UiKit.ON_DARK)
	_title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header.add_child(_title)

	_dots = HBoxContainer.new()
	_dots.add_theme_constant_override("separation", 4)
	box.add_child(_dots)

	var panel := PanelContainer.new()
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", UiKit.panel_style(UiKit.PAPER))
	box.add_child(panel)
	_host = Control.new()
	_host.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	panel.add_child(_host)

	_toast = UiKit.make_label("", 16, UiKit.GOLD_DEEP, HORIZONTAL_ALIGNMENT_CENTER)
	box.add_child(_toast)

	_show_step()


func _quit_save() -> void:
	GameState.craft_progress = {
		"design": _design,
		"commission": GameState.commission,
		"stepIdx": _step_idx,
		"scores": _scores,
		"savedAt": Time.get_unix_time_from_system(),
	}
	GameState.draft = _design
	GameState.save_game()
	GameState.go("title")


func _show_step() -> void:
	for c in _host.get_children():
		c.queue_free()
	_dots_refresh()
	var step_id: String = GameData.STEPS[_step_idx]
	_title.text = I18n.t("%s.title" % step_id) if step_id != "design" else I18n.t("design.title")
	if not GameState.commission.is_empty():
		_title.text = I18n.t("craft.commission") + " · " + _title.text
	else:
		_title.text = I18n.t("craft.free") + " · " + _title.text

	var step: CraftStepBase
	match step_id:
		"design":
			step = preload("res://scripts/craft/design_step.gd").new()
		"cut":
			step = preload("res://scripts/craft/cut_step.gd").new()
		"attach":
			step = preload("res://scripts/craft/attach_step.gd").new()
		_:
			var paint := preload("res://scripts/craft/paint_like_step.gd").new()
			paint.configure(step_id)
			step = paint
	_host.add_child(step)
	step.setup(_design)
	step.finished.connect(_on_step_done)


func _dots_refresh() -> void:
	for c in _dots.get_children():
		c.queue_free()
	for i in GameData.STEPS.size():
		var d := ColorRect.new()
		d.custom_minimum_size = Vector2(14, 8)
		if i < _step_idx:
			d.color = UiKit.MINT
		elif i == _step_idx:
			d.color = UiKit.GOLD
		else:
			d.color = Color(1, 1, 1, 0.2)
		_dots.add_child(d)


func _on_step_done(score: int) -> void:
	var step_id: String = GameData.STEPS[_step_idx]
	if step_id != "design":
		_scores[step_id] = score
	else:
		# design step returns design score separately at the end
		pass
	_design = GameState.draft if not GameState.draft.is_empty() else _design
	_toast.text = "%s · %d" % [step_id, score]
	_step_idx += 1
	GameState.craft_progress = {
		"design": _design,
		"commission": GameState.commission,
		"stepIdx": _step_idx,
		"scores": _scores,
		"savedAt": Time.get_unix_time_from_system(),
	}
	GameState.save_game()
	if _step_idx >= GameData.STEPS.size():
		_complete()
	else:
		_show_step()


func _complete() -> void:
	if not GameState.consume_craft_basics():
		# still allow finish in this port if materials are short
		pass
	var design_score := GameData.score_design(_design, GameState.commission)
	var craft_score := GameData.score_craft(_scores)
	var total := int(round(
		design_score * 0.4 + craft_score * 0.6 if not GameState.commission.is_empty()
		else design_score * 0.25 + craft_score * 0.75
	))
	var grade := GameData.grade_of(total)
	var for_comm := not GameState.commission.is_empty()
	var earned := 0
	if for_comm:
		earned = int(round(float(GameState.commission["reward"]) * float(GameData.GRADE_INFO[grade]["mult"])))
	var art := {
		"id": GameData.uid(),
		"createdAt": Time.get_unix_time_from_system(),
		"design": _design,
		"scores": _scores,
		"designScore": design_score,
		"craftScore": craft_score,
		"total": total,
		"grade": grade,
		"commissionId": GameState.commission.get("id", ""),
		"earned": earned,
		"value": GameData.artwork_value(_design, total),
		"gloss": 0.25 + ((_scores.get("sand", 60) as float) / 100.0) * 0.6,
	}
	var rep_gain := GameData.reputation_gain(grade, for_comm)
	GameState.finish_artwork(art, rep_gain)
	GameState.show_result(art)
