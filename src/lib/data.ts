// 게임에서 사용하는 정적 데이터: 백골 모양, 옻칠 색, 자개 문양, 재료, 손님.
// 작품 좌표계는 300x300 viewBox 기준입니다.

export type ShapeId = "box" | "mirror" | "tray" | "round";
export type LacquerId = "black" | "red" | "gold" | "blue";
export type MotifId =
  | "plum"
  | "butterfly"
  | "cloud"
  | "moon"
  | "leaf"
  | "diamond"
  | "turtle"
  | "crane";
export type PearlId = "white" | "abalone" | "black" | "paua";
export type MaterialId =
  | "wood"
  | "hemp"
  | "lacquer"
  | "glue"
  | "pearlWhite"
  | "pearlAbalone"
  | "pearlBlack"
  | "pearlPaua";

export interface ShapeDef {
  id: ShapeId;
  name: string;
  emoji: string;
  path: string;
  basePrice: number;
}

function octagon(cx: number, cy: number, r: number) {
  const pts = Array.from({ length: 8 }, (_, i) => {
    const a = ((22.5 + i * 45) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`;
  });
  return `M${pts.join(" L")} Z`;
}

function circle(cx: number, cy: number, r: number) {
  return `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
}

export const SHAPES: Record<ShapeId, ShapeDef> = {
  box: {
    id: "box",
    name: "보석함",
    emoji: "🎁",
    path: "M48 55 H252 Q270 55 270 73 V227 Q270 245 252 245 H48 Q30 245 30 227 V73 Q30 55 48 55 Z",
    basePrice: 120,
  },
  mirror: {
    id: "mirror",
    name: "손거울",
    emoji: "🪞",
    path: `${circle(150, 118, 100)} M136 212 H164 V278 Q164 292 150 292 Q136 292 136 278 Z`,
    basePrice: 90,
  },
  tray: {
    id: "tray",
    name: "팔각 쟁반",
    emoji: "🍽️",
    path: octagon(150, 150, 132),
    basePrice: 140,
  },
  round: {
    id: "round",
    name: "원형 다과합",
    emoji: "🍡",
    path: circle(150, 150, 125),
    basePrice: 110,
  },
};

export interface LacquerDef {
  id: LacquerId;
  name: string;
  color: string;
  light: string;
  deep: string;
}

export const LACQUERS: Record<LacquerId, LacquerDef> = {
  black: { id: "black", name: "흑칠", color: "#1c1416", light: "#3e3134", deep: "#0a0607" },
  red: { id: "red", name: "주칠", color: "#7a2119", light: "#a8412f", deep: "#3f0d09" },
  gold: { id: "gold", name: "황칠", color: "#9a6a24", light: "#d2a24f", deep: "#553510" },
  blue: { id: "blue", name: "청칠", color: "#1b2c47", light: "#3b5676", deep: "#0a1222" },
};

function hexagon(r: number) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2;
    return `${(Math.cos(a) * r).toFixed(2)} ${(Math.sin(a) * r).toFixed(2)}`;
  });
  return `M${pts.join(" L")} Z`;
}

export interface MotifDef {
  id: MotifId;
  name: string;
  meaning: string;
  path: string;
  /** 자르기 미니게임용 단일 외곽선 (없으면 path 사용) */
  cutPath?: string;
  /** 자개 위에 새겨 옻으로 메운 선각 */
  detail?: string;
}

/** 꽃잎 다섯 장이 이어진 한 줄 외곽선 */
function plumOutline() {
  const pts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const t = (i / 120) * Math.PI * 2;
    const r = 12 + 7.5 * Math.pow(Math.abs(Math.cos((5 * t) / 2)), 0.6);
    pts.push(`${(Math.cos(t - Math.PI / 2) * r).toFixed(2)} ${(Math.sin(t - Math.PI / 2) * r).toFixed(2)}`);
  }
  return `M${pts.join(" L")} Z`;
}

