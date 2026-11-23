// 자개 문양. 좌표는 문양 중심 기준 약 ±30 범위입니다.
// path의 하위 경로(M…Z) 하나하나가 따로 오려 붙인 자개 조각이고,
// detail(선)·holes(면)은 자개를 뚫어 아래 옻칠이 비쳐 보이는 부분입니다.

import {
  asanohaHex,
  cloudLine,
  grapeLeaf,
  grapes,
  mountain,
  vine,
  type Pt,
  type Stroke,
} from "./motifArt";
import { MOTIF_CUTS } from "./motifCuts";
import { STAMP_MOTIFS } from "./motifStamps";

export type MotifId =
  | "plum"
  | "butterfly"
  | "cloud"
  | "cloudLine"
  | "peony"
  | "crane"
  | "crane2"
  | "diamond"
  | "moon"
  | "orb"
  | "mountain"
  | "rock"
  | "wave"
  | "vine"
  | "grapeLeaf"
  | "grapes"
  | "kiku"
  | "leaf"
  | "turtle"
  | "lotus"
  | "pine"
  | "bamboo"
  | "deer";

/** shape: 하나로 완결된 모양, pattern: 이웃과 이어 붙여 면을 채우는 반복 단위 */
export type MotifKind = "shape" | "pattern";

/** jul: 줄음질(실톱), kkeun: 끊음질(자개 띠를 토막). 직선 테두리를 나중에 넣으면 kkeun으로 둔다. */
export type CuttingMethod = "jul" | "kkeun";

/** outer-silhouette: 톱질 가이드만 바깥 윤곽. geometry: 조각·띠의 실제 경계. */
export type GuideMode = "outer-silhouette" | "geometry";

export interface CuttingMetadata {
  /** 비우면 권장 공법을 아직 정하지 않은 문양 */
  preferredMethod?: CuttingMethod;
  supportedMethods: CuttingMethod[];
  guideMode: GuideMode;
}

export interface MotifDef {
  id: MotifId;
  kind: MotifKind;
  name: string;
  meaning: string;
  /** 면으로 오린 조각들 (하위 경로마다 한 조각, 없으면 빈 문자열) */
  path: string;
  /** 가늘게 켠 자개 띠로 붙이는 선 */
  strokes?: Stroke[];
  /** 자르기 미니게임용 단일 외곽선 (없으면 path 사용) */
  cutPath?: string;
  /** 선 모양으로 뚫린 부분 */
  detail?: string;
  detailWidth?: number;
  /** 면 모양으로 뚫린 부분 */
  holes?: string;
  /** 패턴 단위가 맞물리는 격자 (문양 좌표, 배율·회전 전) */
  tile?: { a: Pt; b: Pt };
  /** 조각 하나에 드는 자개 (기본 1) */
  cost?: number;
  /**
   * 원본 이미지 실루엣 스탬프.
   * path 대신 PNG 알파로 자개 모양을 마스크합니다 (투명 = 선각·빈 곳).
   */
  stamp?: { src: string; x: number; y: number; w: number; h: number };
  /** 권장 세공법과 톱질 가이드 방식. 저장 데이터에는 넣지 않는다. */
  cutting: CuttingMetadata;
}

const BOTH_METHODS: CuttingMethod[] = ["jul", "kkeun"];

function cutting(guideMode: GuideMode, preferredMethod?: CuttingMethod): CuttingMetadata {
  return { preferredMethod, supportedMethods: BOTH_METHODS, guideMode };
}

const f = (n: number) => +n.toFixed(2);
const pt = (r: number, a: number) => `${f(Math.cos(a) * r)} ${f(Math.sin(a) * r)}`;

function circle(cx: number, cy: number, r: number) {
  return `M${f(cx - r)} ${f(cy)} A${r} ${r} 0 1 0 ${f(cx + r)} ${f(cy)} A${r} ${r} 0 1 0 ${f(cx - r)} ${f(cy)} Z`;
}

/** 좌우 대칭 사본 (M·L·C·Q 및 상대 좌표 명령만 사용) */
function mirrorX(d: string) {
  return d.replace(/([MLCQmlcqZz])([^MLCQmlcqZz]*)/g, (_, cmd: string, args: string) => {
    const nums = args.trim() ? args.trim().split(/[\s,]+/).map(Number) : [];
    return `${cmd}${nums.map((n, i) => (i % 2 === 0 ? -n : n)).join(" ")} `;
  });
}

