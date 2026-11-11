/**
 * 자개패 구획. 문양 수가 아니라 자개패 위에 올린 실루엣으로 장수를 정한다.
 * 규격은 게임 밸런스용 상수이며, 재고 차감은 commitNest 에서만 일어난다.
 */
export interface CrackPoint {
  x: number;
  y: number;
}

export type ShellPearl = "white" | "abalone" | "black" | "paua";

function pointInPolygon(point: CrackPoint, polygon: CrackPoint[]) {
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

export const CELL = 2;
export const KERF_CELLS = 1;
const SCAN = 4;

/** 게임용 자개패 규격. rotations 가 있으면 그 각도만 허용하고, 없으면 자동은 90도, 수동은 15도다. */
export interface ShellSpec {
  width: number;
  height: number;
  rotations: number[] | null;
}

export const SHELL_SPECS: Record<ShellPearl, ShellSpec> = {
  white: { width: 168, height: 112, rotations: null },
  abalone: { width: 148, height: 100, rotations: null },
  black: { width: 136, height: 92, rotations: null },
  paua: { width: 156, height: 104, rotations: null },
};

export const AUTO_ROTATIONS = [0, 90, 180, 270];

export interface ShellPlacement {
  pieceId: string;
  motifId: string;
  sheetId: string;
  x: number;
  y: number;
  r: number;
  s: number;
  locked?: boolean;
}

export interface ShellSheet {
  id: string;
  pearl: ShellPearl;
  width: number;
  height: number;
  status: "active" | "exhausted";
  cutPieceIds: string[];
  placements: ShellPlacement[];
}

export interface ShellLedger {
  sheets: ShellSheet[];
}

export interface ShellPlan {
  /** 이번 제작에서 새로 연 장. 원장에 있으면 다시 차감하지 않는다. */
  sheets: ShellSheet[];
  placements: ShellPlacement[];
  confirmed?: boolean;
}

export interface NestPiece {
  id: string;
  motifId: string;
  pearl: ShellPearl;
  s: number;
  polygons: CrackPoint[][];
  locked?: boolean;
}

export type FitReason = "ok" | "outside" | "overlap" | "rotation" | "pearl";

export function rectPoly(w: number, h: number): CrackPoint[][] {
  return [
    [
      { x: -w / 2, y: -h / 2 },
      { x: w / 2, y: -h / 2 },
      { x: w / 2, y: h / 2 },
      { x: -w / 2, y: h / 2 },
    ],
  ];
}

export function autoRotations(spec: ShellSpec) {
  return spec.rotations ?? AUTO_ROTATIONS;
}

export function rotationAllowed(spec: ShellSpec, r: number) {
  if (!spec.rotations) return true;
  const norm = ((r % 360) + 360) % 360;
  return spec.rotations.some((item) => Math.abs(item - norm) < 0.01);
}

function offsetsFor(polygons: CrackPoint[][], s: number, r: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of polygons) {
    for (const point of poly) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  if (!Number.isFinite(minX)) return [] as Array<[number, number]>;
  const reach = (Math.hypot(maxX - minX, maxY - minY) * s) / 2 + CELL * (KERF_CELLS + 2);
  const th = (r * Math.PI) / 180;
  const cs = Math.cos(th);
  const sn = Math.sin(th);
  const raw = new Set<string>();
  for (let y = -reach; y <= reach; y += CELL) {
    for (let x = -reach; x <= reach; x += CELL) {
      const lx = (x * cs + y * sn) / (s || 1);
      const ly = (-x * sn + y * cs) / (s || 1);
      if (!polygons.some((poly) => pointInPolygon({ x: lx, y: ly }, poly))) continue;
      raw.add(`${Math.round(x / CELL)},${Math.round(y / CELL)}`);
    }
  }
  const dilated = new Set(raw);
  for (const key of raw) {
    const [i, j] = key.split(",").map(Number);
    for (let a = -KERF_CELLS; a <= KERF_CELLS; a++) {
      for (let b = -KERF_CELLS; b <= KERF_CELLS; b++) dilated.add(`${i + a},${j + b}`);
    }
  }
  return [...dilated].map((key) => key.split(",").map(Number) as [number, number]);
}

function worldKey(x: number, y: number, i: number, j: number) {
  return `${Math.floor((x + i * CELL) / CELL)},${Math.floor((y + j * CELL) / CELL)}`;
}

export function poseKeys(polygons: CrackPoint[][], s: number, r: number, x: number, y: number) {
  return offsetsFor(polygons, s, r).map(([i, j]) => ({
    key: worldKey(x, y, i, j),
    wx: x + i * CELL,
    wy: y + j * CELL,
  }));
}

export function placementFits(
  sheet: Pick<ShellSheet, "id" | "pearl" | "width" | "height">,
  piece: NestPiece,
  pose: Pick<ShellPlacement, "x" | "y" | "r">,
  occupied: Set<string>,
  spec = SHELL_SPECS[sheet.pearl],
): FitReason {
  if (piece.pearl !== sheet.pearl) return "pearl";
  if (!rotationAllowed(spec, pose.r)) return "rotation";
  const cells = poseKeys(piece.polygons, piece.s, pose.r, pose.x, pose.y);
  if (!cells.length) return "outside";
  for (const cell of cells) {
    if (cell.wx < 0 || cell.wy < 0 || cell.wx > sheet.width || cell.wy > sheet.height) return "outside";
    if (occupied.has(cell.key)) return "overlap";
  }
  return "ok";
}

function occupy(target: Set<string>, polygons: CrackPoint[][], placement: ShellPlacement) {
  for (const cell of poseKeys(polygons, placement.s, placement.r, placement.x, placement.y)) {
    target.add(cell.key);
  }
}

export function occupiedKeys(
  sheet: ShellSheet,
  polygonsFor: (placement: ShellPlacement) => CrackPoint[][],
  skipPieceId?: string,
) {
  const keys = new Set<string>();
  for (const placement of sheet.placements) {
    if (placement.pieceId === skipPieceId) continue;
    occupy(keys, polygonsFor(placement), placement);
  }
  return keys;
}

function bboxArea(polygons: CrackPoint[][], s: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const poly of polygons) {
    for (const point of poly) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  if (!Number.isFinite(minX)) return 0;
  return (maxX - minX) * (maxY - minY) * s * s;
}

function fitsOffsets(
  sheet: Pick<ShellSheet, "width" | "height">,
  offsets: Array<[number, number]>,
  x: number,
  y: number,
  occupied: Set<string>,
) {
  if (!offsets.length) return false;
  for (const [i, j] of offsets) {
    const wx = x + i * CELL;
    const wy = y + j * CELL;
    if (wx < 0 || wy < 0 || wx > sheet.width || wy > sheet.height) return false;
    if (occupied.has(worldKey(x, y, i, j))) return false;
  }
  return true;
}

function firstFit(sheet: ShellSheet, piece: NestPiece, occupied: Set<string>, spec: ShellSpec): ShellPlacement | null {
  const rotations = autoRotations(spec).map((r) => ({ r, offsets: offsetsFor(piece.polygons, piece.s, r) }));
  for (let y = 0; y <= sheet.height; y += SCAN) {
    for (let x = 0; x <= sheet.width; x += SCAN) {
      for (const rotation of rotations) {
        if (!fitsOffsets(sheet, rotation.offsets, x, y, occupied)) continue;
        return {
          pieceId: piece.id,
          motifId: piece.motifId,
          sheetId: sheet.id,
          x,
          y,
          r: rotation.r,
          s: piece.s,
          ...(piece.locked ? { locked: true } : {}),
        };
      }
    }
  }
  return null;
}

export function sheetId() {
  return `sheet-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeSheet(pearl: ShellPearl, id = sheetId()): ShellSheet {
  const spec = SHELL_SPECS[pearl];
  return { id, pearl, width: spec.width, height: spec.height, status: "active", cutPieceIds: [], placements: [] };
}

export interface AutoNestResult {
  sheets: ShellSheet[];
  placements: ShellPlacement[];
  unplaced: string[];
  /** 이번에 새로 연 장. 이미 쓰던 장은 빠진다. */
  opened: ShellSheet[];
}

/**
 * 큰 문양부터, 이미 열린 자개패의 빈자리를 먼저 쓰고, 없을 때만 새 장을 연다.
 * 고정된 배치는 옮기지 않는다. 최적해를 보장하지 않는다.
 */
export function autoNest(pieces: NestPiece[], sheets: ShellSheet[], unopened: Partial<Record<ShellPearl, number>>): AutoNestResult {
  const cutIds = new Set(sheets.flatMap((sheet) => sheet.cutPieceIds));
  const queue = pieces
    .filter((piece) => !piece.locked && !cutIds.has(piece.id))
    .sort((a, b) => bboxArea(b.polygons, b.s) - bboxArea(a.polygons, a.s));
  const moving = new Set(queue.map((piece) => piece.id));
  const working = sheets.map((sheet) => ({
    ...sheet,
    placements: sheet.placements.filter((item) => !moving.has(item.pieceId)),
    cutPieceIds: [...sheet.cutPieceIds],
  }));
  const opened: ShellSheet[] = [];
  const stock = { ...unopened };
  const polygons = new Map(pieces.map((piece) => [piece.id, piece.polygons]));
  const polygonsFor = (placement: ShellPlacement) => polygons.get(placement.pieceId) ?? rectPoly(8, 8);
  const occupied = new Map<string, Set<string>>();
  for (const sheet of working) occupied.set(sheet.id, occupiedKeys(sheet, polygonsFor));

  const locked = new Set(pieces.filter((piece) => piece.locked || cutIds.has(piece.id)).map((piece) => piece.id));
  const unplaced: string[] = [];
  const placed = new Map<string, ShellPlacement>();
  for (const sheet of working) {
    for (const placement of sheet.placements) {
      if (pieces.some((piece) => piece.id === placement.pieceId)) placed.set(placement.pieceId, placement);
    }
  }

  for (const piece of queue) {
    const candidates = working
      .filter((sheet) => sheet.pearl === piece.pearl)
      .sort((a, b) => (occupied.get(b.id)?.size ?? 0) - (occupied.get(a.id)?.size ?? 0));
    let fit: ShellPlacement | null = null;
    let host: ShellSheet | undefined;
    for (const sheet of candidates) {
      fit = firstFit(sheet, piece, occupied.get(sheet.id) ?? new Set(), SHELL_SPECS[sheet.pearl]);
      if (fit) {
        host = sheet;
        break;
      }
    }
    if (!fit && (stock[piece.pearl] ?? 0) > 0) {
      const sheet = makeSheet(piece.pearl);
      fit = firstFit(sheet, piece, new Set(), SHELL_SPECS[sheet.pearl]);
      if (fit) {
        host = sheet;
        working.push(sheet);
        opened.push(sheet);
        occupied.set(sheet.id, new Set());
        stock[piece.pearl] = (stock[piece.pearl] ?? 0) - 1;
      }
    }
    if (!fit || !host) {
      unplaced.push(piece.id);
      continue;
    }
    host.placements = host.placements.filter((item) => item.pieceId !== piece.id).concat(fit);
    occupy(occupied.get(host.id)!, piece.polygons, fit);
    placed.set(piece.id, fit);
  }

  for (const sheet of working) {
    sheet.placements = sheet.placements.map((item) => (locked.has(item.pieceId) ? { ...item, locked: true } : item));
    sheet.status = sheetStatus(sheet, polygonsFor);
  }
  return { sheets: working, placements: [...placed.values()], unplaced, opened };
}

export function sheetStatus(sheet: ShellSheet, polygonsFor: (placement: ShellPlacement) => CrackPoint[][]): ShellSheet["status"] {
  return freeRatio(sheet, polygonsFor) < 0.05 ? "exhausted" : "active";
}

export function freeRatio(sheet: ShellSheet, polygonsFor: (placement: ShellPlacement) => CrackPoint[][]) {
  const cols = Math.max(1, Math.floor(sheet.width / CELL));
  const rows = Math.max(1, Math.floor(sheet.height / CELL));
  const used = new Set<string>();
  for (const placement of sheet.placements) {
    for (const cell of poseKeys(polygonsFor(placement), placement.s, placement.r, placement.x, placement.y)) {
      const [i, j] = cell.key.split(",").map(Number);
      if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
      used.add(cell.key);
    }
  }
  return 1 - used.size / (cols * rows);
}

export function countByPearl(placements: ShellPlacement[], sheets: ShellSheet[]) {
  const openedIds = new Set(sheets.map((sheet) => sheet.id));
  const fresh = new Map<ShellPearl, Set<string>>();
  const active = new Map<ShellPearl, number>();
  for (const sheet of sheets) {
    if (sheet.status === "exhausted") continue;
    active.set(sheet.pearl, (active.get(sheet.pearl) ?? 0) + 1);
  }
  for (const placement of placements) {
    if (openedIds.has(placement.sheetId)) continue;
    const pearl = sheets.find((sheet) => sheet.id === placement.sheetId)?.pearl;
    if (!pearl) continue;
    const bag = fresh.get(pearl) ?? new Set();
    bag.add(placement.sheetId);
    fresh.set(pearl, bag);
  }
  return { fresh, active };
}

export interface CommitInput {
  stock: Partial<Record<ShellPearl, number>>;
  ledger: ShellLedger;
  plan: ShellPlan;
  legacyPrepaid?: boolean;
  /** 이 제작의 문양. 계획에서 빠진 절단 전 예약만 해제한다. */
  ownedPieceIds?: string[];
  polygonsFor?: (placement: ShellPlacement) => CrackPoint[][];
}

export type CommitResult =
  | { ok: true; stock: Partial<Record<ShellPearl, number>>; ledger: ShellLedger; plan: ShellPlan; charged: Partial<Record<ShellPearl, number>> }
  | { ok: false; missing: ShellPearl };

/** 처음 여는 자개패만 재고에서 1장 차감한다. 이미 열린 장의 빈자리는 추가 차감이 없다. */
export function commitNest(input: CommitInput): CommitResult {
  const polygonsFor = input.polygonsFor ?? (() => rectPoly(8, 8));
  const known = new Set(input.ledger.sheets.map((sheet) => sheet.id));
  const needed = new Map<ShellPearl, ShellSheet[]>();
  for (const sheet of input.plan.sheets) {
    if (known.has(sheet.id)) continue;
    const list = needed.get(sheet.pearl) ?? [];
    list.push(sheet);
    needed.set(sheet.pearl, list);
  }
  const stock = { ...input.stock };
  const charged: Partial<Record<ShellPearl, number>> = {};
  if (!input.legacyPrepaid) {
    for (const [pearl, sheets] of needed) {
      if ((stock[pearl] ?? 0) < sheets.length) return { ok: false, missing: pearl };
    }
    for (const [pearl, sheets] of needed) {
      stock[pearl] = (stock[pearl] ?? 0) - sheets.length;
      charged[pearl] = sheets.length;
    }
  }
  const pieceIds = new Set(input.plan.placements.map((item) => item.pieceId));
  const owned = new Set(input.ownedPieceIds ?? []);
  const bySheet = new Map<string, ShellPlacement[]>();
  for (const placement of input.plan.placements) {
    const list = bySheet.get(placement.sheetId) ?? [];
    list.push(placement);
    bySheet.set(placement.sheetId, list);
  }
  const nextSheets = input.ledger.sheets.map((sheet) => {
    const incoming = bySheet.get(sheet.id);
    if (!incoming) return sheet;
    const kept = sheet.placements.filter((item) => {
      if (sheet.cutPieceIds.includes(item.pieceId)) return true;
      if (pieceIds.has(item.pieceId)) return false;
      if (owned.has(item.pieceId)) return false;
      return true;
    });
    const merged = { ...sheet, placements: [...kept, ...incoming.filter((item) => !sheet.cutPieceIds.includes(item.pieceId))] };
    return { ...merged, status: sheetStatus(merged, polygonsFor) };
  });
  for (const [pearl, sheets] of needed) {
    for (const sheet of sheets) {
      const placements = bySheet.get(sheet.id) ?? [];
      const made = { ...sheet, pearl, placements, cutPieceIds: sheet.cutPieceIds ?? [] };
      nextSheets.push({ ...made, status: sheetStatus(made, polygonsFor) });
    }
    void pearl;
  }
  const plan: ShellPlan = { ...input.plan, confirmed: true };
  return { ok: true, stock, ledger: { sheets: nextSheets }, plan, charged };
}

export function releaseReservation(ledger: ShellLedger, pieceId: string): ShellLedger {
  return {
    sheets: ledger.sheets.map((sheet) => {
      if (sheet.cutPieceIds.includes(pieceId)) return sheet;
      return { ...sheet, placements: sheet.placements.filter((item) => item.pieceId !== pieceId) };
    }),
  };
}

export function markCut(ledger: ShellLedger, pieceId: string): ShellLedger {
  return {
    sheets: ledger.sheets.map((sheet) => {
      if (!sheet.placements.some((item) => item.pieceId === pieceId)) return sheet;
      if (sheet.cutPieceIds.includes(pieceId)) return sheet;
      return { ...sheet, cutPieceIds: [...sheet.cutPieceIds, pieceId] };
    }),
  };
}

export function emptyLedger(): ShellLedger {
  return { sheets: [] };
}

export function sanitizeLedger(raw: unknown): ShellLedger {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as ShellLedger).sheets)) return emptyLedger();
  const sheets = (raw as ShellLedger).sheets.flatMap((sheet) => {
    if (!sheet || typeof sheet !== "object") return [];
    const pearl = sheet.pearl;
    if (pearl !== "white" && pearl !== "abalone" && pearl !== "black" && pearl !== "paua") return [];
    if (typeof sheet.id !== "string" || !sheet.id) return [];
    const spec = SHELL_SPECS[pearl];
    return [
      {
        id: sheet.id,
        pearl,
        width: typeof sheet.width === "number" ? sheet.width : spec.width,
        height: typeof sheet.height === "number" ? sheet.height : spec.height,
        status: sheet.status === "exhausted" ? "exhausted" : "active",
        cutPieceIds: Array.isArray(sheet.cutPieceIds) ? sheet.cutPieceIds.filter((id) => typeof id === "string") : [],
        placements: Array.isArray(sheet.placements) ? sheet.placements.filter(isPlacement) : [],
      } satisfies ShellSheet,
    ];
  });
  return { sheets };
}

function isPlacement(raw: unknown): raw is ShellPlacement {
  if (!raw || typeof raw !== "object") return false;
  const item = raw as ShellPlacement;
  return typeof item.pieceId === "string" && typeof item.sheetId === "string" && typeof item.x === "number" && typeof item.y === "number";
}

export interface SavedCraft {
  stepIdx: number;
  stepModel?: string;
  legacyPearlPaid?: boolean;
  shellPlan?: ShellPlan;
  [key: string]: unknown;
}

/** 이 구획이 쓸 자개패. used 는 배치에 올라간 장수, fresh 는 그중 새로 열 장수다. */
export function sheetUse(plan: ShellPlan | undefined, ledger: ShellLedger) {
  const known = new Set(ledger.sheets.map((sheet) => sheet.id));
  const pearlOf = new Map<string, ShellPearl>();
  for (const sheet of [...ledger.sheets, ...(plan?.sheets ?? [])]) pearlOf.set(sheet.id, sheet.pearl);
  const used: Partial<Record<ShellPearl, number>> = {};
  const fresh: Partial<Record<ShellPearl, number>> = {};
  const seen = new Set<string>();
  for (const placement of plan?.placements ?? []) {
    if (seen.has(placement.sheetId)) continue;
    seen.add(placement.sheetId);
    const pearl = pearlOf.get(placement.sheetId);
    if (!pearl) continue;
    used[pearl] = (used[pearl] ?? 0) + 1;
    if (!known.has(placement.sheetId)) fresh[pearl] = (fresh[pearl] ?? 0) + 1;
  }
  return { used, fresh };
}

/**
 * 구획은 디자인 단계에 있다.
 * 따로 구획 단계가 있던 저장은 그 칸을 빼고, 확정 전에 나가 있던 제작만 구획을 마저 하게 한다.
 * 그보다 예전 저장은 단계 번호가 이미 지금과 같다.
 */
export function reconcileProgress<T extends SavedCraft>(
  progress: T,
): T & { stepModel: "design-nest"; legacyPearlPaid: boolean; nestPending?: boolean } {
  if (progress.stepModel === "design-nest") {
    return { ...progress, stepModel: "design-nest", legacyPearlPaid: !!progress.legacyPearlPaid };
  }
  if (progress.stepModel === "nest") {
    const onNest = progress.stepIdx === 4;
    const stepIdx = progress.stepIdx > 4 ? progress.stepIdx - 1 : progress.stepIdx;
    const pending = onNest && !progress.shellPlan?.confirmed;
    return {
      ...progress,
      stepIdx,
      stepModel: "design-nest",
      legacyPearlPaid: !!progress.legacyPearlPaid,
      ...(pending ? { nestPending: true } : {}),
    };
  }
  return { ...progress, stepModel: "design-nest", legacyPearlPaid: progress.stepIdx >= 1 };
}

export function restoreSave<T extends { money?: number; gallery?: unknown[]; inventory?: Record<string, number>; craftProgress?: SavedCraft | null; shellLedger?: unknown }>(
  raw: T | null | undefined,
  startInventory: Record<string, number>,
) {
  const saved = raw ?? ({} as T);
  return {
    money: typeof saved.money === "number" ? saved.money : 0,
    gallery: Array.isArray(saved.gallery) ? saved.gallery : [],
    inventory: { ...startInventory, ...(saved.inventory ?? {}) },
    shellLedger: sanitizeLedger(saved.shellLedger),
    craftProgress: saved.craftProgress ? reconcileProgress(saved.craftProgress) : null,
  };
}
