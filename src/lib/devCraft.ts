import { intactResult } from "@/lib/cutFragments";
import { LACQUERS, SHAPES, type MotifId } from "@/lib/data";
import type { Design, PlacedPiece, StepId, StepScores } from "@/lib/game";
import { SHELL_SPECS, type ShellPlan } from "@/lib/shellNest";
import { setCraftBoot, useUI, type CraftProgress } from "@/lib/store";

const KEY = "lacquer-dev-craft";

const STEP_ORDER: ("design" | StepId)[] = [
  "design",
  "cloth",
  "lacquer",
  "dry",
  "cut",
  "attach",
  "iron",
  "peel",
  "fill",
  "sand",
];

const SAMPLE: PlacedPiece[] = [
  { id: "dev-crane", motif: "crane", pearl: "white", x: 108, y: 118, s: 1.15, r: -8 },
  { id: "dev-butterfly", motif: "butterfly", pearl: "white", x: 196, y: 148, s: 1.05, r: 10 },
  { id: "dev-plum", motif: "plum" as MotifId, pearl: "white", x: 142, y: 196, s: 1, r: 0 },
];

function devDesign(current?: Design): Design {
  return {
    shape: current?.shape && SHAPES[current.shape] ? current.shape : "round",
    lacquer: current?.lacquer && LACQUERS[current.lacquer] ? current.lacquer : "red",
    pearl: current?.pearl ?? "white",
    pieces: current?.pieces?.length ? current.pieces : SAMPLE.map((piece) => ({ ...piece })),
    lacquerChosen: true,
  };
}

function planFor(design: Design): ShellPlan {
  const spec = SHELL_SPECS[design.pearl] ?? SHELL_SPECS.white;
  const sheetId = "dev-sheet";
  const placements = design.pieces.map((piece, index) => ({
    pieceId: piece.id,
    motifId: piece.motif,
    sheetId,
    x: 28 + (index % 2) * 70,
    y: 24 + Math.floor(index / 2) * 48,
    r: 0,
    s: 0.7,
  }));
  return {
    confirmed: true,
    sheets: [
      {
        id: sheetId,
        pearl: design.pearl,
        width: spec.width,
        height: spec.height,
        status: "active",
        cutPieceIds: [],
        placements,
      },
    ],
    placements,
  };
}

/** 자개까지 올려 둔 개발자용 진행. 붙이기 이후는 조각을 이미 붙인 상태로 연다. */
export function devProgress(stepIdx: number, current?: Design): CraftProgress {
  const index = Math.max(0, Math.min(STEP_ORDER.length - 1, stepIdx));
  const design = devDesign(current);
  const scores: StepScores = {};
  for (let i = 1; i < index; i++) scores[STEP_ORDER[i] as StepId] = 80;
  const attached = index >= STEP_ORDER.indexOf("attach");
  return {
    design,
    stepIdx: index,
    scores,
    placed: attached ? design.pieces.map((piece) => ({ ...piece })) : [],
    cutResults: attached ? design.pieces.map((piece) => intactResult(piece.id, piece.motif, 85)) : [],
    shellPlan: planFor(design),
    legacyPearlPaid: false,
    stepModel: "design-nest",
    nestPending: false,
    dev: true,
    savedAt: Date.now(),
  };
}

export function loadDevProgress(): CraftProgress | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as CraftProgress;
    if (!data?.design || typeof data.stepIdx !== "number") return null;
    if (!SHAPES[data.design.shape] || !LACQUERS[data.design.lacquer]) return null;
    if (!Array.isArray(data.design.pieces)) return null;
    return { ...data, dev: true, stepModel: "design-nest", legacyPearlPaid: !!data.legacyPearlPaid };
  } catch {
    return null;
  }
}

export function writeDevProgress(progress: CraftProgress) {
  const next = { ...progress, dev: true as const, savedAt: Date.now() };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // 저장이 막혀도 이번 화면의 이동은 유지한다.
  }
  return next;
}

export function clearDevProgress() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // 지울 수 없어도 시험 종료는 계속한다.
  }
}

/** 본 제작 세이브와 따로 두는 단계 시험을 연다. 저장이 있으면 그 단계에서 잇는다. */
export function beginDevCraft() {
  const progress = loadDevProgress() ?? devProgress(1);
  const next = writeDevProgress(progress);
  setCraftBoot(next);
  useUI.setState((state) => ({
    screen: "craft",
    prev: state.screen,
    commission: undefined,
    draft: next.design,
  }));
}