const both = (...parts: string[]) => parts.flatMap((p) => [p, mirrorX(p)]).join(" ");

/* ───────── 매화: 끝이 살짝 패인 꽃잎 다섯 장, 꽃술은 가는 선과 점으로 뚫음 ───────── */

const PLUM_TOP = -Math.PI / 2;

function plumOutline() {
  const pts: string[] = [];
  const N = 220;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    const u = ((t / ((Math.PI * 2) / 5)) % 1) * 2 - 1;
    const r = 10.6 + 9 * Math.pow(Math.max(0, 1 - u * u), 0.38) - 1.5 * Math.exp(-((u * 7) ** 2));
    pts.push(pt(r, t + PLUM_TOP - Math.PI / 5));
  }
  return `M${pts.join(" L")} Z`;
}

function plumCuts() {
  let detail = "";
  let holes = circle(0, 0, 1.3);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const len = i % 2 ? 6.4 : 7.6;
    detail += ` M${pt(1.9, a)} L${pt(len, a)}`;
    holes += ` ${circle(f(Math.cos(a) * (len + 0.9)), f(Math.sin(a) * (len + 0.9)), 0.62)}`;
  }
  for (let k = 0; k < 5; k++) {
    const b = PLUM_TOP + Math.PI / 5 + (k * 2 * Math.PI) / 5;
    detail += ` M${pt(10.9, b)} C${pt(9.8, b + 0.03)} ${pt(8.8, b + 0.13)} ${pt(8.1, b + 0.27)}`;
  }
  return { detail, holes };
}

/* ───────── 나비: 앞날개·뒷날개·몸통·더듬이를 따로 오려 붙임 ───────── */

const BF_FORE =
  "M2 -2.1 C5.5 -9 14.6 -19.7 24.6 -22.3 Q26.1 -22.7 25.7 -20.8 " +
  "C25 -17.2 23 -15.9 23.4 -13.6 Q21.3 -11.7 21.9 -9.9 " +
  "Q19.6 -8.3 19.8 -6.9 C15.3 -3.4 8.4 -1.8 2 -1 Z";
const BF_HIND =
  "M2.1 0 C7.6 -0.5 13.5 -1.2 18 -3.2 C21.2 -0.9 22.5 3.5 20.6 6.2 " +
  "Q19 6.7 18.9 9 Q16.2 9.8 16 12.2 Q13.6 12.2 12.8 14.6 " +
  "C11.9 17.5 12.3 19.2 10.4 20.1 C9.6 18.7 10.6 15.4 10.2 13.9 " +
  "C6.9 13.7 3.5 9.8 2.8 6.2 Q2 3 2.1 0 Z";
const BF_ANT =
  "M0.8 -6.3 C1.2 -10.8 4 -14 6.4 -15.6 C7 -17.3 8.9 -17.7 8.7 -16.5 " +
  "Q8.4 -15.5 6.9 -15.2 C4.4 -13.6 2 -10.1 1.4 -6.3 Z";
const BF_BODY =
  "M0 -7.3 C2.4 -7.3 2.1 -3.7 1.4 -1.4 C2 2.3 1.3 9.3 0 12.5 " +
  "C-1.4 9.1 -2 2.5 -1.4 -1.4 C-2.1 -3.7 -2.3 -7.2 0 -7.3 Z";

// 날개 뿌리에서 뻗은 맥은 바깥쪽으로 가늘어지고, 뒷날개 가장자리에는 작은 반달무늬가 남는다.
const BF_ENGRAVING = both(
  "M2.8 -2.3 C7.3 -6.2 11.4 -11.5 17.5 -15.8 Q21.5 -18.8 23.9 -20.5 " +
    "Q21.4 -17.8 17.7 -15.3 C12.1 -11.1 8 -5.6 2.8 -2.3 Z",
  "M3.6 -2.5 C8.7 -5 12.1 -6.6 14.8 -9.1 Q16.1 -10.5 15.1 -13.4 " +
    "Q17.3 -10.5 15.3 -8.7 C12.7 -6.1 7.2 -3.6 3.6 -2.5 Z",
  "M2.8 0.7 C8.9 1.3 14.2 1.6 19.1 -0.5 C15.6 1.8 9.6 2.4 2.8 0.7 Z",
  "M19.9 -15.3 Q21.6 -16.1 22.9 -18.1 Q22.3 -15.8 20.6 -15.2 Q20 -15 19.9 -15.3 Z",
  "M18.6 -12.4 Q20.7 -13.3 21.5 -14.6 Q21 -12.7 19.5 -12.1 Q18.7 -11.9 18.6 -12.4 Z",
  "M3.1 1.6 Q9.3 5.2 11 11.9 Q8.3 6.1 3.1 1.6 Z",
  "M18.5 6 Q17.1 8.4 15.4 8.2 Q17.5 9.7 18.5 6 Z",
  "M14.7 9.1 Q13.7 11.9 12 11.7 Q14.4 13 14.7 9.1 Z",
);
const BF_FINE = both(
  "M14.9 -8.9 Q17.2 -9 20.1 -10.5",
  "M10.8 1.6 Q14.5 3.2 17.1 5.5",
  "M8.4 6.3 Q10.7 8.1 13.2 9.1",
);

