/**
 * 줄음질 파손 — 균열 생성, 마스크 분할, 접합 점수.
 * DOM 없이 문양 좌표에서만 계산한다. 재고는 건드리지 않는다.
 * shellWaste 는 기록일 뿐이고, 자개패 구획이 생기면 그 시스템이 shellWasteApplied 로 한 번만 소비한다.
 */

export type FragmentCondition = "intact" | "reusable-broken" | "scrapped";

export interface CrackPoint {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** 문양 좌표에서의 조각 자세. dx, dy 는 문양 원점에서의 이동. */
export interface FragmentPose {
  id: string;
  /** 균열로 나뉜 쪽. 재사용 파손은 0과 1만 쓴다. */
  side: number;
  dx: number;
  dy: number;
  r: number;
}

export interface PieceCutResult {
  pieceId: string;
  motifId: string;
  condition: FragmentCondition;
  fragments: FragmentPose[];
  /** 주 균열. 재사용 파손의 접합 경계. */
  crack: CrackPoint[];
  /** 접합 대응점. 두 조각이 같은 목록을 공유한다. */
  seam: CrackPoint[];
  extraCracks?: CrackPoint[][];
  /** 조각과 같은 순서의 클립 다각형. 그리기와 저장이 이 좌표를 그대로 쓴다. */
  clips: CrackPoint[][];
  cutScore: number;
  /** 재고에 반영하지 않는다. */
  shellWaste: number;
  shellWasteApplied?: boolean;
  /** 불투명 면적 중 각 조각이 차지하는 비율. */
  sideShare: number[];
  splitReason: "intact" | "split" | "miss" | "sliver" | "shard" | "empty";
}

export interface PieceBreakState {
  condition: FragmentCondition;
  crack: CrackPoint[];
  seam: CrackPoint[];
  fragments: FragmentPose[];
  clips: CrackPoint[][];
  extraCracks?: CrackPoint[][];
}

const REST_GAP = 1.15;
const SCRAP_GAP = 11;
const MIN_SIDE = 0.18;

export function unappliedShellWaste(result: Pick<PieceCutResult, "shellWaste" | "shellWasteApplied">) {
  if (result.shellWasteApplied) return 0;
  return Math.max(0, result.shellWaste || 0);
}

export function readBreak(piece: { breakState?: { condition?: string } | null }): FragmentCondition {
  const condition = piece.breakState?.condition;
  if (condition === "reusable-broken" || condition === "scrapped" || condition === "intact") return condition;
  return "intact";
}

export function hasBrokenShape(piece: { breakState?: PieceBreakState | null }) {
  const state = piece.breakState;
  if (!state || state.condition === "intact") return false;
  return !!state.clips?.length && state.fragments?.length === state.clips.length;
}

export function breakStateFrom(result: PieceCutResult, fragments = result.fragments): PieceBreakState {
  return {
    condition: result.condition,
    crack: result.crack,
    seam: result.seam,
    fragments,
    clips: result.clips,
    extraCracks: result.extraCracks,
  };
}

export function intactResult(pieceId: string, motifId: string, cutScore: number, shellWaste = 0): PieceCutResult {
  return {
    pieceId,
    motifId,
    condition: "intact",
    fragments: [{ id: `${pieceId}-whole`, side: 0, dx: 0, dy: 0, r: 0 }],
    crack: [],
    seam: [],
    clips: [],
    cutScore,
    shellWaste,
    shellWasteApplied: false,
    sideShare: [1],
    splitReason: "intact",
  };
}

export function shellThickness(kind: string, stamped: boolean) {
  if (kind === "pattern") return 1.12;
  if (!stamped) return 0.74;
  return 0.9;
}

export function hashSeed(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function screenToMotif(point: CrackPoint, fit: { ox: number; oy: number; scale: number }): CrackPoint {
  return { x: (point.x - 150) / fit.scale + fit.ox, y: (point.y - 150) / fit.scale + fit.oy };
}

export function fragmentTarget(
  piece: { x: number; y: number; r: number; s: number },
  frag: Pick<FragmentPose, "dx" | "dy">,
): CrackPoint {
  const th = (piece.r * Math.PI) / 180;
  const cs = Math.cos(th);
  const sn = Math.sin(th);
  return {
    x: piece.x + (frag.dx * cs - frag.dy * sn) * piece.s,
    y: piece.y + (frag.dx * sn + frag.dy * cs) * piece.s,
  };
}

export function dropToPose(
  piece: { x: number; y: number; r: number; s: number },
  drop: CrackPoint,
  extraR: number,
  frag: FragmentPose,
): FragmentPose {
  const th = (piece.r * Math.PI) / 180;
  const cs = Math.cos(th);
  const sn = Math.sin(th);
  const vx = (drop.x - piece.x) / (piece.s || 1);
  const vy = (drop.y - piece.y) / (piece.s || 1);
  return { ...frag, dx: vx * cs + vy * sn, dy: -vx * sn + vy * cs, r: extraR };
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function hypot(x: number, y: number) {
  return Math.hypot(x, y);
}

function sub(a: CrackPoint, b: CrackPoint): CrackPoint {
  return { x: a.x - b.x, y: a.y - b.y };
}

function unit(v: CrackPoint): CrackPoint {
  const len = hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

function expand(bounds: Bounds, pad: number): Bounds {
  return { x: bounds.x - pad, y: bounds.y - pad, w: bounds.w + pad * 2, h: bounds.h + pad * 2 };
}

function dedupe(points: CrackPoint[]) {
  const out: CrackPoint[] = [];
  for (const point of points) {
    const prev = out[out.length - 1];
    if (!prev || hypot(prev.x - point.x, prev.y - point.y) > 0.04) out.push(point);
  }
  if (out.length > 2) {
    const first = out[0];
    const last = out[out.length - 1];
    if (hypot(first.x - last.x, first.y - last.y) < 0.08) out.pop();
  }
  return out;
}

export function pointsToPath(points: CrackPoint[]) {
  if (!points.length) return "";
  return points.map((point, i) => `${i ? "L" : "M"}${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(" ") + " Z";
}

export function pointInPolygon(point: CrackPoint, polygon: CrackPoint[]) {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const hit = a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-9) + a.x;
    if (hit) inside = !inside;
  }
  return inside;
}

export function crackSide(crack: CrackPoint[], point: CrackPoint) {
  let best = Infinity;
  let sign = 1;
  for (let i = 0; i < crack.length - 1; i++) {
    const a = crack[i];
    const b = crack[i + 1];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const len2 = vx * vx + vy * vy || 1;
    const t = clamp(((point.x - a.x) * vx + (point.y - a.y) * vy) / len2, 0, 1);
    const qx = a.x + vx * t;
    const qy = a.y + vy * t;
    const dist = (point.x - qx) ** 2 + (point.y - qy) ** 2;
    if (dist < best) {
      best = dist;
      const cross = vx * (point.y - a.y) - vy * (point.x - a.x);
      sign = cross >= 0 ? 1 : -1;
    }
  }
  return sign;
}

function distToPolyline(point: CrackPoint, line: CrackPoint[]) {
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const vx = b.x - a.x;
    const vy = b.y - a.y;
    const len2 = vx * vx + vy * vy || 1;
    const t = clamp(((point.x - a.x) * vx + (point.y - a.y) * vy) / len2, 0, 1);
    best = Math.min(best, hypot(point.x - (a.x + vx * t), point.y - (a.y + vy * t)));
  }
  return best;
}

function rayToBox(from: CrackPoint, dir: CrackPoint, box: Bounds) {
  const minX = box.x;
  const maxX = box.x + box.w;
  const minY = box.y;
  const maxY = box.y + box.h;
  let tHit = Infinity;
  const consider = (t: number) => {
    if (t <= 0.001 || t >= tHit) return;
    const x = from.x + dir.x * t;
    const y = from.y + dir.y * t;
    if (x >= minX - 0.05 && x <= maxX + 0.05 && y >= minY - 0.05 && y <= maxY + 0.05) tHit = t;
  };
  if (Math.abs(dir.x) > 1e-8) {
    consider((minX - from.x) / dir.x);
    consider((maxX - from.x) / dir.x);
  }
  if (Math.abs(dir.y) > 1e-8) {
    consider((minY - from.y) / dir.y);
    consider((maxY - from.y) / dir.y);
  }
  if (!Number.isFinite(tHit)) tHit = Math.max(box.w, box.h);
  return { x: from.x + dir.x * tHit, y: from.y + dir.y * tHit };
}

function snapToPerimeter(point: CrackPoint, box: Bounds): CrackPoint {
  const minX = box.x;
  const maxX = box.x + box.w;
  const minY = box.y;
  const maxY = box.y + box.h;
  const x = clamp(point.x, minX, maxX);
  const y = clamp(point.y, minY, maxY);
  const dist = [
    { d: Math.abs(y - minY), p: { x, y: minY } },
    { d: Math.abs(x - maxX), p: { x: maxX, y } },
    { d: Math.abs(y - maxY), p: { x, y: maxY } },
    { d: Math.abs(x - minX), p: { x: minX, y } },
  ].sort((a, b) => a.d - b.d)[0];
  return dist.p;
}

function boundaryPos(point: CrackPoint, box: Bounds) {
  const minX = box.x;
  const maxX = box.x + box.w;
  const minY = box.y;
  const maxY = box.y + box.h;
  const snapped = snapToPerimeter(point, box);
  const eps = 0.08;
  if (Math.abs(snapped.y - minY) < eps) return clamp(snapped.x - minX, 0, box.w);
  if (Math.abs(snapped.x - maxX) < eps) return box.w + clamp(snapped.y - minY, 0, box.h);
  if (Math.abs(snapped.y - maxY) < eps) return box.w + box.h + clamp(maxX - snapped.x, 0, box.w);
  return box.w * 2 + box.h + clamp(maxY - snapped.y, 0, box.h);
}

function perimeterOf(box: Bounds) {
  return 2 * (box.w + box.h);
}

/** y가 아래로 증가하는 화면에서 시계 방향. */
function walkClockwise(from: CrackPoint, to: CrackPoint, box: Bounds) {
  const per = perimeterOf(box);
  const start = boundaryPos(from, box);
  const end = boundaryPos(to, box);
  let dist = (end - start + per) % per;
  if (dist < 0.15) return [to];
  const corners = [
    { pos: 0, p: { x: box.x, y: box.y } },
    { pos: box.w, p: { x: box.x + box.w, y: box.y } },
    { pos: box.w + box.h, p: { x: box.x + box.w, y: box.y + box.h } },
    { pos: box.w * 2 + box.h, p: { x: box.x, y: box.y + box.h } },
  ];
  const mid = corners
    .map((corner) => ({ ...corner, d: (corner.pos - start + per) % per }))
    .filter((corner) => corner.d > 0.2 && corner.d < dist - 0.2)
    .sort((a, b) => a.d - b.d)
    .map((corner) => corner.p);
  return [...mid, to];
}

function rayOut(
  origin: CrackPoint,
  dir: CrackPoint,
  tangent: CrackPoint,
  amp: number,
  rng: () => number,
  box: Bounds,
) {
  const points: CrackPoint[] = [{ ...origin }];
  let x = origin.x;
  let y = origin.y;
  const step = Math.hypot(box.w, box.h) * 0.13;
  for (let i = 0; i < 3; i++) {
    const jitter = (rng() - 0.5) * 2 * amp;
    x += dir.x * step + tangent.x * jitter;
    y += dir.y * step + tangent.y * jitter;
    points.push({ x, y });
  }
  const prev = points[points.length - 2];
  const last = points[points.length - 1];
  const heading = unit(sub(last, prev));
  points[points.length - 1] = rayToBox(prev, heading, box);
  return points;
}

export interface CrackRays {
  rays: CrackPoint[][];
  /** 접합에 쓰는 경계. 양쪽 가장자리까지 이어진 주 균열. */
  crack: CrackPoint[];
  extra: CrackPoint[][];
  severe: boolean;
}

export function generateCrackRays(opts: {
  origin: CrackPoint;
  direction: CrackPoint;
  bounds: Bounds;
  stress: number;
  error: number;
  thickness: number;
  seed: number;
}): CrackRays {
  const rng = mulberry32(opts.seed || 1);
  const heading = unit(hypot(opts.direction.x, opts.direction.y) < 1e-4 ? { x: 1, y: 0 } : opts.direction);
  const normal = { x: -heading.y, y: heading.x };
  const box = expand(opts.bounds, 1.2);
  const span = Math.max(opts.bounds.w, opts.bounds.h, 1);
  const severity = clamp(opts.stress / 2, 0, 1) * 0.55 + clamp(opts.error / 48, 0, 1) * 0.45;
  const thin = clamp(1.05 - opts.thickness, 0, 0.45);
  const amp = span * (0.028 + thin * 0.025 + severity * 0.03);
  const severe = opts.stress > 1.12 + opts.thickness * 0.28 || opts.error > 24 + opts.thickness * 10;
  const tangent = heading;
  if (!severe) {
    const forward = rayOut(opts.origin, normal, tangent, amp, rng, box);
    const back = rayOut(opts.origin, { x: -normal.x, y: -normal.y }, tangent, amp, rng, box);
    const crack = dedupe([...[...back].reverse().slice(0, -1), ...forward]);
    return { rays: [back, forward], crack, extra: [], severe: false };
  }
  const base = Math.atan2(normal.y, normal.x);
  const rays = [0, 120, 240].map((deg) => {
    const ang = base + (deg * Math.PI) / 180;
    const dir = { x: Math.cos(ang), y: Math.sin(ang) };
    return rayOut(opts.origin, dir, { x: -dir.y, y: dir.x }, amp * 0.85, rng, box);
  });
  const crack = dedupe([...[...rays[0]].reverse().slice(0, -1), ...rays[1]]);
  return { rays, crack, extra: rays.slice(2), severe: true };
}

export function buildWedges(rays: CrackPoint[][], bounds: Bounds): CrackPoint[][] {
  if (rays.length < 2) return [];
  const box = expand(bounds, 1.2);
  const origin = rays[0][0];
  const ordered = rays
    .map((ray) => {
      const end = ray[ray.length - 1];
      return { ray, angle: Math.atan2(end.y - origin.y, end.x - origin.x) };
    })
    .sort((a, b) => a.angle - b.angle);
  return ordered.map((current, index) => {
    const next = ordered[(index + 1) % ordered.length];
    const endA = snapToPerimeter(current.ray[current.ray.length - 1], box);
    const endB = snapToPerimeter(next.ray[next.ray.length - 1], box);
    const arc = walkClockwise(endA, endB, box);
    const outward = current.ray.map((point, i) => (i === current.ray.length - 1 ? endA : point));
    const back = [...next.ray.map((point, i) => (i === next.ray.length - 1 ? endB : point))].reverse();
    return dedupe([...outward, ...arc, ...back]);
  });
}

export interface SplitReport {
  ok: boolean;
  reason: "split" | "miss" | "sliver" | "shard" | "empty";
  total: number;
  shares: number[];
  crackedParts: number;
}

export function analyzeSplit(polygons: CrackPoint[][], wedges: CrackPoint[][], cracks: CrackPoint[][], bounds: Bounds): SplitReport {
  const empty: SplitReport = { ok: false, reason: "empty", total: 0, shares: [], crackedParts: 0 };
  const shapes = polygons.filter((polygon) => polygon.length >= 3);
  if (!shapes.length || wedges.length < 2) return empty;
  const step = Math.max(0.42, Math.max(bounds.w, bounds.h) / 92);
  const cols = Math.max(1, Math.ceil(bounds.w / step));
  const rows = Math.max(1, Math.ceil(bounds.h / step));
  const crackWidth = step * 1.05;
  const cellPoly = new Int16Array(cols * rows);
  const cellWedge = new Int16Array(cols * rows);
  cellWedge.fill(-2);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const point = { x: bounds.x + (col + 0.5) * step, y: bounds.y + (row + 0.5) * step };
      let poly = 0;
      for (let i = 0; i < shapes.length; i++) {
        if (pointInPolygon(point, shapes[i])) {
          poly = i + 1;
          break;
        }
      }
      if (!poly) continue;
      const index = row * cols + col;
      cellPoly[index] = poly;
      const onCrack = cracks.some((crack) => distToPolyline(point, crack) <= crackWidth);
      if (onCrack) {
        cellWedge[index] = -1;
        continue;
      }
      let hit = -1;
      for (let i = 0; i < wedges.length; i++) {
        if (!pointInPolygon(point, wedges[i])) continue;
        if (hit >= 0) {
          hit = -1;
          break;
        }
        hit = i;
      }
      cellWedge[index] = hit;
    }
  }

  let total = 0;
  const wedgeCount = wedges.map(() => 0);
  for (let i = 0; i < cellPoly.length; i++) {
    if (!cellPoly[i]) continue;
    total++;
    const wedge = cellWedge[i];
    if (wedge >= 0) wedgeCount[wedge]++;
  }
  if (total < 8) return empty;
  const shares = wedgeCount.map((count) => count / total);
  const before = unionParts(cellPoly, null, cols, rows, total);
  const after = unionParts(cellPoly, cellWedge, cols, rows, total);
  const crackedParts = Math.max(0, after - before);
  const uncovered = 1 - shares.reduce((sum, share) => sum + share, 0);
  if (uncovered > 0.08) return { ok: false, reason: "miss", total, shares, crackedParts };
  if (crackedParts < 1) return { ok: false, reason: "miss", total, shares, crackedParts };
  if (wedges.length !== 2) return { ok: false, reason: "shard", total, shares, crackedParts };
  if (shares.some((share) => share < MIN_SIDE)) return { ok: false, reason: "sliver", total, shares, crackedParts };
  return { ok: true, reason: "split", total, shares, crackedParts };
}

/** 균열을 빼기 전·후의 연결 덩어리 수. 먼지 조각은 세지 않는다. */
function unionParts(polys: Int16Array, wedges: Int16Array | null, cols: number, rows: number, total: number) {
  const seen = new Uint8Array(polys.length);
  const stack: number[] = [];
  let parts = 0;
  const dust = Math.max(4, total * 0.012);
  for (let start = 0; start < polys.length; start++) {
    if (seen[start] || !polys[start]) continue;
    if (wedges && wedges[start] < 0) continue;
    let size = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const index = stack.pop() as number;
      size++;
      const col = index % cols;
      const row = (index - col) / cols;
      const next = [
        col > 0 ? index - 1 : -1,
        col + 1 < cols ? index + 1 : -1,
        row > 0 ? index - cols : -1,
        row + 1 < rows ? index + cols : -1,
      ];
      for (const neighbor of next) {
        if (neighbor < 0 || seen[neighbor] || !polys[neighbor]) continue;
        if (wedges && wedges[neighbor] < 0) continue;
        seen[neighbor] = 1;
        stack.push(neighbor);
      }
    }
    if (size >= dust) parts++;
  }
  return parts;
}

function outwardPose(clip: CrackPoint[], bounds: Bounds, gap: number) {
  let x = 0;
  let y = 0;
  for (const point of clip) {
    x += point.x;
    y += point.y;
  }
  const cx = x / Math.max(1, clip.length);
  const cy = y / Math.max(1, clip.length);
  const ox = bounds.x + bounds.w / 2;
  const oy = bounds.y + bounds.h / 2;
  const dir = unit({ x: cx - ox, y: cy - oy });
  return { dx: dir.x * gap, dy: dir.y * gap };
}

export function seamSamples(crack: CrackPoint[], count = 7): CrackPoint[] {
  if (crack.length < 2) return [];
  const lengths = [0];
  for (let i = 1; i < crack.length; i++) lengths.push(lengths[i - 1] + hypot(crack[i].x - crack[i - 1].x, crack[i].y - crack[i - 1].y));
  const total = lengths[lengths.length - 1] || 1;
  const out: CrackPoint[] = [];
  for (let i = 0; i < count; i++) {
    const target = (total * (i + 0.5)) / count;
    let seg = 1;
    while (seg < lengths.length - 1 && lengths[seg] < target) seg++;
    const span = lengths[seg] - lengths[seg - 1] || 1;
    const t = clamp((target - lengths[seg - 1]) / span, 0, 1);
    const a = crack[seg - 1];
    const b = crack[seg];
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

export interface BreakInput {
  pieceId: string;
  motifId: string;
  polygons: CrackPoint[][];
  bounds: Bounds;
  origin: CrackPoint;
  direction: CrackPoint;
  stress: number;
  error: number;
  thickness: number;
  seed: number;
  cutScore: number;
  shellWaste: number;
}

export function evaluateBreak(input: BreakInput): PieceCutResult {
  const rays = generateCrackRays(input);
  const wedges = buildWedges(rays.rays, input.bounds);
  const report = analyzeSplit(input.polygons, wedges, rays.rays, input.bounds);
  const reusable = report.ok && !rays.severe;
  const showShards = report.reason !== "miss" && report.reason !== "empty" && wedges.length >= 2;
  const gap = reusable ? REST_GAP : SCRAP_GAP;
  const fragments: FragmentPose[] = showShards
    ? wedges.map((clip, index) => ({
        id: `${input.pieceId}-${reusable ? (index === 0 ? "a" : "b") : `s${index}`}`,
        side: index,
        r: 0,
        ...outwardPose(clip, input.bounds, gap),
      }))
    : [];
  return {
    pieceId: input.pieceId,
    motifId: input.motifId,
    condition: reusable ? "reusable-broken" : "scrapped",
    fragments,
    crack: rays.crack,
    seam: seamSamples(rays.crack, 7),
    extraCracks: rays.extra.length ? rays.extra : undefined,
    clips: showShards ? wedges : [],
    cutScore: input.cutScore,
    shellWaste: input.shellWaste,
    shellWasteApplied: false,
    sideShare: report.shares,
    splitReason: reusable ? "split" : report.reason,
  };
}

function applyPose(point: CrackPoint, pose: Pick<FragmentPose, "dx" | "dy" | "r">): CrackPoint {
  const th = (pose.r * Math.PI) / 180;
  const cs = Math.cos(th);
  const sn = Math.sin(th);
  return { x: point.x * cs - point.y * sn + pose.dx, y: point.x * sn + point.y * cs + pose.dy };
}

function angleDiff(a: number, b: number) {
  const d = ((((a - b) % 360) + 540) % 360) - 180;
  return Math.abs(d);
}

export function scoreSeamJoin(seam: CrackPoint[], designed: FragmentPose[], placed: FragmentPose[]) {
  const designed0 = designed.find((frag) => frag.side === 0);
  const designed1 = designed.find((frag) => frag.side === 1);
  const placed0 = placed.find((frag) => frag.side === 0);
  const placed1 = placed.find((frag) => frag.side === 1);
  if (!designed0 || !designed1 || !placed0 || !placed1) {
    return { score: 0, pos: 0, seam: 0, overlap: 0, rotation: 0 };
  }
  const pos =
    (hypot(placed0.dx - designed0.dx, placed0.dy - designed0.dy) +
      hypot(placed1.dx - designed1.dx, placed1.dy - designed1.dy)) /
    2;
  const samples = seam.length ? seam : [{ x: 0, y: 0 }];
  let seamErr = 0;
  let overlap = 0;
  for (const sample of samples) {
    const designedGap = sub(applyPose(sample, designed0), applyPose(sample, designed1));
    const placedGap = sub(applyPose(sample, placed0), applyPose(sample, placed1));
    seamErr += hypot(placedGap.x - designedGap.x, placedGap.y - designedGap.y);
    const dist = hypot(placedGap.x, placedGap.y);
    const want = hypot(designedGap.x, designedGap.y);
    if (dist + 0.35 < want) overlap += want - dist;
  }
  seamErr /= samples.length;
  overlap /= samples.length;
  const rotation = (angleDiff(placed0.r, designed0.r) + angleDiff(placed1.r, designed1.r)) / 2;
  const posN = Math.min(1, pos / 9);
  const seamN = Math.min(1, seamErr / 7);
  const rotN = Math.min(1, rotation / 32);
  const overN = Math.min(1, overlap / 3.5);
  const score = clamp(100 * (1 - (posN * 0.34 + seamN * 0.28 + rotN * 0.22 + overN * 0.16)), 0, 100);
  return { score, pos, seam: seamErr, overlap, rotation };
}

function ellipseArc(
  x0: number,
  y0: number,
  rx: number,
  ry: number,
  angle: number,
  large: number,
  sweep: number,
  x1: number,
  y1: number,
  dest: CrackPoint[],
) {
  const phi = (angle * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (rx < 1e-5 || ry < 1e-5) {
    dest.push({ x: x1, y: y1 });
    return;
  }
  const dx = (x0 - x1) / 2;
  const dy = (y0 - y1) / 2;
  const x1p = cos * dx + sin * dy;
  const y1p = -sin * dx + cos * dy;
  let rx2 = rx * rx;
  let ry2 = ry * ry;
  const lam = (x1p * x1p) / rx2 + (y1p * y1p) / ry2;
  if (lam > 1) {
    const scale = Math.sqrt(lam);
    rx *= scale;
    ry *= scale;
    rx2 = rx * rx;
    ry2 = ry * ry;
  }
  const sign = large === sweep ? -1 : 1;
  const sq = Math.max(0, (rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p) / (rx2 * y1p * y1p + ry2 * x1p * x1p));
  const coef = sign * Math.sqrt(sq);
  const cxp = (coef * (rx * y1p)) / ry;
  const cyp = (coef * -(ry * x1p)) / rx;
  const cx = cos * cxp - sin * cyp + (x0 + x1) / 2;
  const cy = sin * cxp + cos * cyp + (y0 + y1) / 2;
  const ang = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = hypot(ux, uy) * hypot(vx, vy) || 1;
    let a = Math.acos(clamp(dot / len, -1, 1));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const theta1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dtheta = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sweep && dtheta > 0) dtheta -= Math.PI * 2;
  if (sweep && dtheta < 0) dtheta += Math.PI * 2;
  const steps = Math.max(4, Math.ceil(Math.abs(dtheta) / (Math.PI / 7)));
  for (let i = 1; i <= steps; i++) {
    const t = theta1 + (dtheta * i) / steps;
    const ex = rx * Math.cos(t);
    const ey = ry * Math.sin(t);
    dest.push({ x: cx + cos * ex - sin * ey, y: cy + sin * ex + cos * ey });
  }
}

export function pathToPolygons(d: string): CrackPoint[][] {
  const tokens = d.match(/[MmLlHhVvCcQqSsTtAaZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/g) ?? [];
  const polygons: CrackPoint[][] = [];
  let current: CrackPoint[] = [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  let cmd = "M";
  const read = () => Number(tokens[i++]);
  const open = () => {
    if (current.length >= 3) polygons.push(current);
    current = [];
  };
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const code = cmd.toUpperCase();
    if (code === "Z") {
      if (current.length) current.push({ x: sx, y: sy });
      open();
      cx = sx;
      cy = sy;
      continue;
    }
    if (code === "M") {
      open();
      cx = (rel ? cx : 0) + read();
      cy = (rel ? cy : 0) + read();
      sx = cx;
      sy = cy;
      current = [{ x: cx, y: cy }];
      cmd = rel ? "l" : "L";
      continue;
    }
    if (code === "L") {
      cx = (rel ? cx : 0) + read();
      cy = (rel ? cy : 0) + read();
      current.push({ x: cx, y: cy });
      continue;
    }
    if (code === "H") {
      cx = (rel ? cx : 0) + read();
      current.push({ x: cx, y: cy });
      continue;
    }
    if (code === "V") {
      cy = (rel ? cy : 0) + read();
      current.push({ x: cx, y: cy });
      continue;
    }
    if (code === "C") {
      const p0 = { x: cx, y: cy };
      const p1 = { x: (rel ? cx : 0) + read(), y: (rel ? cy : 0) + read() };
      const p2 = { x: (rel ? cx : 0) + read(), y: (rel ? cy : 0) + read() };
      cx = (rel ? cx : 0) + read();
      cy = (rel ? cy : 0) + read();
      const p3 = { x: cx, y: cy };
      for (let step = 1; step <= 6; step++) {
        const t = step / 6;
        const u = 1 - t;
        current.push({
          x: u ** 3 * p0.x + 3 * u ** 2 * t * p1.x + 3 * u * t ** 2 * p2.x + t ** 3 * p3.x,
          y: u ** 3 * p0.y + 3 * u ** 2 * t * p1.y + 3 * u * t ** 2 * p2.y + t ** 3 * p3.y,
        });
      }
      continue;
    }
    if (code === "Q") {
      const p0 = { x: cx, y: cy };
      const p1 = { x: (rel ? cx : 0) + read(), y: (rel ? cy : 0) + read() };
      cx = (rel ? cx : 0) + read();
      cy = (rel ? cy : 0) + read();
      const p2 = { x: cx, y: cy };
      for (let step = 1; step <= 5; step++) {
        const t = step / 5;
        const u = 1 - t;
        current.push({
          x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
          y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
        });
      }
      continue;
    }
    if (code === "A") {
      const rx = read();
      const ry = read();
      const ang = read();
      const large = read();
      const sweep = read();
      const x = (rel ? cx : 0) + read();
      const y = (rel ? cy : 0) + read();
      ellipseArc(cx, cy, rx, ry, ang, large, sweep, x, y, current);
      cx = x;
      cy = y;
      continue;
    }
    break;
  }
  open();
  return polygons;
}

export function polygonsFromPaths(paths: string[]) {
  return paths.flatMap((d) => pathToPolygons(d));
}
