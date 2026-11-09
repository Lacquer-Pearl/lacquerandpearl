import {
  CUSTOMERS,
  LACQUER_LIST,
  MOTIF_LIST,
  PEARLS,
  SHAPES,
  SHAPE_LIST,
  type LacquerId,
  type MotifId,
  type PearlId,
  type ShapeId,
} from "./data";

export interface PlacedPiece {
  id: string;
  motif: MotifId;
  x: number;
  y: number;
  /** 배율 */
  s: number;
  /** 회전 (도) */
  r: number;
}

export interface Design {
  shape: ShapeId;
  lacquer: LacquerId;
  pearl: PearlId;
  pieces: PlacedPiece[];
}

export interface Commission {
  id: string;
  customer: number;
  line: string;
  shape: ShapeId;
  lacquer: LacquerId;
  pearl?: PearlId;
  motifs: Partial<Record<MotifId, number>>;
  reward: number;
}

export type StepId =
  | "cloth"
  | "lacquer"
  | "dry"
  | "cut"
  | "attach"
  | "iron"
  | "peel"
  | "fill"
  | "sand";

export type StepScores = Partial<Record<StepId, number>>;

export interface Artwork {
  id: string;
  createdAt: number;
  design: Design;
  scores: StepScores;
  designScore: number;
  craftScore: number;
  total: number;
  grade: Grade;
  commissionId?: string;
  customer?: number;
  earned: number;
  value: number;
  sold: boolean;
  title: string;
  gloss: number;
  dull: number;
}

export type Grade = "S" | "A" | "B" | "C" | "D";

export const STEP_INFO: Record<StepId, { name: string; emoji: string; weight: number }> = {
  cloth: { name: "삼베 바르기", emoji: "🧵", weight: 0.8 },
  lacquer: { name: "옻칠", emoji: "🖌️", weight: 1.3 },
  dry: { name: "건조", emoji: "🌡️", weight: 1 },
  cut: { name: "자개 자르기", emoji: "🪚", weight: 1.3 },
  attach: { name: "자개 붙이기", emoji: "🍯", weight: 1.2 },
  iron: { name: "다림질", emoji: "♨️", weight: 0.8 },
  peel: { name: "종이 떼기", emoji: "📜", weight: 0.7 },
  fill: { name: "메움칠", emoji: "🫙", weight: 1 },
  sand: { name: "갈아내기", emoji: "✨", weight: 1.4 },
};

export const uid = () => Math.random().toString(36).slice(2, 10);

const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

export function newPiece(motif: MotifId): PlacedPiece {
  return {
    id: uid(),
    motif,
    x: 150 + (Math.random() - 0.5) * 140,
    y: 150 + (Math.random() - 0.5) * 120,
    s: 1.3,
    r: Math.round((Math.random() - 0.5) * 30),
  };
}

export function generateCommission(reputation: number): Commission {
  const tier = Math.min(4, Math.floor(reputation / 120));
  const customer = Math.floor(Math.random() * CUSTOMERS.length);
  const c = CUSTOMERS[customer];
  const shape = pick(SHAPE_LIST).id;
  const lacquer = pick(LACQUER_LIST).id;
  const typeCount = Math.min(3, 1 + Math.floor(Math.random() * (1 + tier * 0.7)) + (Math.random() < 0.35 ? 1 : 0));
  const types = [...MOTIF_LIST].sort(() => Math.random() - 0.5).slice(0, typeCount);
  const motifs: Partial<Record<MotifId, number>> = {};
  let total = 0;
  for (const t of types) {
    const n = 1 + Math.floor(Math.random() * (2 + tier));
    motifs[t.id] = n;
    total += n;
  }
  const premium: PearlId[] = ["abalone", "black", "paua"].slice(0, 1 + Math.min(2, tier)) as PearlId[];
  const pearl: PearlId | undefined = Math.random() < 0.15 + tier * 0.08 ? pick(premium) : undefined;
  const reward = Math.round(
    (SHAPES[shape].basePrice + total * 18 + typeCount * 15) *
      (1 + tier * 0.25) *
      (pearl ? 1 + (PEARLS[pearl].bonus - 1) * 1.4 : 1),
  );
  return { id: uid(), customer, line: pick(c.lines), shape, lacquer, pearl, motifs, reward };
}

export function countMotifs(pieces: PlacedPiece[]) {
  const counts: Partial<Record<MotifId, number>> = {};
  for (const p of pieces) counts[p.motif] = (counts[p.motif] ?? 0) + 1;
  return counts;
}

