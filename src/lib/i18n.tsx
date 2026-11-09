"use client";

import { createElement, type ReactNode } from "react";
import { CUSTOMERS, type LacquerId, type MaterialId, type PearlId, type ShapeId } from "./data";
import type { MotifId } from "./motifs";
import type { Grade, StepId } from "./game";

export type Locale = "ko" | "en";

type Dict = Record<string, string>;

const ko: Dict = {
  "lang.ko": "한국어",
  "lang.en": "English",
  "lang.label": "언어",

  "common.back": "뒤로",
  "common.cancel": "취소",
  "common.close": "닫기",
  "common.done": "완료!",
  "common.doneMore": "조금 더 작업해 주세요",
  "common.start": "시작하기!",
  "common.reset": "초기화",
  "common.music": "배경음악",
  "common.sfx": "소리",

  "title.commission": "📜 의뢰 받기",
  "title.freeDesign": "🎨 자유 디자인",
  "title.workshop": "🏯 나의 공방",
  "title.shop": "🛒 재료 상점",
  "title.settings": "⚙️ 설정 · 도움말",
  "title.welcome": "나전칠기 공방에 온 걸 환영한다!",
  "title.masterTip":
    "나는 이 공방의 스승이란다. {craft}는 옻칠한 나무 위에 조개껍데기(자개)를 오려 붙여 꾸미는 우리 전통 공예란다.",
  "title.craftName": "나전칠기",
  "title.help1": "📜 {b} — 손님 주문대로 만들어 엽전과 명성을 얻어요",
  "title.help1b": "의뢰 받기",
  "title.help2": "✏️ 디자인 → 🧵 삼베 → 🖌️ 옻칠 → 🌡️ 건조 → 🪚 자개 자르기",
  "title.help3": "🍯 붙이기 → ♨️ 다림질 → 📜 종이 떼기 → 🫙 메움칠 → ✨ 갈아내기",
  "title.help4": "🛒 번 돈으로 재료를 사고, 🏯 공방에 작품을 전시해요",
  "title.resetAsk": "정말 처음부터 다시 시작할까요?",
  "title.resetWarn": "모든 작품과 엽전이 사라져요.",

  "rank.0": "견습 장인",
  "rank.60": "공방 장인",
  "rank.180": "솜씨 좋은 장인",
  "rank.400": "이름난 명장",
  "rank.800": "국가무형유산 장인",

  "board.title": "📜 의뢰 게시판",
  "board.reward": "사례금",
  "board.accept": "수락하기 ✨",
  "board.refresh": "🔄 다른 의뢰 보기",

  "shop.title": "🛒 재료 상점",
  "shop.sign": "옻골 재료상",
  "shop.signSub": "“좋은 재료가 좋은 작품을 만든다네~”",
  "shop.owned": "보유 {n}",
  "shop.buy": "구매!",
  "shop.iap": "💎 엽전 꾸러미 (준비 중)",
  "shop.iapPack1": "한 줌",
  "shop.iapPack2": "한 꾸러미",
  "shop.iapPack3": "한 궤짝",
  "shop.iapNote": "스토어 인앱 결제는 정식 출시 때 열려요.",
  "shop.coupon": "🎟 쿠폰 코드 입력",
  "shop.couponTitle": "쿠폰 코드",
  "shop.couponHint": "코드를 입력하면 엽전을 받을 수 있어요.",
  "shop.couponPlaceholder": "쿠폰 코드",
  "shop.couponUse": "사용하기",
  "shop.couponOk": "쿠폰 적용! +{n} 엽전",
  "shop.couponUsed": "이미 사용한 쿠폰이에요.",
  "shop.couponBad": "잘못된 쿠폰 코드예요.",

  "gallery.title": "🏯 나의 공방",
  "gallery.of": "{rank}의",
  "gallery.name": "나전칠기 공방",
  "gallery.empty": "아직 전시된 작품이 없어요.\n첫 작품을 만들어 보세요!",
  "gallery.delivered": "납품 완료 · {name}",
  "gallery.sold": "판매 완료",
  "gallery.onDisplay": "전시 중 · 감정가 {value}",
  "gallery.share": "📸 자랑하기",
  "gallery.sell": "판매",
  "gallery.interestTitle": "✨ 실물로 갖고 싶나요?",
  "gallery.interestBody":
    "이 디자인 그대로 실제 나전칠기 장인 공방에서 제작해 드리는 서비스를 준비하고 있어요.",
  "gallery.interestOn": "💌 관심 등록 완료! (다시 누르면 취소)",
  "gallery.interestOff": "❤️ 실물 제작 관심 있어요",
  "gallery.soldToast": "{n}냥에 판매했어요!",
  "gallery.shared": "공유했어요!",
  "gallery.saved": "이미지를 저장했어요!",

  "result.title": "작품 완성!",
  "result.total": "종합 점수",
  "result.match": "주문 일치도",
  "result.design": "디자인 구성",
  "result.craft": "제작 솜씨",
  "result.appraise": "감정가",
  "result.save": "이미지 저장",
  "result.toWorkshop": "🏯 공방에서 보기",
  "result.next": "📜 다음 의뢰 받기",
  "result.home": "🏠 처음으로",

  "craft.commission": "의뢰 제작",
  "craft.free": "자유 디자인",
  "craft.quitAsk": "작업을 그만둘까요?",
  "craft.quitWarn": "이미 사용한 재료는 돌려받을 수 없어요.",
  "craft.continue": "계속하기",
  "craft.quit": "그만두기",
  "craft.cheer90": "완벽해요! 🌟",
  "craft.cheer75": "훌륭해요! ✨",
  "craft.cheer55": "좋아요! 👍",
  "craft.cheerLow": "다음엔 더 잘할 수 있어요 💪",

  "step.design": "디자인",
  "step.cloth": "삼베 바르기",
  "step.lacquer": "옻칠",
  "step.dry": "건조",
  "step.cut": "자개 자르기",
  "step.attach": "자개 붙이기",
  "step.iron": "다림질",
  "step.peel": "종이 떼기",
  "step.fill": "메움칠",
  "step.sand": "갈아내기",

  "design.title": "디자인하기",
  "design.tipCommission":
    "손님의 주문서를 잘 보고 문양을 배치해 보렴. 요구한 문양과 개수를 맞추면 손님이 기뻐하실 게다.",
  "design.tipFree": "마음 가는 대로 꾸며 보렴. 문양을 눌러 추가하고, 끌어서 옮길 수 있단다.",
  "design.order": "📜 주문서",
  "design.motifs": "자개 문양 ({n}/{max})",
  "design.shape": "백골 모양",
  "design.lacquer": "옻칠 색",
  "design.pearl": "자개 종류",
  "design.owned": "보유 {n}조각",
  "design.materials": "필요한 재료",
  "design.lack": "재료가 부족해요!",
  "design.goShop": "🛒 상점 가기",
  "design.needMotif": "자개 문양을 하나 이상 배치해 주세요",
  "design.start": "디자인 완성! 제작 시작 🔨",
  "design.dup": "복제",

  "cloth.title": "백골에 삼베 바르기",
  "cloth.tip":
    "나무 틀(백골)에 생칠을 먹이고 {b}를 붙이면 나무가 뒤틀리거나 갈라지지 않는단다. 빈틈없이 골고루 덮어 보렴.",
  "cloth.tipB": "삼베",
  "cloth.good": "삼베로 덮은 면적",

  "lacquer.title": "{name} 하기",
  "lacquer.tip":
    "옻칠은 {b1}가 생명이란다. 두 번쯤 겹쳐 칠하면 딱 좋지만, 한곳만 너무 칠하면 {b2} 자국이 남는단다.",
  "lacquer.tipB1": "얇고 고르게",
  "lacquer.tipB2": "흘러내려",
  "lacquer.good": "고르게 칠한 면적",
  "lacquer.over": "흘러내린 곳",

  "dry.title": "옻장에서 건조하기",
  "dry.tip":
    "옻칠은 신기하게도 {b}에서 굳는단다. 습도 {h}, 온도 {t}를 유지하면 빨리, 단단하게 마른단다.",
  "dry.tipB": "습하고 따뜻한 곳",
  "dry.humidity": "💧 습도",
  "dry.temp": "🌡️ 온도",
  "dry.progress": "건조 진행",
  "dry.start": "옻장 문 닫고 건조 시작!",
  "dry.humidify": "💧\n가습",
  "dry.vent": "🌬️\n환기",
  "dry.heat": "🔥\n불 지피기",
  "dry.cool": "❄️\n식히기",
  "dry.wind": "🌬️ 바람이 들어와 습도가 떨어졌어요!",
  "dry.sun": "☀️ 햇볕이 들어 온도가 올라갔어요!",

  "cut.title": "자개 자르기",
  "cut.tip":
    "이제 자개를 문양대로 오려낼 차례란다. 자개는 얇아서 {b} 부러진단다. 어떤 방법으로 해 보겠니?",
  "cut.tipB": "힘을 너무 주면",
  "cut.jul": "줄음질",
  "cut.julDesc":
    "실톱으로 밑그림 선을 따라 천천히 오려요. 손가락/마우스로 선을 따라가거나 마우스 휠로 톱질해요.",
  "cut.kkeun": "끊음질",
  "cut.kkeunDesc": "가늘게 켠 자개 실을 칼로 톡톡 끊어요. 표시가 칼날 밑에 올 때 탭!",
  "cut.auto": "기계 가공",
  "cut.autoDesc": "빠르고 안전하지만 손맛이 없어 품질은 보통이에요.",
  "cut.julTitle": "줄음질 — 실톱으로 오려내기",
  "cut.julTip":
    "{name} 문양이구나. 반짝이는 점에서 시작해 점선을 따라 천천히 톱질하렴. 급하게 하면 자개가 {snap} 부러진단다!",
  "cut.snap": "뚝",
  "cut.progress": "오려낸 정도",
  "cut.force": "자개에 가해지는 힘",
  "cut.breaks": "부러짐 {n}/3 · 남은 자개 {left}",
  "cut.brokeNew": "💥 자개가 부러졌어요! 새 자개 1조각으로 다시 시작해요.",
  "cut.brokeKeep": "💥 자개가 부러졌어요! 남은 자개가 없어 금 간 채로 이어가요…",
  "cut.follow": "✋ 밑그림 선을 따라가 주세요!",
  "cut.kkeunTitle": "끊음질 — 자개 실 끊기",
  "cut.kkeunTip": "가늘게 켠 자개 실이 지나간단다. {b} 화면을 톡! 눌러 끊어 보렴.",
  "cut.kkeunTipB": "노란 표시가 칼날 아래에 왔을 때",
  "cut.perfect": "완벽해요! ✨",
  "cut.good": "좋아요!",
  "cut.miss": "조금 빗나갔어요",
  "cut.missed": "놓쳤어요!",
  "cut.waste": "헛손질!",
  "cut.cutBtn": "🔪 톡! 끊기",
  "cut.pieces": "끊은 조각 {n} / {max}",
  "cut.autoTitle": "기계 가공",
  "cut.autoTip": "기계는 빠르지만, 장인의 손끝 같은 섬세함은 없단다.",
  "cut.autoProgress": "가공 중…",

  "attach.title": "아교 바르고 자개 붙이기",
  "attach.tip":
    "아교는 금방 마른단다! 자개를 {b} 놓으렴. 아교가 마르기 전에 붙여야 단단히 붙는단다.",
  "attach.tipB": "점선 밑그림 위로 끌어다",
  "attach.near": "밑그림 가까이에 놓아 주세요!",
  "attach.dry": "아교가 말라버렸어요! 🍯 다시 발라 주세요",
  "attach.perfect": "딱 맞아요! ✨",
  "attach.ok": "좋아요!",
  "attach.skew": "살짝 비뚤어졌어요",
  "attach.piece": "{name} 조각 ({n}/{max})",
  "attach.all": "모두 붙였어요!",
  "attach.reglue": "🍯 다시",

  "iron.title": "유산지 대고 다림질",
  "iron.tip":
    "자개 위에 유산지를 덮고 인두로 {b1} 눌러 주렴. 그래야 자개가 바닥에 착 달라붙는단다. 한곳에 오래 대면 {b2} 버린단다!",
  "iron.tipB1": "골고루",
  "iron.tipB2": "눌어붙어",
  "iron.good": "고르게 다린 면적",
  "iron.over": "눌은 자국",

  "peel.title": "종이 떼기",
  "peel.tip": "자개를 고정했던 유산지를 떼어낼 차례란다. {b1}, 위에서 아래로 {b2} 쓸어내리렴.",
  "peel.tipB1": "물을 살짝 적시고",
  "peel.tipB2": "천천히",
  "peel.progress": "떼어낸 정도",
  "peel.speed": "떼는 속도",
  "peel.lifts": "들뜬 자개 {n}",
  "peel.warnWet": "앗, 자개가 들떴어요! 천천히~",
  "peel.warnDry": "종이가 말라서 자개가 같이 들려요! 물을 먼저 적셔 보세요",
  "peel.wetDone": "💦 촉촉하게 적셨어요",
  "peel.wet": "💦 물 적시기",

  "fill.title": "메움칠",
  "fill.tip":
    "붙인 자개 위까지 옻칠을 {b} 틈을 메우는 거란다. 자개가 안 보여도 걱정 말렴, 나중에 갈아내면 다시 나타난단다.",
  "fill.tipB": "한 번 더 덮어",
  "fill.good": "메운 면적",
  "fill.over": "뭉친 곳",

  "sand.title": "갈아내기 (연마)",
  "sand.tip":
    "숫돌로 살살 갈아내면 덮였던 자개가 {b1} 드러난단다. 하지만 {b2} 자개 광택이 죽어 버리니 적당히 멈추렴!",
  "sand.tipB1": "영롱하게",
  "sand.tipB2": "너무 많이 갈면",
  "sand.good": "알맞게 갈아낸 면적",
  "sand.over": "너무 갈아낸 곳",

  "grade.S": "명품",
  "grade.A": "수작",
  "grade.B": "양품",
  "grade.C": "보통",
  "grade.D": "아쉬움",

  "react.S.0": "세상에… 이건 가보로 물려줘야겠어요!",
  "react.S.1": "빛깔이 살아 숨 쉬는 것 같아요! 최고예요!",
  "react.A.0": "정말 아름다워요. 부탁드리길 잘했어요!",
  "react.A.1": "자개가 영롱하게 반짝여요~",
  "react.B.0": "마음에 들어요. 잘 쓸게요!",
  "react.B.1": "깔끔하게 잘 만들어 주셨네요.",
  "react.C.0": "음… 조금 아쉽지만 괜찮아요.",
  "react.C.1": "생각했던 거랑 살짝 달라요.",
  "react.D.0": "이건… 다음엔 더 신경 써 주세요.",
  "react.D.1": "옻칠이 고르지 않네요…",
  "react.free.0": "공방에 전시해 두면 손님들이 좋아하겠어요!",
  "react.free.1": "멋진 작품이 완성됐어요!",

  "artwork.title": "{lacquer} {motif}문 {shape}",

  "shape.box": "보석함",
  "shape.mirror": "손거울",
  "shape.tray": "팔각 쟁반",
  "shape.round": "원형 다과합",

  "lacquer.black": "흑칠",
  "lacquer.red": "주칠",
  "lacquer.gold": "황칠",
  "lacquer.blue": "청칠",

  "pearl.white": "진주패 (백패)",
  "pearl.abalone": "전복패",
  "pearl.black": "흑진주패",
  "pearl.paua": "뉴질랜드 판자개",

  "mat.wood": "백골 (나무 틀)",
  "mat.wood.desc": "작품의 뼈대가 되는 나무 틀",
  "mat.hemp": "삼베 (무명천)",
  "mat.hemp.desc": "백골이 갈라지지 않게 감싸는 천",
  "mat.lacquer": "생옻칠",
  "mat.lacquer.desc": "옻나무 수액. 작품 하나에 3통 사용",
  "mat.glue": "아교",
  "mat.glue.desc": "자개를 붙이는 천연 접착제",
  "mat.pearlWhite": "진주패 자개",
  "mat.pearlWhite.desc": "은은한 백색 광택 (5조각)",
  "mat.pearlAbalone": "전복패 자개",
  "mat.pearlAbalone.desc": "무지갯빛 광택, 작품 가치 ↑ (5조각)",
  "mat.pearlBlack": "흑진주패 자개",
  "mat.pearlBlack.desc": "은회색 바탕에 분홍·청록 광채가 번지는 귀한 자개 (5조각)",
  "mat.pearlPaua": "뉴질랜드 판자개",
  "mat.pearlPaua.desc": "파우아 전복의 짙은 청록·보랏빛 물결무늬, 최고급 (5조각)",

  "motif.plum": "매화",
  "motif.plum.m": "고결함",
  "motif.butterfly": "나비",
  "motif.butterfly.m": "기쁨",
  "motif.cloud": "구름",
  "motif.cloud.m": "장수",
  "motif.peony": "모란",
  "motif.peony.m": "부귀",
  "motif.crane": "학",
  "motif.crane.m": "신선",
  "motif.crane2": "비상하는 학",
  "motif.crane2.m": "길상",
  "motif.diamond": "끊음질 삼잎",
  "motif.diamond.m": "조화",
  "motif.kiku": "국화 넝쿨",
  "motif.kiku.m": "장수",
  "motif.orb": "해·달",
  "motif.orb.m": "광명",
  "motif.cloudLine": "선 구름",
  "motif.cloudLine.m": "길상",
  "motif.mountain": "산",
  "motif.mountain.m": "굳건함",
  "motif.rock": "바위",
  "motif.rock.m": "불변",
  "motif.wave": "물결",
  "motif.wave.m": "평안",
  "motif.vine": "포도넝쿨",
  "motif.vine.m": "번성",
  "motif.grapeLeaf": "포도잎",
  "motif.grapeLeaf.m": "풍요",
  "motif.grapes": "포도송이",
  "motif.grapes.m": "다산",
  "motif.moon": "초승달",
  "motif.moon.m": "소망",
  "motif.leaf": "댓잎",
  "motif.leaf.m": "절개",
  "motif.turtle": "거북등",
  "motif.turtle.m": "무병장수",
  "motif.plain": "무문",

  "customer.0.name": "김선비",
  "customer.0.title": "글 읽는 선비",
  "customer.0.line0": "어머님 생신 선물로 드리고 싶소.",
  "customer.0.line1": "서재에 둘 귀한 물건이 필요하오.",
  "customer.1.name": "이아씨",
  "customer.1.title": "혼례를 앞둔 아씨",
  "customer.1.line0": "혼수로 가져갈 예쁜 걸 부탁드려요!",
  "customer.1.line1": "평생 간직할 거예요. 정성껏 부탁해요~",
  "customer.2.name": "꼬마 단이",
  "customer.2.title": "용돈 모은 꼬마",
  "customer.2.line0": "할머니께 드릴 선물이에요!",
  "customer.2.line1": "반짝반짝한 거 만들어 주세요!",
  "customer.3.name": "Emma",
  "customer.3.title": "한국 여행 온 관광객",
  "customer.3.line0": "I love Najeon! 한국 기념품으로 갖고 싶어요.",
  "customer.3.line1": "SNS에 자랑할 거예요 ✨",
  "customer.4.name": "박상궁",
  "customer.4.title": "궁궐의 상궁",
  "customer.4.line0": "중전마마께 올릴 물건이니 한 치 흠도 없어야 하네.",
  "customer.4.line1": "궁에서 쓰일 물건이라네.",
  "customer.5.name": "최대감",
  "customer.5.title": "수집가 대감",
  "customer.5.line0": "내 수집품에 걸맞은 걸작을 원하네.",
  "customer.5.line1": "값은 넉넉히 쳐 주겠네. 허허.",
  "master.name": "옻골 스승님",
  "master.title": "나전칠기 명장",
};