function plumDetail() {
  let d = circle(0, 0, 3.2);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    const b = a + Math.PI / 5;
    const p = (r: number, t: number) => `${(Math.cos(t) * r).toFixed(2)} ${(Math.sin(t) * r).toFixed(2)}`;
    d += ` M${p(3.6, a)} L${p(8, a)} ${circle(+(Math.cos(a) * 8.9).toFixed(2), +(Math.sin(a) * 8.9).toFixed(2), 0.8)}`;
    d += ` M${p(5.5, b)} L${p(11, b)}`;
  }
  return d;
}

function turtleDetail() {
  const inner = hexagon(10);
  let d = inner;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    d += ` M${(Math.cos(a) * 10).toFixed(2)} ${(Math.sin(a) * 10).toFixed(2)} L${(Math.cos(a) * 15.5).toFixed(2)} ${(Math.sin(a) * 15.5).toFixed(2)}`;
  }
  return `${d} ${hexagon(4)}`;
}

/** 참고 이미지와 같은 자세의 학: 왼쪽을 보며 날개를 위로 펼치고 다리를 뒤로 뻗음 */
function craneOutline() {
  return [
    // 부리끝
    "M-28 2.2 L-25.4 0.2",
    // 머리 정수리 → 목 윗선
    "C-24 -2.8 -22.2 -4.4 -20 -3.8",
    "C-17.6 -3.2 -16.2 -0.8 -15.6 1.6",
    "C-15 3.8 -14.2 5.6 -12.6 6.6",
    // 가슴·배
    "C-10.2 8.2 -6.8 9 -3.2 8.6",
    "C0.4 8.2 3.6 7 6.4 6.2",
    "C8.4 5.6 10 5.4 11.2 5.8",
    // 아랫다리
    "L14.2 9 L22.8 13.2 L25.2 11.6 L16.4 7 L13.2 4.6",
    // 윗다리
    "L18 3.6 L26.2 5.2 L27.2 3.2 L18.6 1.2 L13.4 -0.2",
    // 엉덩이 → 뒷날개 (높게 펼침)
    "L14.8 -2.4",
    "C17.6 -5.6 20.2 -10.2 19.2 -15",
    "C18.6 -17.8 16.4 -20.2 13.4 -21.2",
    "L15.2 -23.6 L12 -22",
    "C10.2 -23.4 7.8 -24 5.4 -23.4",
    "L6.6 -25.8 L3.4 -24",
    "C1.6 -24.6 -0.4 -24.2 -1.8 -22.8",
    "L-0.6 -25.4 L-3.2 -23.2",
    // 날개 사이 골
    "C-4.4 -20.6 -4 -16.8 -2.8 -13.4",
    "C-2 -11 -1.2 -8.8 -0.6 -7",
    // 앞날개 (높게, 깃 끝)
    "C-2.4 -12.2 -5.6 -18.4 -10.4 -22.6",
    "C-13.8 -25.6 -18.4 -26.6 -21.8 -24.4",
    "L-19.6 -22.6",
    "C-21.4 -21.4 -22.4 -19.2 -22.2 -16.8",
    "L-24.6 -17.8 L-22.4 -15",
    "C-22 -12.4 -20.4 -9.6 -18 -7.4",
    "C-16 -5.6 -13.8 -4.4 -11.6 -3.6",
    // 어깨 → 목 윗선 → 머리 → 부리
    "C-13.8 -4.2 -16.6 -5.2 -19.4 -4.6",
    "C-22.2 -4 -24.8 -2 -26.6 0.6",
    "Z",
  ].join(" ");
}

