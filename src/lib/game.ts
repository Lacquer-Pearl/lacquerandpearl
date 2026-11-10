import {
  CUSTOMERS,
  LACQUER_LIST,
  MOTIFS,
  PEARLS,
  SHAPE_MOTIFS,
  SHAPES,
  SHAPE_LIST,
  type LacquerId,
  type MotifId,
  type PearlId,
  type ShapeId,
} from "./data";
import { pickPatron, rememberNpcs, type Patron, type PatronRequest } from "./npcs";

export interface PlacedPiece {
  id: string;
  motif: MotifId;
  x: number;
  y: number;
  /** 배율 */
  s: number;
  /** 회전 (도) */
  r: number;
  /** 자개 종류 (없으면 예전 작품처럼 design.pearl) */
  pearl?: PearlId;
}

export interface Design {
  shape: ShapeId;
  lacquer: LacquerId;
  /** 새로 놓는 조각의 자개 종류 */
  pearl: PearlId;
  pieces: PlacedPiece[];
}

export interface Commission {
  id: string;
  customer: number;
  line: string;
  /** 새로 만든 의뢰의 의뢰인. 없으면 예전 저장의 customer 번호를 쓴다. */
  patron?: Patron;
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
  /** 납품한 의뢰인. 의뢰가 게시판에서 빠져도 이름과 초상화가 유지된다. */
  patron?: Patron;
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

export const piecePearl = (p: PlacedPiece, design: Pick<Design, "pearl">) => p.pearl ?? design.pearl;

export function newPiece(motif: MotifId, pearl: PearlId): PlacedPiece {
  const pattern = MOTIFS[motif].kind === "pattern";
  return {
    id: uid(),
    motif,
    pearl,
    x: 150 + (Math.random() - 0.5) * 140,
    y: 150 + (Math.random() - 0.5) * 120,
    s: pattern ? 1 : 1.3,
    r: 0,
  };
}

/** 0도를 기준으로 15도씩 돌린 각도 (0, 15, …, 345) */
export function turnPiece(r: number, dir: -1 | 1) {
  const step = 15;
  return (((Math.round(r / step) * step + dir * step) % 360) + 360) % 360;
}

/** 자개 종류별로 드는 조각 수 */
export function pearlCost(design: Pick<Design, "pearl" | "pieces">) {
  const sum: Partial<Record<PearlId, number>> = {};
  for (const p of design.pieces) {
    const k = piecePearl(p, design);
    sum[k] = (sum[k] ?? 0) + (MOTIFS[p.motif].cost ?? 1);
  }
  const out: Partial<Record<PearlId, number>> = {};
  for (const [k, v] of Object.entries(sum) as [PearlId, number][]) out[k] = Math.ceil(v);
  return out;
}

/** 줄음질 등에서 대표로 쓰는 자개: 가장 많이 쓴 종류 */
export function mainPearl(design: Pick<Design, "pearl" | "pieces">): PearlId {
  const counts: Partial<Record<PearlId, number>> = {};
  for (const p of design.pieces) {
    const k = piecePearl(p, design);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  return (Object.entries(counts) as [PearlId, number][]).sort((a, b) => b[1] - a[1])[0]?.[0] ?? design.pearl;
}

/** 자개 종류별 자르기 라운드: 등장 순서 + 그 종류에서 가장 많이 쓴 문양 */
export function cutJobs(design: Design): { pearl: PearlId; motif: MotifId }[] {
  if (!design.pieces.length) return [{ pearl: design.pearl, motif: "plum" }];
  const order: PearlId[] = [];
  const byPearl = new Map<PearlId, Partial<Record<MotifId, number>>>();
  for (const p of design.pieces) {
    const pearl = piecePearl(p, design);
    if (!order.includes(pearl)) order.push(pearl);
    const bag = byPearl.get(pearl) ?? {};
    bag[p.motif] = (bag[p.motif] ?? 0) + 1;
    byPearl.set(pearl, bag);
  }
  return order.map((pearl) => {
    const bag = byPearl.get(pearl)!;
    const motif = (Object.entries(bag) as [MotifId, number][]).sort((a, b) => b[1] - a[1])[0][0];
    return { pearl, motif };
  });
}

/** 패턴 단위를 이웃 조각의 격자에 맞춤. 맞출 이웃이 없거나 너무 멀면 그대로 */
export function snapToPattern(piece: PlacedPiece, others: PlacedPiece[]): PlacedPiece {
  const tile = MOTIFS[piece.motif].tile;
  if (!tile) return piece;
  let best: PlacedPiece | undefined;
  let bestD = Infinity;
  for (const o of others) {
    if (o.id === piece.id || o.motif !== piece.motif || Math.abs(o.s - piece.s) > 0.01) continue;
    if ((((o.r - piece.r) % 360) + 360) % 360 > 0.5) continue;
    const d = Math.hypot(o.x - piece.x, o.y - piece.y);
    if (d < bestD) {
      bestD = d;
      best = o;
    }
  }
  if (!best) return piece;
  const { a, b } = tile;
  const th = (-best.r * Math.PI) / 180;
  const vx = ((piece.x - best.x) * Math.cos(th) - (piece.y - best.y) * Math.sin(th)) / best.s;
  const vy = ((piece.x - best.x) * Math.sin(th) + (piece.y - best.y) * Math.cos(th)) / best.s;
  const det = a[0] * b[1] - a[1] * b[0];
  const i = Math.round((vx * b[1] - vy * b[0]) / det);
  const j = Math.round((a[0] * vy - a[1] * vx) / det);
  const pos = latticePos(best, i, j);
  const reach = Math.hypot(a[0], a[1]) * best.s * 0.6;
  if ((i === 0 && j === 0) || Math.hypot(pos.x - piece.x, pos.y - piece.y) > reach) return piece;
  return { ...piece, ...pos };
}

function latticePos(o: PlacedPiece, i: number, j: number) {
  const { a, b } = MOTIFS[o.motif].tile!;
  const lx = (i * a[0] + j * b[0]) * o.s;
  const ly = (i * a[1] + j * b[1]) * o.s;
  const th = (o.r * Math.PI) / 180;
  return { x: o.x + lx * Math.cos(th) - ly * Math.sin(th), y: o.y + lx * Math.sin(th) + ly * Math.cos(th) };
}

/** 패턴 조각 옆 빈자리에 이어 붙일 위치 (빈자리가 없으면 undefined) */
export function nextPatternSlot(o: PlacedPiece, pieces: PlacedPiece[]) {
  const dirs: [number, number][] = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
  for (const [i, j] of dirs) {
    const pos = latticePos(o, i, j);
    if (pos.x < 8 || pos.x > 292 || pos.y < 8 || pos.y > 292) continue;
    if (pieces.some((p) => p.motif === o.motif && Math.hypot(p.x - pos.x, p.y - pos.y) < 2)) continue;
    return pos;
  }
}

function commissionNames(c: Commission) {
  if (c.patron) return [c.patron.nameKo, c.patron.nameEn];
  const legacy = CUSTOMERS[c.customer];
  return legacy ? [legacy.name] : [];
}

export function generateCommission(reputation: number, patrons?: PatronRequest): Commission {
  const tier = Math.min(4, Math.floor(reputation / 120));
  const patron = pickPatron(patrons);
  const shape = pick(SHAPE_LIST).id;
  const lacquer = pick(LACQUER_LIST).id;
  const typeCount = Math.min(3, 1 + Math.floor(Math.random() * (1 + tier * 0.7)) + (Math.random() < 0.35 ? 1 : 0));
  const types = [...SHAPE_MOTIFS].sort(() => Math.random() - 0.5).slice(0, typeCount);
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
  return {
    id: uid(),
    customer: patron.fallbackCustomer,
    line: patron.lineKey,
    patron,
    shape,
    lacquer,
    pearl,
    motifs,
    reward,
  };
}

/** 비어 있는 칸만 채운다. 이미 있는 의뢰의 의뢰인은 바꾸지 않는다. */
export function addCommissions(
  reputation: number,
  existing: Commission[],
  recentIds: string[],
  count: number,
) {
  const added: Commission[] = [];
  const recent = new Set(recentIds);
  for (const c of existing) if (c.patron) recent.add(c.patron.id);
  for (let i = 0; i < count; i++) {
    const batch = [...existing, ...added];
    added.push(
      generateCommission(reputation, {
        avoidIds: batch.flatMap((c) => (c.patron ? [c.patron.id] : [])),
        avoidNames: batch.flatMap(commissionNames),
        recentIds: [...recent],
        avoidLineKeys: batch.flatMap((c) => (c.patron ? [c.patron.lineKey] : [])),
      }),
    );
    const id = added[added.length - 1].patron?.id;
    if (id) recent.add(id);
  }
  return {
    added,
    recentIds: rememberNpcs(
      recentIds,
      added.flatMap((c) => (c.patron ? [c.patron.id] : [])),
    ),
  };
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
  const pearlMatch = !commission.pearl ? 1 : 0.3 + 0.7 * pearlShare(design, commission.pearl);
  return Math.round(
    motifMatch * 55 + colorMatch * 20 + pearlMatch * 10 + balanceScore(design.pieces) * 15,
  );
}

/** 주문한 자개로 붙인 조각의 비율 */
export function pearlShare(design: Design, pearl: PearlId) {
  if (design.pieces.length === 0) return 0;
  return design.pieces.filter((p) => piecePearl(p, design) === pearl).length / design.pieces.length;
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

export const GRADE_INFO: Record<Grade, { color: string; rep: number; mult: number }> = {
  S: { color: "#a8433b", rep: 40, mult: 1.5 },
  A: { color: "#a65f62", rep: 25, mult: 1.2 },
  B: { color: "#5b8a74", rep: 14, mult: 1 },
  C: { color: "#66789a", rep: 6, mult: 0.75 },
  D: { color: "#8c8079", rep: 1, mult: 0.45 },
};

/** 작품 한 점이 지급하는 명성. 의뢰는 전액, 자유 디자인은 절반이다. */
export function reputationGain(grade: Grade, forCommission: boolean) {
  return Math.round(GRADE_INFO[grade].rep * (forCommission ? 1 : 0.5));
}

export function artworkValue(design: Design, total: number) {
  const base = SHAPES[design.shape].basePrice + design.pieces.length * 12;
  const bonus = design.pieces.length
    ? design.pieces.reduce((a, p) => a + PEARLS[piecePearl(p, design)].bonus, 0) / design.pieces.length
    : PEARLS[design.pearl].bonus;
  return Math.round(base * bonus * (0.3 + (total / 100) * 1.1));
}

export function topMotif(design: Design): MotifId | "plain" {
  const counts = countMotifs(design.pieces);
  const top = (Object.entries(counts) as [MotifId, number][]).sort((a, b) => b[1] - a[1])[0];
  return top ? top[0] : "plain";
}

/** @deprecated 표시용 제목은 i18n.artworkTitle 사용 */
export function titleFor(design: Design) {
  const motif = topMotif(design);
  const motifName = motif === "plain" ? "무문" : MOTIFS[motif].name;
  const lac = LACQUER_LIST.find((l) => l.id === design.lacquer)!.name;
  return `${lac} ${motifName}문 ${SHAPES[design.shape].name}`;
}
