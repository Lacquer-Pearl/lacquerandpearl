extends Node3D

@onready var mesh_instance: MeshInstance3D = $MeshInstance3D

var shape_id: String = "box"
var lacquer_id: String = "black"
var gloss: float = 0.35


func _ready() -> void:
	apply_look(shape_id, lacquer_id, gloss)


func apply_look(shape: String, lacquer: String, gloss_amount: float = 0.35) -> void:
	shape_id = shape
	lacquer_id = lacquer
	gloss = gloss_amount
	if mesh_instance == null:
		return
	match shape:
		"mirror":
			var cyl := CylinderMesh.new()
			cyl.top_radius = 0.55
			cyl.bottom_radius = 0.55
			cyl.height = 0.08
			mesh_instance.mesh = cyl
		"tray":
			var prism := PrismMesh.new()
			prism.size = Vector3(1.2, 0.08, 1.2)
			mesh_instance.mesh = prism
		"round":
			var sphere := SphereMesh.new()
			sphere.radius = 0.55
			sphere.height = 0.45
			mesh_instance.mesh = sphere
		_:
			var box := BoxMesh.new()
			box.size = Vector3(1.1, 0.35, 0.8)
			mesh_instance.mesh = box
	var mat := StandardMaterial3D.new()
	var lac: Dictionary = GameData.LACQUERS.get(lacquer, GameData.LACQUERS["black"])
	mat.albedo_color = lac["color"]
	mat.metallic = 0.15
	mat.roughness = clampf(1.0 - gloss_amount, 0.12, 0.85)
	mat.specular_mode = BaseMaterial3D.SPECULAR_SCHLICK_GGX
	mesh_instance.material_override = mat


func _process(delta: float) -> void:
	rotate_y(delta * 0.35)
