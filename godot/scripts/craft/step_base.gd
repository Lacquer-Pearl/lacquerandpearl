extends Control
class_name CraftStepBase

signal finished(score: int)

var design: Dictionary = {}
var progress: float = 0.0


func setup(_design: Dictionary) -> void:
	design = _design


func emit_done(score: int = 70) -> void:
	finished.emit(clampi(score, 0, 100))