function craneDetail() {
  return [
    "M-23.4 0.4 C-20.6 -2.6 -17.6 -1.8 -15.2 1.4 C-13 4.2 -10.4 7 -6.6 7.8",
    "M-9.8 -4.6 C-13.2 -10.4 -17.2 -16.2 -20 -20.8",
    "M-7.4 -5.6 C-9.4 -11.8 -12.4 -17.6 -16 -21.8",
    "M-4.8 -6 C-4.2 -12 -3.2 -17.4 -0.4 -21.2",
    "M-1.8 -5.4 C1.4 -11 5.2 -16 9.4 -19.4",
    "M1.6 -3.8 C5.2 -8.4 9.6 -13 14.2 -16.2",
    "M4.8 -1.8 C8.4 -5.6 12.6 -9.8 16.6 -12.6",
    "M11 6.2 L20.6 11",
    "M12.6 3 L22.4 4.4",
    "M-21 -3.2 L-19.8 -1.6",
  ].join(" ");
}

export const MOTIFS: Record<MotifId, MotifDef> = {
  plum: {
    id: "plum",
    name: "매화",
    meaning: "고결함",
    path: plumOutline(),
    detail: plumDetail(),
  },
  butterfly: {
    id: "butterfly",
    name: "나비",
    meaning: "기쁨",
    path:
      "M0 0 C-4 -16 -24 -24 -22 -8 C-21 0 -9 2 0 0 Z M0 0 C4 -16 24 -24 22 -8 C21 0 9 2 0 0 Z " +
      "M0 1 C-4 10 -18 22 -16 10 C-15 4 -7 2 0 1 Z M0 1 C4 10 18 22 16 10 C15 4 7 2 0 1 Z",
    cutPath:
      "M0 -2 C-4 -16 -24 -24 -22 -8 C-21 -1 -12 1 -6 2 C-14 8 -18 22 -16 10 C-12 20 -2 12 0 4 " +
      "C2 12 12 20 16 10 C18 22 14 8 6 2 C12 1 21 -1 22 -8 C24 -24 4 -16 0 -2 Z",
    detail:
      "M-1.5 -1 C-6 -6 -12 -11 -18 -13 M-1.5 -0.5 C-8 -3 -14 -4.5 -20 -6 M-6 -5 C-9 -2.6 -13 -1.6 -16 -1.2 " +
      "M1.5 -1 C6 -6 12 -11 18 -13 M1.5 -0.5 C8 -3 14 -4.5 20 -6 M6 -5 C9 -2.6 13 -1.6 16 -1.2 " +
      "M-1 2 C-4 6 -8 9.5 -12 12 M-1 2 C-5 4 -9 5 -13 5.5 M1 2 C4 6 8 9.5 12 12 M1 2 C5 4 9 5 13 5.5 " +
      "M-17 -9 C-15.5 -8 -14 -8.6 -13.6 -10 M17 -9 C15.5 -8 14 -8.6 13.6 -10",
  },
  cloud: {
    id: "cloud",
    name: "구름",
    meaning: "장수",
    path: "M-22 8 C-30 8 -30 -4 -20 -4 C-20 -16 -4 -16 -3 -6 C1 -16 16 -14 13 -2 C24 -5 27 8 17 8 Z",
    detail:
      "M-21 5 C-25 4.5 -24.5 -0.5 -20.5 -0.6 C-18 -0.6 -17.5 2.4 -19.6 2.6 " +
      "M-15 -3 C-15.5 -10 -6.5 -11 -6.4 -5.6 C-6.4 -3.4 -9.6 -3.2 -9.8 -5.2 " +
      "M2 -4.8 C3 -11 12 -10.6 10.6 -4.6 C10 -2.6 7.2 -3 7.4 -5 M-18 5.4 C-8 3.6 6 3.6 18 5.4",
  },
  moon: {
    id: "moon",
    name: "초승달",
    meaning: "소망",
    path: "M0 -20 A20 20 0 0 0 0 20 A24 24 0 0 1 0 -20 Z",
    detail: "M-5.6 -18 Q-25 0 -5.6 18 M-14 -6 l2.2 0.6 M-15.6 3 l2 -0.4 M-12.4 10.4 l1.6 1",
  },
  leaf: {
    id: "leaf",
    name: "댓잎",
    meaning: "절개",
    path: "M-24 2 C-12 -10 10 -10 24 -2 C10 8 -12 10 -24 2 Z",
    detail:
      "M-22 1.8 C-8 -0.6 8 -2.2 22 -2 M-14 0.6 L-8.4 -4.6 M-5 -0.4 L0.6 -5.6 M4 -1.2 L9.6 -5.2 M11.6 -1.7 L16 -4 " +
      "M-11.4 0.3 L-5.8 4.6 M-2.4 -0.6 L3.4 4 M6.4 -1.5 L11.6 2.2",
  },
  diamond: {
    id: "diamond",
    name: "마름모",
    meaning: "조화",
    path: "M0 -20 L14 0 L0 20 L-14 0 Z",
    detail: "M0 -13 L9 0 L0 13 L-9 0 Z M0 -6 L4.2 0 L0 6 L-4.2 0 Z M0 -20 L0 -13 M14 0 L9 0 M0 20 L0 13 M-14 0 L-9 0",
  },
  turtle: {
    id: "turtle",
    name: "거북등",
    meaning: "무병장수",
    path: hexagon(17),
    detail: turtleDetail(),
  },
  crane: {
    id: "crane",
    name: "학",
    meaning: "신선",
    // 날아가는 학: 왼쪽을 향한 S자 목, 위로 펼친 날개, 뒤로 뻗은 다리
    path: craneOutline(),
    cutPath: craneOutline(),
    detail: craneDetail(),
  },
};

