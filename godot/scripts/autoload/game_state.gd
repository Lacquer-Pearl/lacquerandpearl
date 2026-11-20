extends Node

signal money_changed(value: int)
signal screen_changed(screen: String)
signal language_changed

const SAVE_PATH := "user://lacquer_pearl_save.cfg"

var money: int = 150
var reputation: int = 0
var lang: String = "ko"
var inventory: Dictionary = {
	"wood": 2,
	"hemp": 2,
	"lacquer": 6,
	"glue": 2,
	"pearlWhite": 12,
	"pearlAbalone": 3,
}
var commissions: Array = []
var gallery: Array = []
var survey_claimed: bool = false

var screen: String = "title"
var commission: Dictionary = {}
var draft: Dictionary = {}
var last_artwork: Dictionary = {}
var craft_progress: Dictionary = {}


func _ready() -> void:
	load_game()
	ensure_commissions()


func go(next: String) -> void:
	screen = next
	screen_changed.emit(screen)


func start_craft(comm: Dictionary = {}) -> void:
	commission = comm.duplicate(true)
	draft = {
		"shape": commission.get("shape", "box"),
		"lacquer": commission.get("lacquer", "black") if not commission.is_empty() else "black",
		"pearl": commission.get("pearl", "white"),
		"pieces": [],
	}
	craft_progress = {}
	go("craft")


func show_result(art: Dictionary) -> void:
	last_artwork = art
	go("result")


func set_money(v: int) -> void:
	money = v
	money_changed.emit(money)


func add_money(delta: int) -> void:
	set_money(money + delta)


func buy(material_id: String) -> bool:
	if not GameData.MATERIALS.has(material_id):
		return false
	var def: Dictionary = GameData.MATERIALS[material_id]
	var price: int = def["price"]
	if money < price:
		return false
	set_money(money - price)
	inventory[material_id] = int(inventory.get(material_id, 0)) + int(def["pack"])
	save_game()
	return true


func consume_craft_basics() -> bool:
	var need := {"wood": 1, "hemp": 1, "lacquer": 3, "glue": 1}
	for k in need.keys():
		if int(inventory.get(k, 0)) < int(need[k]):
			return false
	for k in need.keys():
		inventory[k] = int(inventory[k]) - int(need[k])
	save_game()
	return true


func ensure_commissions() -> void:
	while commissions.size() < 3:
		commissions.append(GameData.make_commission(reputation))
	save_game()


func refresh_commissions() -> void:
	commissions.clear()
	ensure_commissions()


func finish_artwork(art: Dictionary, rep_gain: int) -> void:
	gallery.push_front(art)
	if gallery.size() > 60:
		gallery = gallery.slice(0, 60)
	add_money(int(art.get("earned", 0)))
	reputation += rep_gain
	var cid: String = str(art.get("commissionId", ""))
	if cid != "":
		commissions = commissions.filter(func(c): return str(c.get("id", "")) != cid)
	ensure_commissions()
	craft_progress = {}
	save_game()


func claim_survey_reward() -> bool:
	if survey_claimed:
		return false
	survey_claimed = true
	add_money(100)
	save_game()
	return true


func save_game() -> void:
	var cfg := ConfigFile.new()
	cfg.set_value("save", "money", money)
	cfg.set_value("save", "reputation", reputation)
	cfg.set_value("save", "lang", lang)
	cfg.set_value("save", "inventory", inventory)
	cfg.set_value("save", "commissions", commissions)
	cfg.set_value("save", "gallery", gallery)
	cfg.set_value("save", "survey_claimed", survey_claimed)
	cfg.set_value("save", "craft_progress", craft_progress)
	cfg.save(SAVE_PATH)


func load_game() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(SAVE_PATH) != OK:
		return
	money = int(cfg.get_value("save", "money", money))
	reputation = int(cfg.get_value("save", "reputation", reputation))
	lang = str(cfg.get_value("save", "lang", lang))
	inventory = cfg.get_value("save", "inventory", inventory)
	commissions = cfg.get_value("save", "commissions", commissions)
	gallery = cfg.get_value("save", "gallery", gallery)
	survey_claimed = bool(cfg.get_value("save", "survey_claimed", false))
	craft_progress = cfg.get_value("save", "craft_progress", {})


func reset_save() -> void:
	money = 150
	reputation = 0
	inventory = {
		"wood": 2,
		"hemp": 2,
		"lacquer": 6,
		"glue": 2,
		"pearlWhite": 12,
		"pearlAbalone": 3,
	}
	commissions = []
	gallery = []
	survey_claimed = false
	craft_progress = {}
	ensure_commissions()
	save_game()