/* ───────── 학1: 날개를 위로 들어 올린 학 (목은 앞으로, 다리는 뒤로) ───────── */

const CRANE1 = [
  // 뒷날개
  "M-6 0.6 C-9 -5 -12 -12 -13 -18 C-13.4 -21 -13.8 -23.6 -14.2 -26 L-11.6 -23.2 L-11 -26.4 L-9 -22 " +
    "L-7.6 -24.6 L-6.4 -19.6 L-4.4 -21.4 L-4 -16.4 L-3.6 -8 C-4.4 -4 -5 -1.6 -6 0.6 Z",
  // 다리
  "M12 6.4 L28.6 12.2 L30.4 11.4 L30.6 12.4 L29 13.4 L11.8 7.6 Z",
  "M11 7.6 L27.4 15 L29 14.6 L28.8 15.6 L27.2 16.2 L10.6 8.6 Z",
  // 머리·목·몸통
  "M-30 -6.2 L-25.5 -7.6 C-24 -8.4 -22.4 -8 -22 -6.6 C-18 -5.4 -12 -1.5 -7 1.2 C-3 -0.2 4 0 9 2.4 " +
    "C12 3.6 14.5 5 15.5 6.8 C12.5 7.6 9 8 5 7.6 C0 7.4 -4.5 6 -7.5 3.4 C-12 1 -18 -2.6 -22.4 -4.8 " +
    "C-23.2 -4.6 -24.4 -4.8 -25.2 -5.4 Z",
  // 앞날개
  "M-4 1 C-6 -6 -4 -14 1 -20 C3 -23 5 -26 7 -27.5 L7.4 -24 L10 -26 L9.6 -22 L12.6 -23.6 L11.6 -19.4 " +
    "L15 -20.2 L13.2 -16.2 L16.6 -16 L14 -12.6 L17 -11.8 L13.6 -9.2 L15.8 -7.6 L12 -6 L13 -3.6 L9 -2.4 " +
    "L8.6 1 C4 0 0 0.4 -4 1 Z",
].join(" ");

const CRANE1_CUTS =
  "M7.4 -24 L4.5 -15 M9.6 -22 L6 -13 M11.6 -19.4 L7 -10.5 M13.2 -16.2 L8 -8.5 M14 -12.6 L8.6 -6.4 " +
  "M13.6 -9.2 L8.4 -4.4 M12 -6 L7.4 -2.6 M-2.6 -4 C0 -7 3 -9 6 -9.6 C8 -9 9.6 -8 11 -6.6 " +
  "M-2.4 -10 q1.4 -1.6 2.8 -0.4 q1.2 -1.8 2.8 -0.6 q1.2 -1.8 2.8 -0.4 " +
  "M-11.6 -23.2 L-10 -15 M-9 -22 L-8 -14 M-6.4 -19.6 L-6.2 -12 " +
  "M9 4 L14.6 6.4 M7 5.6 L13 7.2 M-8 1.6 C-4 2.4 2 2.2 6 3";

/* ───────── 학2: 날개를 활짝 펼치고 비상하는 학 ───────── */