const en: Dict = {
  "lang.ko": "한국어",
  "lang.en": "English",
  "lang.label": "Language",

  "common.back": "Back",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.done": "Done!",
  "common.doneMore": "Keep working a bit more",
  "common.start": "Let's begin!",
  "common.reset": "Reset",
  "common.music": "Music",
  "common.sfx": "Sound",

  "title.commission": "📜 Commissions",
  "title.freeDesign": "🎨 Free Design",
  "title.workshop": "🏯 My Workshop",
  "title.shop": "🛒 Material Shop",
  "title.settings": "⚙️ Settings · Help",
  "title.welcome": "Welcome to the lacquer workshop!",
  "title.masterTip":
    "I am the master of this workshop. {craft} is our traditional craft of cutting mother-of-pearl and inlaying it on lacquered wood.",
  "title.craftName": "Najeonchilgi",
  "title.help1": "📜 {b} — craft to order and earn coins & fame",
  "title.help1b": "Commissions",
  "title.help2": "✏️ Design → 🧵 Hemp → 🖌️ Lacquer → 🌡️ Dry → 🪚 Cut shell",
  "title.help3": "🍯 Attach → ♨️ Iron → 📜 Peel → 🫙 Fill → ✨ Polish",
  "title.help4": "🛒 Buy materials with earnings, 🏯 display pieces in your workshop",
  "title.resetAsk": "Start over from the beginning?",
  "title.resetWarn": "All artworks and coins will be lost.",

  "rank.0": "Apprentice",
  "rank.60": "Workshop Artisan",
  "rank.180": "Skilled Artisan",
  "rank.400": "Renowned Master",
  "rank.800": "National Living Treasure",

  "board.title": "📜 Commission Board",
  "board.reward": "Reward",
  "board.accept": "Accept ✨",
  "board.refresh": "🔄 See other requests",

  "shop.title": "🛒 Material Shop",
  "shop.sign": "Ottgol Supply",
  "shop.signSub": "“Fine materials make fine work~”",
  "shop.owned": "Owned {n}",
  "shop.buy": "Bought!",
  "shop.iap": "💎 Coin packs (coming soon)",
  "shop.iapPack1": "A handful",
  "shop.iapPack2": "A bundle",
  "shop.iapPack3": "A chest",
  "shop.iapNote": "In-app purchases open at official release.",
  "shop.coupon": "🎟 Enter coupon code",
  "shop.couponTitle": "Coupon code",
  "shop.couponHint": "Enter a code to receive coins.",
  "shop.couponPlaceholder": "Coupon code",
  "shop.couponUse": "Redeem",
  "shop.couponOk": "Coupon applied! +{n} coins",
  "shop.couponUsed": "This coupon was already used.",
  "shop.couponBad": "Invalid coupon code.",

  "gallery.title": "🏯 My Workshop",
  "gallery.of": "{rank}'s",
  "gallery.name": "Najeon Workshop",
  "gallery.empty": "No pieces on display yet.\nMake your first artwork!",
  "gallery.delivered": "Delivered · {name}",
  "gallery.sold": "Sold",
  "gallery.onDisplay": "On display · Value {value}",
  "gallery.share": "📸 Share",
  "gallery.sell": "Sell",
  "gallery.interestTitle": "✨ Want this in real life?",
  "gallery.interestBody": "We're preparing a service to have real artisans craft this design.",
  "gallery.interestOn": "💌 Interest saved! (tap again to cancel)",
  "gallery.interestOff": "❤️ I'm interested in a real piece",
  "gallery.soldToast": "Sold for {n} coins!",
  "gallery.shared": "Shared!",
  "gallery.saved": "Image saved!",

  "result.title": "Complete!",
  "result.total": "Total score",
  "result.match": "Order match",
  "result.design": "Design",
  "result.craft": "Craftsmanship",
  "result.appraise": "Appraised",
  "result.save": "Save image",
  "result.toWorkshop": "🏯 View in workshop",
  "result.next": "📜 Next commission",
  "result.home": "🏠 Home",

  "craft.commission": "Commission work",
  "craft.free": "Free design",
  "craft.quitAsk": "Quit this piece?",
  "craft.quitWarn": "Materials already used can't be refunded.",
  "craft.continue": "Keep going",
  "craft.quit": "Quit",
  "craft.cheer90": "Perfect! 🌟",
  "craft.cheer75": "Wonderful! ✨",
  "craft.cheer55": "Nice! 👍",
  "craft.cheerLow": "You'll do even better next time 💪",

  "step.design": "Design",
  "step.cloth": "Hemp wrap",
  "step.lacquer": "Lacquer",
  "step.dry": "Drying",
  "step.cut": "Cut shell",
  "step.attach": "Attach",
  "step.iron": "Iron",
  "step.peel": "Peel paper",
  "step.fill": "Fill coat",
  "step.sand": "Polish",

  "design.title": "Design",
  "design.tipCommission":
    "Check the order carefully and place motifs. Matching the requested motifs and counts will please the client.",
  "design.tipFree": "Decorate as you like. Tap to add motifs, then drag to move them.",
  "design.order": "📜 Order sheet",
  "design.motifs": "Shell motifs ({n}/{max})",
  "design.shape": "Wooden form",
  "design.lacquer": "Lacquer color",
  "design.pearl": "Shell type",
  "design.owned": "{n} pieces owned",
  "design.materials": "Materials needed",
  "design.lack": "Not enough materials!",
  "design.goShop": "🛒 Go to shop",
  "design.needMotif": "Place at least one shell motif",
  "design.start": "Design done! Start crafting 🔨",
  "design.dup": "Copy",

  "cloth.title": "Wrap hemp on the wood",
  "cloth.tip":
    "Coat the wooden form and apply {b} so the wood won't warp or crack. Cover every gap evenly.",
  "cloth.tipB": "hemp cloth",
  "cloth.good": "Area covered with hemp",

  "lacquer.title": "Apply {name}",
  "lacquer.tip":
    "Lacquer must be {b1}. A couple of thin coats is ideal — too much in one spot will {b2} and leave marks.",
  "lacquer.tipB1": "thin and even",
  "lacquer.tipB2": "drip",
  "lacquer.good": "Evenly coated area",
  "lacquer.over": "Drips",

  "dry.title": "Dry in the lacquer cabinet",
  "dry.tip":
    "Lacquer hardens best in a {b}. Keep humidity {h} and temperature {t} for a quick, firm cure.",
  "dry.tipB": "warm, humid place",
  "dry.humidity": "💧 Humidity",
  "dry.temp": "🌡️ Temperature",
  "dry.progress": "Drying progress",
  "dry.start": "Close the cabinet and start drying!",
  "dry.humidify": "💧\nHumidify",
  "dry.vent": "🌬️\nVent",
  "dry.heat": "🔥\nWarm",
  "dry.cool": "❄️\nCool",
  "dry.wind": "🌬️ A draft dropped the humidity!",
  "dry.sun": "☀️ Sunlight raised the temperature!",

  "cut.title": "Cut the shell",
  "cut.tip":
    "Time to cut the shell to the motif. Shell is thin — {b} it snaps. Which method will you try?",
  "cut.tipB": "too much force and",
  "cut.jul": "Jureumjil (fretsaw)",
  "cut.julDesc":
    "Saw slowly along the sketch line. Follow with finger/mouse, or use the mouse wheel.",
  "cut.kkeun": "Kkeuneumjil (snip)",
  "cut.kkeunDesc": "Snip a thin shell strip. Tap when the mark is under the blade!",
  "cut.auto": "Machine cut",
  "cut.autoDesc": "Fast and safe, but lacks handmade quality.",
  "cut.julTitle": "Jureumjil — fretsaw cutting",
  "cut.julTip":
    "A {name} motif. Start from the sparkle and saw slowly along the dashes. Rush and it goes {snap}!",
  "cut.snap": "snap",
  "cut.progress": "Cut progress",
  "cut.force": "Force on the shell",
  "cut.breaks": "Breaks {n}/3 · Shell left {left}",
  "cut.brokeNew": "💥 Shell broke! Restarting with 1 new piece.",
  "cut.brokeKeep": "💥 Shell broke! No pieces left — continuing with a crack…",
  "cut.follow": "✋ Follow the sketch line!",
  "cut.kkeunTitle": "Kkeuneumjil — snipping strip",
  "cut.kkeunTip": "A thin shell strip is sliding by. When {b}, tap the screen to snip!",
  "cut.kkeunTipB": "the yellow mark is under the blade",
  "cut.perfect": "Perfect! ✨",
  "cut.good": "Nice!",
  "cut.miss": "A bit off",
  "cut.missed": "Missed!",
  "cut.waste": "Whiff!",
  "cut.cutBtn": "🔪 Snip!",
  "cut.pieces": "Snipped {n} / {max}",
  "cut.autoTitle": "Machine cut",
  "cut.autoTip": "Machines are fast, but they lack a master's touch.",
  "cut.autoProgress": "Cutting…",

  "attach.title": "Glue and place shell",
  "attach.tip": "Glue dries fast! Drag the shell {b}. Stick it before the glue sets.",
  "attach.tipB": "onto the dashed sketch",
  "attach.near": "Place it closer to the sketch!",
  "attach.dry": "The glue dried! 🍯 Apply again",
  "attach.perfect": "Perfect fit! ✨",
  "attach.ok": "Nice!",
  "attach.skew": "A little crooked",
  "attach.piece": "{name} piece ({n}/{max})",
  "attach.all": "All pieces placed!",
  "attach.reglue": "🍯 Again",

  "iron.title": "Iron under parchment",
  "iron.tip":
    "Cover with parchment and press {b1} with the iron so the shell seats firmly. Hold too long in one spot and it will {b2}!",
  "iron.tipB1": "evenly",
  "iron.tipB2": "scorch",
  "iron.good": "Evenly ironed area",
  "iron.over": "Scorch marks",

  "peel.title": "Peel the paper",
  "peel.tip":
    "Time to remove the parchment that held the shell. {b1}, then wipe {b2} from top to bottom.",
  "peel.tipB1": "Damp it lightly",
  "peel.tipB2": "slowly",
  "peel.progress": "Peeled",
  "peel.speed": "Peel speed",
  "peel.lifts": "Lifted shell {n}",
  "peel.warnWet": "Oops, shell lifted! Go slower~",
  "peel.warnDry": "Dry paper is lifting the shell! Wet it first",
  "peel.wetDone": "💦 Nicely dampened",
  "peel.wet": "💦 Wet the paper",

  "fill.title": "Fill coat",
  "fill.tip":
    "Coat lacquer {b} to fill gaps over the shell. Don't worry if it disappears — polishing will reveal it again.",
  "fill.tipB": "once more over",
  "fill.good": "Filled area",
  "fill.over": "Clumps",

  "sand.title": "Polish (grind)",
  "sand.tip":
    "Gently grind with a whetstone and the shell appears {b1}. But {b2} the luster dies — stop in time!",
  "sand.tipB1": "brilliantly",
  "sand.tipB2": "grind too much and",
  "sand.good": "Properly polished area",
  "sand.over": "Over-polished",

  "grade.S": "Masterpiece",
  "grade.A": "Fine work",
  "grade.B": "Good",
  "grade.C": "Fair",
  "grade.D": "Rough",

  "react.S.0": "My word… this should be a family heirloom!",
  "react.S.1": "The colors feel alive! Absolute best!",
  "react.A.0": "So beautiful. I'm glad I asked you!",
  "react.A.1": "The shell sparkles so brilliantly~",
  "react.B.0": "I like it. I'll use it well!",
  "react.B.1": "Cleanly made, thank you.",
  "react.C.0": "Hmm… a bit off, but it's okay.",
  "react.C.1": "Not quite what I imagined.",
  "react.D.0": "Please be more careful next time.",
  "react.D.1": "The lacquer isn't even…",
  "react.free.0": "Display this and customers will love it!",
  "react.free.1": "A wonderful piece is done!",

  "artwork.title": "{lacquer} {motif} {shape}",

  "shape.box": "Jewelry box",
  "shape.mirror": "Hand mirror",
  "shape.tray": "Octagon tray",
  "shape.round": "Round tea case",

  "lacquer.black": "Black lacquer",
  "lacquer.red": "Cinnabar lacquer",
  "lacquer.gold": "Yellow lacquer",
  "lacquer.blue": "Blue lacquer",

  "pearl.white": "White pearl shell",
  "pearl.abalone": "Abalone shell",
  "pearl.black": "Black pearl shell",
  "pearl.paua": "New Zealand paua",

  "mat.wood": "Wooden form",
  "mat.wood.desc": "The wooden body of the piece",
  "mat.hemp": "Hemp cloth",
  "mat.hemp.desc": "Cloth that keeps the wood from cracking",
  "mat.lacquer": "Raw lacquer",
  "mat.lacquer.desc": "Lacquer sap. Uses 3 jars per piece",
  "mat.glue": "Animal glue",
  "mat.glue.desc": "Natural adhesive for shell",
  "mat.pearlWhite": "White pearl shell",
  "mat.pearlWhite.desc": "Soft white luster (5 pieces)",
  "mat.pearlAbalone": "Abalone shell",
  "mat.pearlAbalone.desc": "Iridescent luster, higher value (5 pieces)",
  "mat.pearlBlack": "Black pearl shell",
  "mat.pearlBlack.desc": "Silvery base with pink-teal flashes (5 pieces)",
  "mat.pearlPaua": "New Zealand paua",
  "mat.pearlPaua.desc": "Deep teal-violet paua waves, premium (5 pieces)",

  "motif.plum": "Plum blossom",
  "motif.plum.m": "Purity",
  "motif.butterfly": "Butterfly",
  "motif.butterfly.m": "Joy",
  "motif.cloud": "Cloud",
  "motif.cloud.m": "Longevity",
  "motif.peony": "Peony",
  "motif.peony.m": "Wealth",
  "motif.crane": "Crane",
  "motif.crane.m": "Immortal",
  "motif.crane2": "Soaring crane",
  "motif.crane2.m": "Auspicious",
  "motif.diamond": "Asanoha",
  "motif.diamond.m": "Harmony",
  "motif.kiku": "Chrysanthemum vine",
  "motif.kiku.m": "Longevity",
  "motif.orb": "Sun & moon",
  "motif.orb.m": "Radiance",
  "motif.cloudLine": "Line cloud",
  "motif.cloudLine.m": "Auspicious",
  "motif.mountain": "Mountain",
  "motif.mountain.m": "Steadfast",
  "motif.rock": "Rock",
  "motif.rock.m": "Constancy",
  "motif.wave": "Wave",
  "motif.wave.m": "Peace",
  "motif.vine": "Grape vine",
  "motif.vine.m": "Prosperity",
  "motif.grapeLeaf": "Grape leaf",
  "motif.grapeLeaf.m": "Abundance",
  "motif.grapes": "Grapes",
  "motif.grapes.m": "Fertility",
  "motif.moon": "Crescent",
  "motif.moon.m": "Wish",
  "motif.leaf": "Bamboo leaf",
  "motif.leaf.m": "Integrity",
  "motif.turtle": "Turtle shell",
  "motif.turtle.m": "Longevity",
  "motif.plain": "Plain",

  "customer.0.name": "Scholar Kim",
  "customer.0.title": "Bookish scholar",
  "customer.0.line0": "I'd like a gift for my mother's birthday.",
  "customer.0.line1": "I need something fine for my study.",
  "customer.1.name": "Lady Lee",
  "customer.1.title": "Bride-to-be",
  "customer.1.line0": "Please make something pretty for my wedding chest!",
  "customer.1.line1": "I'll keep it forever. Please put your heart into it~",
  "customer.2.name": "Little Dani",
  "customer.2.title": "Kid with allowance",
  "customer.2.line0": "It's a gift for Grandma!",
  "customer.2.line1": "Please make something sparkly!",
  "customer.3.name": "Emma",
  "customer.3.title": "Traveler in Korea",
  "customer.3.line0": "I love Najeon! I want a Korean souvenir.",
  "customer.3.line1": "I'll show it off on SNS ✨",
  "customer.4.name": "Lady Park",
  "customer.4.title": "Palace court lady",
  "customer.4.line0": "It will be offered to Her Majesty — not a single flaw.",
  "customer.4.line1": "This will be used in the palace.",
  "customer.5.name": "Lord Choi",
  "customer.5.title": "Collector lord",
  "customer.5.line0": "I want a masterpiece worthy of my collection.",
  "customer.5.line1": "I'll pay generously. Hoho.",
  "master.name": "Master Ottgol",
  "master.title": "Najeon master",
};

