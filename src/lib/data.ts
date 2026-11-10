// 게임에서 사용하는 정적 데이터: 백골 모양, 옻칠 색, 자개 문양, 재료, 손님.
// 작품 좌표계는 300x300 viewBox 기준입니다.

export type ShapeId = "box" | "mirror" | "tray" | "round";
export type LacquerId = "black" | "red" | "gold" | "blue";
import type { MotifId } from "./motifs";
export type { MotifId };
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

export {
  MOTIFS,
  MOTIF_LIST,
  SHAPE_MOTIFS,
  PATTERN_MOTIFS,
  motifOutline,
  motifCutFit,
  motifLocalBox,
  motifParts,
  type MotifDef,
  type MotifKind,
} from "./motifs";
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

/** 현재 칭호 구간 안에서의 진행. 기준값은 WORKSHOP_LEVELS만 사용한다. */
export function rankProgress(rep: number) {
  let index = 0;
  for (let i = 0; i < WORKSHOP_LEVELS.length; i++) {
    if (rep >= WORKSHOP_LEVELS[i].rep) index = i;
  }
  const current = WORKSHOP_LEVELS[index];
  const next = WORKSHOP_LEVELS[index + 1];
  if (!next) return { index, current, next: undefined, remaining: 0, ratio: 1, maxed: true as const };
  const span = next.rep - current.rep;
  return {
    index,
    current,
    next,
    remaining: next.rep - rep,
    ratio: span <= 0 ? 1 : (rep - current.rep) / span,
    maxed: false as const,
  };
}