const CRANE2 = [
  // 뒤쪽 날개 (수평으로 펼침)
  "M5 0.6 C11 -2 18 -4 24 -4.4 C26.5 -4.6 28.8 -4 30.6 -3 L27.2 -1.2 L30 0.4 L26.4 1.4 L28.6 3.4 " +
    "L24.6 3.6 L26 6 L21.8 5.4 L22.4 8 L18.4 6.6 L18.2 9 L14.6 7.2 L13.8 9.2 L11 7.2 C9 6.4 6.6 4 5 0.6 Z",
  // 다리
  "M12 6.2 L26 13.6 L27.6 13 L27.6 14 L25.6 14.6 L11.6 7.4 Z",
  "M11.4 7.4 L24.6 16.6 L26.2 16.4 L25.8 17.4 L24 17.4 L10.8 8.4 Z",
  // 머리·목·몸통
  "M-31 0.2 L-26 -1.6 C-24.6 -2.4 -23 -2 -22.6 -0.8 C-19 0.2 -14 2 -9 2 C-4 0.4 3 0.4 8 2.4 " +
    "C11 3.6 13 5.4 13.6 7 C10 8.2 5 8.6 1 8 C-3 7.4 -6.6 5.8 -9 4.2 C-14 4.4 -19 2.6 -22.8 1.2 " +
    "C-23.6 1.4 -24.8 1.2 -25.4 0.6 Z",
  // 위로 치켜든 날개
  "M-4 0 C-2 -8 3 -16 9 -21 C11 -23 13 -25 15 -26.6 L14.4 -22.6 L17.6 -24 L16 -19.6 L19.4 -20 " +
    "L16.8 -15.6 L20 -15 L16.6 -11.6 L19 -10 L15 -8 L16.6 -5.6 L12 -4.4 L12.4 -1.6 L8 -0.6 C4 0.2 0 0 -4 0 Z",
].join(" ");

const CRANE2_CUTS =
  "M14.4 -22.6 L9 -13 M16 -19.6 L10.4 -11 M16.8 -15.6 L11 -9 M16.6 -11.6 L11 -6.8 M15 -8 L10 -4.6 " +
  "M12 -4.4 L8.6 -2.6 M-1.6 -5 q1.6 -1.6 3 0 q1.6 -1.6 3 0 q1.6 -1.6 3 0 M1.4 -10.4 q1.4 -1.4 2.6 0 q1.4 -1.4 2.6 0 " +
  "M27.2 -1.2 L18 -0.6 M26.4 1.4 L17 1.4 M24.6 3.6 L16 3 M21.8 5.4 L14.6 4.2 M18.4 6.6 L13 5 " +
  "M8.4 -0.8 q1.4 1.4 2.8 0 q1.4 1.4 2.8 0 q1.4 1.4 2.8 0 M6 4 L12.6 6.6 M-20 0.8 C-16 2.4 -12 3 -9 3.2";

const plum = plumCuts();
const geo = asanohaHex();
/** public/motifs/kiku-unit.png — 원본 좌우 절반을 패턴 1단위로 사용 */
const KIKU_STAMP = {
  src: "/motifs/kiku-unit.png",
  x: -56,
  y: -25.16,
  w: 112,
  h: 50.42,
} as const;
const cloud2 = cloudLine();
const mtn = mountain();
const vn = vine();
const gl = grapeLeaf();
const gr = grapes();

function pngShape(
  id: keyof typeof STAMP_MOTIFS,
  name: string,
  meaning: string,
  cut: CuttingMetadata,
): MotifDef {
  const s = STAMP_MOTIFS[id];
  return {
    id,
    kind: "shape",
    name,
    meaning,
    path: "",
    stamp: { src: s.src, x: s.x, y: s.y, w: s.w, h: s.h },
    cutting: cut,
  };
}

