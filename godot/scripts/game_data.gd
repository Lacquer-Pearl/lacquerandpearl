extends RefCounted
class_name GameData

const SHAPES := {
	"box": {"name_ko": "보석함", "name_en": "Jewelry box", "base": 120, "mesh": "box"},
	"mirror": {"name_ko": "손거울", "name_en": "Hand mirror", "base": 90, "mesh": "mirror"},
	"tray": {"name_ko": "팔각 쟁반", "name_en": "Octagon tray", "base": 140, "mesh": "tray"},
	"round": {"name_ko": "원형 다과합", "name_en": "Round box", "base": 110, "mesh": "round"},
}

const LACQUERS := {
	"black": {"name_ko": "흑칠", "name_en": "Black lacquer", "color": Color("#100e10")},
	"red": {"name_ko": "주칠", "name_en": "Red lacquer", "color": Color("#b4181e")},
	"gold": {"name_ko": "황칠", "name_en": "Gold lacquer", "color": Color("#b87c14")},
	"blue": {"name_ko": "청칠", "name_en": "Blue lacquer", "color": Color("#123c64")},
}

const MOTIFS := {
	"plum": {"name_ko": "매화", "name_en": "Plum", "cost": 1},
	"peony": {"name_ko": "모란", "name_en": "Peony", "cost": 1},
	"crane": {"name_ko": "학", "name_en": "Crane", "cost": 1},
	"cloud": {"name_ko": "구름", "name_en": "Cloud", "cost": 1},
	"wave": {"name_ko": "물결", "name_en": "Wave", "cost": 1},
	"lotus": {"name_ko": "연꽃", "name_en": "Lotus", "cost": 1},
}

const PEARLS := {
	"white": {"name_ko": "진주패", "name_en": "White nacre", "bonus": 1.0, "color": Color("#e8e4dc")},
	"abalone": {"name_ko": "전복패", "name_en": "Abalone", "bonus": 1.35, "color": Color("#86b3ad")},
	"black": {"name_ko": "흑진주패", "name_en": "Black pearl", "bonus": 1.55, "color": Color("#4e4843")},
	"paua": {"name_ko": "판자개", "name_en": "Paua", "bonus": 1.75, "color": Color("#2f6170")},
}

const MATERIALS := {
	"wood": {"name_ko": "백골", "name_en": "Wood form", "price": 30, "pack": 1},
	"hemp": {"name_ko": "삼베", "name_en": "Hemp cloth", "price": 12, "pack": 1},
	"lacquer": {"name_ko": "생옻칠", "name_en": "Lacquer", "price": 18, "pack": 1},
	"glue": {"name_ko": "아교", "name_en": "Glue", "price": 10, "pack": 1},
	"pearlWhite": {"name_ko": "진주패 자개", "name_en": "White nacre", "price": 25, "pack": 5},
	"pearlAbalone": {"name_ko": "전복패 자개", "name_en": "Abalone nacre", "price": 50, "pack": 5},
}

const STEPS := ["design", "cloth", "lacquer", "dry", "cut", "attach", "iron", "peel", "fill", "sand"]

const STEP_WEIGHT := {
	"cloth": 0.8,
	"lacquer": 1.3,
	"dry": 1.0,
	"cut": 1.3,
	"attach": 1.2,
	"iron": 0.8,
	"peel": 0.7,
	"fill": 1.0,
	"sand": 1.4,
}

const GRADE_INFO := {
	"S": {"color": Color("#a8433b"), "rep": 40, "mult": 1.5},
	"A": {"color": Color("#a65f62"), "rep": 25, "mult": 1.2},
	"B": {"color": Color("#5b8a74"), "rep": 14, "mult": 1.0},
	"C": {"color": Color("#66789a"), "rep": 6, "mult": 0.75},
	"D": {"color": Color("#8c8079"), "rep": 1, "mult": 0.45},
}

const RANKS := [
	{"rep": 0, "ko": "견습 장인", "en": "Apprentice"},
	{"rep": 60, "ko": "공방 장인", "en": "Workshop artisan"},
	{"rep": 180, "ko": "솜씨 좋은 장인", "en": "Skilled artisan"},
	{"rep": 400, "ko": "이름난 명장", "en": "Renowned master"},
	{"rep": 800, "ko": "국가무형유산 장인", "en": "Living treasure"},
]