export const MOTIF_LIST = Object.values(MOTIFS);
export const SHAPE_LIST = Object.values(SHAPES);
export const LACQUER_LIST = Object.values(LACQUERS);

export interface PearlDef {
  id: PearlId;
  name: string;
  material: MaterialId;
  /** 텍스처가 준비되기 전 대체 색 */
  stops: string[];
  bonus: number;
}

export const PEARLS: Record<PearlId, PearlDef> = {
  white: {
    id: "white",
    name: "진주패 (백패)",
    material: "pearlWhite",
    stops: ["#e8e4dc", "#dccfd1", "#cfd8d8", "#e3dac8", "#d6d1dd"],
    bonus: 1,
  },
  abalone: {
    id: "abalone",
    name: "전복패",
    material: "pearlAbalone",
    stops: ["#86b3ad", "#b597b0", "#8b9fc4", "#9fbd92", "#c8b88e"],
    bonus: 1.35,
  },
  black: {
    id: "black",
    name: "흑진주패",
    material: "pearlBlack",
    stops: ["#4e4843", "#7d6a72", "#4f6f6c", "#6b6560", "#3a3532"],
    bonus: 1.55,
  },
  paua: {
    id: "paua",
    name: "뉴질랜드 판자개",
    material: "pearlPaua",
    stops: ["#2f6170", "#40518a", "#2f7564", "#6a5c96", "#7d8a4c"],
    bonus: 1.75,
  },
};

export const PEARL_LIST = Object.values(PEARLS);

export interface MaterialDef {
  id: MaterialId;
  name: string;
  emoji: string;
  price: number;
  pack: number;
  desc: string;
}

export const MATERIALS: Record<MaterialId, MaterialDef> = {
  wood: { id: "wood", name: "백골 (나무 틀)", emoji: "🪵", price: 30, pack: 1, desc: "작품의 뼈대가 되는 나무 틀" },
  hemp: { id: "hemp", name: "삼베 (무명천)", emoji: "🧵", price: 12, pack: 1, desc: "백골이 갈라지지 않게 감싸는 천" },
  lacquer: { id: "lacquer", name: "생옻칠", emoji: "🫙", price: 18, pack: 1, desc: "옻나무 수액. 작품 하나에 3통 사용" },
  glue: { id: "glue", name: "아교", emoji: "🍯", price: 10, pack: 1, desc: "자개를 붙이는 천연 접착제" },
  pearlWhite: { id: "pearlWhite", name: "진주패 자개", emoji: "🤍", price: 25, pack: 5, desc: "은은한 백색 광택 (5조각)" },
  pearlAbalone: { id: "pearlAbalone", name: "전복패 자개", emoji: "🌈", price: 50, pack: 5, desc: "무지갯빛 광택, 작품 가치 ↑ (5조각)" },
  pearlBlack: {
    id: "pearlBlack",
    name: "흑진주패 자개",
    emoji: "🖤",
    price: 75,
    pack: 5,
    desc: "은회색 바탕에 분홍·청록 광채가 번지는 귀한 자개 (5조각)",
  },
  pearlPaua: {
    id: "pearlPaua",
    name: "뉴질랜드 판자개",
    emoji: "🦚",
    price: 95,
    pack: 5,
    desc: "파우아 전복의 짙은 청록·보랏빛 물결무늬, 최고급 (5조각)",
  },
};