export const MOTIFS: Record<MotifId, MotifDef> = {
  plum: {
    id: "plum",
    kind: "shape",
    name: "매화",
    meaning: "고결함",
    path: plumOutline(),
    detail: plum.detail,
    holes: plum.holes,
    detailWidth: 0.42,
    cutting: cutting("geometry", "jul"),
  },
  butterfly: {
    id: "butterfly",
    kind: "shape",
    name: "나비",
    meaning: "기쁨",
    path: `${both(BF_FORE, BF_HIND, BF_ANT)} ${BF_BODY} ${circle(0, -8.3, 1.35)}`,
    holes: BF_ENGRAVING,
    detail: BF_FINE,
    detailWidth: 0.34,
    cutting: cutting("geometry", "jul"),
  },
  cloud: pngShape("cloud", "구름", "장수", cutting("outer-silhouette", "jul")),
  peony: pngShape("peony", "모란", "부귀", cutting("outer-silhouette", "jul")),
  crane: {
    id: "crane",
    kind: "shape",
    name: "학1",
    meaning: "신선",
    path: CRANE1,
    cutPath:
      "M-30 -6.2 L-22 -7.4 C-16 -4 -10 -1 -6 0 C-9 -6 -12.5 -14 -14.2 -26 L-9 -22 L-6.4 -19.6 L-4.4 -21.4 " +
      "C-3 -23 2 -24 7 -27.5 L10 -26 L17 -11.8 L12 -6 L9 -2.4 C12 3.6 14 5 16 6.6 L30.4 11.4 L28.8 15.6 " +
      "L10.6 8.6 C4 8 -3 6 -7.5 3.4 C-13 1 -19 -2.4 -25 -5.4 Z",
    detail: CRANE1_CUTS,
    detailWidth: 0.42,
    cutting: cutting("geometry", "jul"),
  },
  crane2: {
    id: "crane2",
    kind: "shape",
    name: "학2",
    meaning: "길상",
    path: CRANE2,
    cutPath:
      "M-31 0.2 L-26 -1.6 C-20 0.4 -14 2 -9 2 L-4 0 C-1 -10 6 -19 15 -26.6 L20 -15 L16.6 -5.6 L12.4 -1.6 " +
      "C18 -4 24 -4.6 30.6 -3 L26 6 L18.2 9 L14 9.2 L27.6 13 L25.8 17.4 L10.8 8.4 C6 8.4 -3 7.4 -9 4.2 " +
      "C-15 4.2 -20 2.6 -25.4 0.6 Z",
    detail: CRANE2_CUTS,
    detailWidth: 0.42,
    cutting: cutting("geometry", "jul"),
  },
  diamond: {
    id: "diamond",
    kind: "pattern",
    name: "끊음질 삼잎",
    meaning: "조화",
    path: geo.path,
    holes: geo.holes,
    tile: geo.tile,
    cost: 0.5,
    cutting: cutting("geometry", "kkeun"),
  },
  kiku: {
    id: "kiku",
    kind: "pattern",
    name: "국화 넝쿨",
    meaning: "장수",
    path: "",
    stamp: { ...KIKU_STAMP },
    cutPath: `M${KIKU_STAMP.x} ${KIKU_STAMP.y} H${KIKU_STAMP.x + KIKU_STAMP.w} V${KIKU_STAMP.y + KIKU_STAMP.h} H${KIKU_STAMP.x} Z`,
    tile: { a: [112, 0], b: [0, 74.59] },
    cost: 0.5,
    cutting: cutting("outer-silhouette", "jul"),
  },
  orb: {
    id: "orb",
    kind: "shape",
    name: "해·달",
    meaning: "광명",
    path: circle(0, 0, 20),
    cutting: cutting("geometry", "jul"),
  },
  cloudLine: {
    id: "cloudLine",
    kind: "shape",
    name: "선 구름",
    meaning: "길상",
    path: "",
    ...cloud2,
    cutting: cutting("geometry", "kkeun"),
  },
  mountain: {
    id: "mountain",
    kind: "shape",
    name: "산",
    meaning: "굳건함",
    path: "",
    ...mtn,
    cutting: cutting("geometry", "kkeun"),
  },
  rock: pngShape("rock", "바위", "불변", cutting("outer-silhouette", "jul")),
  wave: pngShape("wave", "물결", "평안", cutting("geometry", "jul")),
  vine: {
    id: "vine",
    kind: "shape",
    name: "포도넝쿨",
    meaning: "번성",
    path: "",
    ...vn,
    cutting: cutting("geometry", "jul"),
  },
  grapeLeaf: {
    id: "grapeLeaf",
    kind: "shape",
    name: "포도잎",
    meaning: "풍요",
    ...gl,
    detailWidth: 0.5,
    cutting: cutting("geometry", "jul"),
  },
  grapes: {
    id: "grapes",
    kind: "shape",
    name: "포도송이",
    meaning: "다산",
    ...gr,
    cutting: cutting("geometry", "jul"),
  },
  moon: {
    id: "moon",
    kind: "shape",
    name: "초승달",
    meaning: "소망",
    path: "M0 -20 A20 20 0 0 0 0 20 A24 24 0 0 1 0 -20 Z",
    cutting: cutting("geometry", "jul"),
  },
  leaf: {
    id: "leaf",
    kind: "shape",
    name: "댓잎",
    meaning: "절개",
    path: "M-24 2 C-12 -10 10 -10 24 -2 C10 8 -12 10 -24 2 Z",
    detail:
      "M-22 1.8 C-8 -0.6 8 -2.2 22 -2 M-14 0.6 L-8.4 -4.6 M-5 -0.4 L0.6 -5.6 M4 -1.2 L9.6 -5.2 M11.6 -1.7 L16 -4 " +
      "M-11.4 0.3 L-5.8 4.6 M-2.4 -0.6 L3.4 4 M6.4 -1.5 L11.6 2.2",
    cutting: cutting("geometry", "kkeun"),
  },
  turtle: pngShape("turtle", "거북이", "무병장수", cutting("outer-silhouette", "jul")),
  lotus: pngShape("lotus", "연꽃", "청정", cutting("geometry", "jul")),
  pine: pngShape("pine", "소나무", "장수", cutting("outer-silhouette", "jul")),
  bamboo: pngShape("bamboo", "대나무", "지조", cutting("outer-silhouette", "jul")),
  deer: pngShape("deer", "사슴", "길상", cutting("geometry", "jul")),
};

