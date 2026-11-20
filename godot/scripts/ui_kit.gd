extends RefCounted
class_name UiKit

const CREAM := Color("#f6efe3")
const PAPER := Color("#fbf7f0")
const BROWN := Color("#3f2e24")
const BROWN_LIGHT := Color("#8b6f5a")
const GOLD := Color("#d6b46e")
const GOLD_DEEP := Color("#9c7a3a")
const PINK := Color("#d6a3a3")
const PINK_DEEP := Color("#9c5257")
const MINT := Color("#a9c6b4")
const UMBER := Color("#2b1b12")
const ON_DARK := Color("#f1e3c8")


static func panel_style(bg: Color = PAPER, border: Color = BROWN, radius: float = 18.0) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.border_color = border
	s.set_border_width_all(2)
	s.set_corner_radius_all(int(radius))
	s.content_margin_left = 14
	s.content_margin_right = 14
	s.content_margin_top = 12
	s.content_margin_bottom = 12
	s.shadow_color = Color(0, 0, 0, 0.25)
	s.shadow_size = 4
	s.shadow_offset = Vector2(0, 3)
	return s


static func button_style(bg: Color, border: Color = BROWN) -> StyleBoxFlat:
	var s := panel_style(bg, border, 16)
	s.shadow_size = 0
	s.content_margin_top = 10
	s.content_margin_bottom = 10
	return s


static func make_button(text: String, bg: Color = PINK, min_h: float = 48.0) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, min_h)
	b.add_theme_color_override("font_color", BROWN)
	b.add_theme_color_override("font_hover_color", BROWN)
	b.add_theme_color_override("font_pressed_color", BROWN)
	b.add_theme_font_size_override("font_size", 18)
	b.add_theme_stylebox_override("normal", button_style(bg))
	b.add_theme_stylebox_override("hover", button_style(bg.lightened(0.08)))
	b.add_theme_stylebox_override("pressed", button_style(bg.darkened(0.08)))
	b.add_theme_stylebox_override("disabled", button_style(Color(0.75, 0.7, 0.65)))
	return b


static func make_label(text: String, size: int = 16, color: Color = BROWN, align: HorizontalAlignment = HORIZONTAL_ALIGNMENT_LEFT) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.horizontal_alignment = align
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l


static func make_title(text: String) -> Label:
	return make_label(text, 28, BROWN, HORIZONTAL_ALIGNMENT_CENTER)


static func screen_root() -> Control:
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	return root


static func vbox(sep: int = 10) -> VBoxContainer:
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", sep)
	box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	return box


static func scroll_body() -> ScrollContainer:
	var sc := ScrollContainer.new()
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	return sc