function balanceScore(pieces: PlacedPiece[]) {
  if (pieces.length === 0) return 0;
  const cx = pieces.reduce((a, p) => a + p.x, 0) / pieces.length;
  const cy = pieces.reduce((a, p) => a + p.y, 0) / pieces.length;
  const off = Math.hypot(cx - 150, cy - 150);
  return Math.max(0, 1 - off / 90);
}

/** 디자인 점수 (0~100). 의뢰가 있으면 요구사항과의 유사도, 없으면 구성의 완성도 */
export function scoreDesign(design: Design, commission?: Commission) {
  const counts = countMotifs(design.pieces);
  if (!commission) {
    const n = design.pieces.length;
    const variety = Object.keys(counts).length;
    return Math.round(
      Math.min(1, n / 6) * 45 + Math.min(1, variety / 3) * 30 + balanceScore(design.pieces) * 25,
    );
  }
  const keys = new Set<MotifId>([
    ...(Object.keys(commission.motifs) as MotifId[]),
    ...(Object.keys(counts) as MotifId[]),
  ]);
  let inter = 0;
  let union = 0;
  for (const k of keys) {
    const a = commission.motifs[k] ?? 0;
    const b = counts[k] ?? 0;
    inter += Math.min(a, b);
    union += Math.max(a, b);
  }
  const motifMatch = union === 0 ? 0 : inter / union;
  const colorMatch = design.lacquer === commission.lacquer ? 1 : 0;
  const pearlMatch = !commission.pearl || commission.pearl === design.pearl ? 1 : 0.3;
  return Math.round(
    motifMatch * 55 + colorMatch * 20 + pearlMatch * 10 + balanceScore(design.pieces) * 15,
  );
}

export function scoreCraft(scores: StepScores) {
  let sum = 0;
  let w = 0;
  for (const [k, v] of Object.entries(scores) as [StepId, number][]) {
    sum += v * STEP_INFO[k].weight;
    w += STEP_INFO[k].weight;
  }
  return w === 0 ? 0 : Math.round(sum / w);
}

export function gradeOf(total: number): Grade {
  if (total >= 90) return "S";
  if (total >= 78) return "A";
  if (total >= 62) return "B";
  if (total >= 45) return "C";
  return "D";
}

export const GRADE_INFO: Record<Grade, { label: string; color: string; rep: number; mult: number }> = {
  S: { label: "명품", color: "#a8433b", rep: 40, mult: 1.5 },
  A: { label: "수작", color: "#a65f62", rep: 25, mult: 1.2 },
  B: { label: "양품", color: "#5b8a74", rep: 14, mult: 1 },
  C: { label: "보통", color: "#66789a", rep: 6, mult: 0.75 },
  D: { label: "아쉬움", color: "#8c8079", rep: 1, mult: 0.45 },
};

export function artworkValue(design: Design, total: number) {
  const base = SHAPES[design.shape].basePrice + design.pieces.length * 12;
  return Math.round(base * PEARLS[design.pearl].bonus * (0.3 + (total / 100) * 1.1));
}

export function reactionFor(grade: Grade, isCommission: boolean) {
  const lines: Record<Grade, string[]> = {
    S: ["세상에… 이건 가보로 물려줘야겠어요!", "빛깔이 살아 숨 쉬는 것 같아요! 최고예요!"],
    A: ["정말 아름다워요. 부탁드리길 잘했어요!", "자개가 영롱하게 반짝여요~"],
    B: ["마음에 들어요. 잘 쓸게요!", "깔끔하게 잘 만들어 주셨네요."],
    C: ["음… 조금 아쉽지만 괜찮아요.", "생각했던 거랑 살짝 달라요."],
    D: ["이건… 다음엔 더 신경 써 주세요.", "옻칠이 고르지 않네요…"],
  };
  const pool = lines[grade];
  return isCommission ? pick(pool) : pick(["공방에 전시해 두면 손님들이 좋아하겠어요!", "멋진 작품이 완성됐어요!"]);
}

export function titleFor(design: Design) {
  const counts = countMotifs(design.pieces);
  const top = (Object.entries(counts) as [MotifId, number][]).sort((a, b) => b[1] - a[1])[0];
  const motifName = top ? MOTIF_LIST.find((m) => m.id === top[0])!.name : "무문";
  const lac = LACQUER_LIST.find((l) => l.id === design.lacquer)!.name;
  return `${lac} ${motifName}문 ${SHAPES[design.shape].name}`;
}