/** 문양 고르기에 보이는 목록 (댓잎은 예전 작품 표시용으로만 남김) */
export const MOTIF_LIST: MotifDef[] = (
  [
    "crane",
    "crane2",
    "butterfly",
    "plum",
    "peony",
    "lotus",
    "grapes",
    "grapeLeaf",
    "vine",
    "cloud",
    // "cloudLine" — 구름과 겹쳐 선택 목록에서는 숨김 (기존 작품 표시용으로 MOTIFS에는 유지)
    "mountain",
    "rock",
    "pine",
    "bamboo",
    "deer",
    "turtle",
    "wave",
    "orb",
    "moon",
    "diamond",
    "kiku",
  ] as MotifId[]
).map((id) => MOTIFS[id]);

export const SHAPE_MOTIFS = MOTIF_LIST.filter((m) => m.kind === "shape");
export const PATTERN_MOTIFS = MOTIF_LIST.filter((m) => m.kind === "pattern");

/** 줄음질에서 조각마다 따로 따라가는 절단선 */
export function motifCutRoutes(id: MotifId) {
  return MOTIF_CUTS[id] ?? [];
}

for (const motif of Object.values(MOTIFS)) {
  const cuts = MOTIF_CUTS[motif.id];
  if (cuts?.length) motif.cutPath = cuts.map((cut) => cut.d).join(" ");
}

/** 밑그림·선택 표시·자르기에 쓰는 바깥 윤곽 */
export const motifOutline = (id: MotifId) => MOTIFS[id].cutPath ?? MOTIFS[id].path;

/** 디자인 편집 핸들용 문양 로컬 박스 (문양 중심 기준) */
export function motifLocalBox(id: MotifId): { x: number; y: number; w: number; h: number } {
  const m = MOTIFS[id];
  if (m.stamp) return { x: m.stamp.x, y: m.stamp.y, w: m.stamp.w, h: m.stamp.h };
  if (m.kind === "pattern") return { x: -18, y: -18, w: 36, h: 36 };
  return { x: -32, y: -32, w: 64, h: 64 };
}

/**
 * 자르기 미니게임용 맞춤 배율.
 * 스탬프·패턴 단위는 좌표계가 커서 고정 4.5배로 그리면 판만 커다랗게 보입니다.
 */
export function motifCutFit(id: MotifId): { ox: number; oy: number; scale: number } {
  const m = MOTIFS[id];
  const target = 200;
  if (m.stamp) {
    const { x, y, w, h } = m.stamp;
    return {
      ox: x + w / 2,
      oy: y + h / 2,
      scale: Math.min(target / Math.max(w, 1), target / Math.max(h, 1)),
    };
  }
  if (m.kind === "pattern") {
    return { ox: 0, oy: 0, scale: 6.2 };
  }
  if (m.strokes?.length && !m.path) {
    return { ox: 0, oy: 0, scale: 3.6 };
  }
  return { ox: 0, oy: 0, scale: 4.5 };
}

const partsCache = new Map<MotifId, string[]>();

/** 따로 오려 붙인 자개 조각들 */
export function motifParts(id: MotifId) {
  let p = partsCache.get(id);
  if (!p) {
    p = MOTIFS[id].path
      .split(/(?=M)/)
      .map((s) => s.trim())
      .filter(Boolean);
    partsCache.set(id, p);
  }
  return p;
}