const TABLES: Record<Locale, Dict> = { ko, en };

export function t(lang: Locale, key: string, vars?: Record<string, string | number>): string {
  let s = TABLES[lang][key] ?? TABLES.ko[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  }
  return s;
}

/** `{b}` 자리를 React 노드로 끼워 넣습니다. */
export function tNode(
  lang: Locale,
  key: string,
  nodes: Record<string, ReactNode>,
  vars?: Record<string, string | number>,
): ReactNode[] {
  const raw = t(lang, key, vars);
  const parts = raw.split(/(\{[a-zA-Z0-9_]+\})/g);
  return parts.map((p, i) => {
    const m = p.match(/^\{([a-zA-Z0-9_]+)\}$/);
    if (m && nodes[m[1]] !== undefined) {
      return createElement("span", { key: i }, nodes[m[1]]);
    }
    return createElement("span", { key: i }, p);
  });
}

export function shapeName(lang: Locale, id: ShapeId) {
  return t(lang, `shape.${id}`);
}
export function lacquerName(lang: Locale, id: LacquerId) {
  return t(lang, `lacquer.${id}`);
}
export function pearlName(lang: Locale, id: PearlId) {
  return t(lang, `pearl.${id}`);
}
export function materialName(lang: Locale, id: MaterialId) {
  return t(lang, `mat.${id}`);
}
export function materialDesc(lang: Locale, id: MaterialId) {
  return t(lang, `mat.${id}.desc`);
}
export function motifName(lang: Locale, id: MotifId | "plain") {
  return t(lang, `motif.${id}`);
}
export function motifMeaning(lang: Locale, id: MotifId) {
  return t(lang, `motif.${id}.m`);
}
export function stepName(lang: Locale, id: StepId | "design") {
  return t(lang, `step.${id}`);
}
export function gradeLabel(lang: Locale, g: Grade) {
  return t(lang, `grade.${g}`);
}
export function rankTitle(lang: Locale, rep: number) {
  const levels = [0, 60, 180, 400, 800];
  let key = "rank.0";
  for (const r of levels) if (rep >= r) key = `rank.${r}`;
  return t(lang, key);
}
export function customerName(lang: Locale, i: number) {
  return t(lang, `customer.${i}.name`);
}
export function customerTitle(lang: Locale, i: number) {
  return t(lang, `customer.${i}.title`);
}
export function customerLine(lang: Locale, i: number, line: string) {
  const idx = CUSTOMERS[i]?.lines.indexOf(line) ?? -1;
  if (idx >= 0) return t(lang, `customer.${i}.line${idx}`);
  return line;
}

export function artworkTitle(
  lang: Locale,
  shape: ShapeId,
  lacquer: LacquerId,
  motif: MotifId | "plain",
) {
  return t(lang, "artwork.title", {
    lacquer: lacquerName(lang, lacquer),
    motif: motifName(lang, motif),
    shape: shapeName(lang, shape),
  });
}

export function reactionText(lang: Locale, grade: Grade, free: boolean) {
  if (free) {
    const i = Math.random() < 0.5 ? 0 : 1;
    return t(lang, `react.free.${i}`);
  }
  const i = Math.random() < 0.5 ? 0 : 1;
  return t(lang, `react.${grade}.${i}`);
}