export const MATERIAL_LIST = Object.values(MATERIALS);

/** 작품 하나를 만들 때 고정으로 드는 재료 (자개는 조각 수만큼 추가) */
export const CRAFT_COST: Partial<Record<MaterialId, number>> = {
  wood: 1,
  hemp: 1,
  lacquer: 3,
  glue: 1,
};

export type HatId = "gat" | "jokduri" | "daenggi" | "none" | "beret";

export interface CustomerDef {
  name: string;
  title: string;
  skin: string;
  hair: string;
  outfit: string;
  hat: HatId;
  lines: string[];
}

export const CUSTOMERS: CustomerDef[] = [
  {
    name: "김선비",
    title: "글 읽는 선비",
    skin: "#ffe2c6",
    hair: "#3a2a22",
    outfit: "#e9eef7",
    hat: "gat",
    lines: ["어머님 생신 선물로 드리고 싶소.", "서재에 둘 귀한 물건이 필요하오."],
  },
  {
    name: "이아씨",
    title: "혼례를 앞둔 아씨",
    skin: "#ffe6d2",
    hair: "#2c1f1c",
    outfit: "#f7c6d6",
    hat: "jokduri",
    lines: ["혼수로 가져갈 예쁜 걸 부탁드려요!", "평생 간직할 거예요. 정성껏 부탁해요~"],
  },
  {
    name: "꼬마 단이",
    title: "용돈 모은 꼬마",
    skin: "#ffe9d6",
    hair: "#4a2f25",
    outfit: "#ffe08a",
    hat: "daenggi",
    lines: ["할머니께 드릴 선물이에요!", "반짝반짝한 거 만들어 주세요!"],
  },
  {
    name: "Emma",
    title: "한국 여행 온 관광객",
    skin: "#fde3d3",
    hair: "#d9a441",
    outfit: "#bfe3d0",
    hat: "beret",
    lines: ["I love Najeon! 한국 기념품으로 갖고 싶어요.", "SNS에 자랑할 거예요 ✨"],
  },
  {
    name: "박상궁",
    title: "궁궐의 상궁",
    skin: "#ffe0c4",
    hair: "#201715",
    outfit: "#c9b6e8",
    hat: "none",
    lines: ["중전마마께 올릴 물건이니 한 치 흠도 없어야 하네.", "궁에서 쓰일 물건이라네."],
  },
  {
    name: "최대감",
    title: "수집가 대감",
    skin: "#ffd9b8",
    hair: "#5a4a40",
    outfit: "#a9c7e8",
    hat: "gat",
    lines: ["내 수집품에 걸맞은 걸작을 원하네.", "값은 넉넉히 쳐 주겠네. 허허."],
  },
];

export const WORKSHOP_LEVELS = [
  { rep: 0, title: "견습 장인" },
  { rep: 60, title: "공방 장인" },
  { rep: 180, title: "솜씨 좋은 장인" },
  { rep: 400, title: "이름난 명장" },
  { rep: 800, title: "국가무형유산 장인" },
];

export function workshopTitle(rep: number) {
  let t = WORKSHOP_LEVELS[0].title;
  for (const l of WORKSHOP_LEVELS) if (rep >= l.rep) t = l.title;
  return t;
}
