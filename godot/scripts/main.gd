extends Control

const SCREENS := {
	"title": "res://scenes/title/title_screen.tscn",
	"board": "res://scenes/board/board_screen.tscn",
	"craft": "res://scenes/craft/craft_flow.tscn",
	"result": "res://scenes/result/result_screen.tscn",
	"shop": "res://scenes/shop/shop_screen.tscn",
	"gallery": "res://scenes/gallery/gallery_screen.tscn",
}

var _current: Node


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var bg := ColorRect.new()
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.color = Color("#170d07")
	add_child(bg)
	GameState.screen_changed.connect(_on_screen_changed)
	_on_screen_changed(GameState.screen)


func _on_screen_changed(screen: String) -> void:
	if _current:
		_current.queue_free()
		_current = null
	var path: String = SCREENS.get(screen, SCREENS["title"])
	var packed: PackedScene = load(path)
	_current = packed.instantiate()
	add_child(_current)