static func uid() -> String:
	return "%x" % (Time.get_ticks_msec() ^ randi())


static func grade_of(total: int) -> String:
	if total >= 90:
		return "S"
	if total >= 78:
		return "A"
	if total >= 62:
		return "B"
	if total >= 45:
		return "C"
	return "D"


static func score_craft(scores: Dictionary) -> int:
	var sum := 0.0
	var w := 0.0
	for k in scores.keys():
		var weight: float = STEP_WEIGHT.get(k, 1.0)
		sum += float(scores[k]) * weight
		w += weight
	return 0 if w == 0.0 else int(round(sum / w))


static func score_design(design: Dictionary, commission: Dictionary = {}) -> int:
	var pieces: Array = design.get("pieces", [])
	if commission.is_empty():
		var n := pieces.size()
		var kinds := {}
		for p in pieces:
			kinds[p.get("motif", "plum")] = true
		return int(round(mini(1.0, n / 6.0) * 45.0 + mini(1.0, kinds.size() / 3.0) * 30.0 + 25.0))
	var required := 0
	var inter := 0
	var counts := {}
	for p in pieces:
		var m: String = p.get("motif", "plum")
		counts[m] = int(counts.get(m, 0)) + 1
	var motifs: Dictionary = commission.get("motifs", {})
	for m in motifs.keys():
		var need := int(motifs[m])
		required += need
		inter += mini(need, int(counts.get(m, 0)))
	var motif_match := 1.0 if required == 0 else float(inter) / float(required)
	var color_match := 1.0 if design.get("lacquer") == commission.get("lacquer") else 0.0
	return int(round(motif_match * 70.0 + color_match * 20.0 + 10.0))


static func artwork_value(design: Dictionary, total: int) -> int:
	var shape: String = design.get("shape", "box")
	var base: int = SHAPES[shape]["base"] + design.get("pieces", []).size() * 12
	var pearl: String = design.get("pearl", "white")
	var bonus: float = PEARLS[pearl]["bonus"]
	return int(round(base * bonus * (0.3 + (total / 100.0) * 1.1)))


static func reputation_gain(grade: String, for_commission: bool) -> int:
	var rep: int = GRADE_INFO[grade]["rep"]
	return int(round(rep * (1.0 if for_commission else 0.5)))


static func rank_title(rep: int, lang: String) -> String:
	var title: String = RANKS[0]["ko" if lang == "ko" else "en"]
	for r in RANKS:
		if rep >= int(r["rep"]):
			title = r["ko" if lang == "ko" else "en"]
	return title


static func make_commission(reputation: int) -> Dictionary:
	var shapes := SHAPES.keys()
	var lacquers := LACQUERS.keys()
	var motif_ids := MOTIFS.keys()
	var shape: String = shapes[randi() % shapes.size()]
	var lacquer: String = lacquers[randi() % lacquers.size()]
	var type_count := 1 + (randi() % 3)
	var motifs := {}
	var total := 0
	var pool := motif_ids.duplicate()
	pool.shuffle()
	for i in range(mini(type_count, pool.size())):
		var n := 1 + (randi() % 3)
		motifs[pool[i]] = n
		total += n
	var reward := int(round((SHAPES[shape]["base"] + total * 18) * (1.0 + mini(4, reputation / 120) * 0.25)))
	var patrons_ko := ["김 진사", "박 상인", "이 아씨", "최 선비", "한 의원"]
	var patrons_en := ["Scholar Kim", "Merchant Park", "Lady Yi", "Scholar Choi", "Doctor Han"]
	var idx := randi() % patrons_ko.size()
	return {
		"id": uid(),
		"name_ko": patrons_ko[idx],
		"name_en": patrons_en[idx],
		"shape": shape,
		"lacquer": lacquer,
		"pearl": "white",
		"motifs": motifs,
		"reward": reward,
		"line_ko": "정성껏 만들어 주시겠습니까?",
		"line_en": "Could you craft this with care?",
	}
