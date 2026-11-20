extends Node

const T := {
	"title.commission": {"ko": "의뢰 받기", "en": "Commissions"},
	"title.free": {"ko": "자유 디자인", "en": "Free design"},
	"title.workshop": {"ko": "나의 공방", "en": "Workshop"},
	"title.shop": {"ko": "재료 상점", "en": "Shop"},
	"title.settings": {"ko": "설정 · 도움말", "en": "Settings"},
	"title.resume": {"ko": "이어 만들기", "en": "Resume craft"},
	"title.welcome": {"ko": "나전칠기 공방에 온 걸 환영한다!", "en": "Welcome to the lacquer workshop!"},
	"board.title": {"ko": "의뢰 게시판", "en": "Commission board"},
	"board.accept": {"ko": "수락하기", "en": "Accept"},
	"board.reward": {"ko": "사례금", "en": "Reward"},
	"board.refresh": {"ko": "새로고침", "en": "Refresh"},
	"shop.title": {"ko": "재료 상점", "en": "Materials"},
	"shop.buy": {"ko": "구매", "en": "Buy"},
	"shop.owned": {"ko": "보유 {n}", "en": "Owned {n}"},
	"gallery.title": {"ko": "나의 공방", "en": "My workshop"},
	"gallery.empty": {"ko": "아직 작품이 없어요.", "en": "No artworks yet."},
	"result.title": {"ko": "작품 완성!", "en": "Complete!"},
	"result.home": {"ko": "메인 화면으로", "en": "Main menu"},
	"result.next": {"ko": "다음 의뢰 받기", "en": "Next commission"},
	"result.total": {"ko": "종합 점수", "en": "Total score"},
	"result.craft": {"ko": "제작 솜씨", "en": "Craftsmanship"},
	"result.design": {"ko": "디자인", "en": "Design"},
	"result.repGain": {"ko": "획득 명성", "en": "Reputation earned"},
	"craft.free": {"ko": "자유 디자인", "en": "Free design"},
	"craft.commission": {"ko": "의뢰 제작", "en": "Commission"},
	"craft.next": {"ko": "다음 단계", "en": "Next step"},
	"craft.done": {"ko": "완료!", "en": "Done!"},
	"craft.back": {"ko": "뒤로", "en": "Back"},
	"design.title": {"ko": "디자인", "en": "Design"},
	"design.add": {"ko": "문양 추가", "en": "Add motif"},
	"design.tip": {"ko": "백골·옻칠·자개 문양을 골라 배치하세요.", "en": "Choose form, lacquer, and place motifs."},
	"cloth.title": {"ko": "삼베 바르기", "en": "Hemp wrap"},
	"cloth.tip": {"ko": "드래그해서 삼베를 감싸세요.", "en": "Drag to wrap hemp cloth."},
	"lacquer.title": {"ko": "옻칠", "en": "Lacquering"},
	"lacquer.tip": {"ko": "그릇을 눌러 붓을 적신 뒤 칠하세요.", "en": "Dip the brush, then paint."},
	"lacquer.dip": {"ko": "옻 적시기", "en": "Dip brush"},
	"dry.title": {"ko": "건조", "en": "Drying"},
	"dry.tip": {"ko": "습도를 맞춰 건조하세요.", "en": "Keep humidity in the good zone."},
	"cut.title": {"ko": "자개 자르기", "en": "Cutting nacre"},
	"cut.tip": {"ko": "점선을 따라 천천히 자르세요.", "en": "Follow the dashed path slowly."},
	"attach.title": {"ko": "자개 붙이기", "en": "Inlay"},
	"attach.tip": {"ko": "문양을 제자리에 붙이세요.", "en": "Place each motif on its mark."},
	"iron.title": {"ko": "다림질", "en": "Ironing"},
	"iron.tip": {"ko": "골고루 눌러 주세요.", "en": "Press evenly across the surface."},
	"peel.title": {"ko": "종이 떼기", "en": "Peeling paper"},
	"peel.tip": {"ko": "천천히 종이를 떼세요.", "en": "Peel the paper slowly."},
	"fill.title": {"ko": "메움칠", "en": "Filling"},
	"fill.tip": {"ko": "틈을 메우세요.", "en": "Fill the gaps."},
	"sand.title": {"ko": "갈아내기", "en": "Sanding"},
	"sand.tip": {"ko": "고르게 갈아 광을 내세요.", "en": "Sand evenly for a polish."},
	"common.close": {"ko": "닫기", "en": "Close"},
	"money": {"ko": "엽전", "en": "Coins"},
}


func lang() -> String:
	return GameState.lang


func t(key: String, vars: Dictionary = {}) -> String:
	var entry: Dictionary = T.get(key, {})
	var text: String = str(entry.get(lang(), entry.get("ko", key)))
	for k in vars.keys():
		text = text.replace("{%s}" % k, str(vars[k]))
	return text


func set_lang(next: String) -> void:
	GameState.lang = "en" if next == "en" else "ko"
	GameState.save_game()
