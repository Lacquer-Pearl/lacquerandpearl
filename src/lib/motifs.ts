// 자개 문양. 좌표는 문양 중심 기준 약 ±30 범위입니다.
// path의 하위 경로(M…Z) 하나하나가 따로 오려 붙인 자개 조각이고,
// detail(선)·holes(면)은 자개를 뚫어 아래 옻칠이 비쳐 보이는 부분입니다.

import {
  asanohaHex,
  cloudLine,
  grapeLeaf,
  grapes,
  kikuScroll,
  mountain,
  rock,
  vine,
  wave,
  type Pt,
  type Stroke,
} from "./motifArt";

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
  | "turtle";

/** shape: 하나로 완결된 모양, pattern: 이웃과 이어 붙여 면을 채우는 반복 단위 */
export type MotifKind = "shape" | "pattern";

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

function hexagon(r: number) {
  const pts = Array.from({ length: 6 }, (_, i) => pt(r, (i / 6) * Math.PI * 2));
  return `M${pts.join(" L")} Z`;
}

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
  "M1.6 -3.2 C4 -10 10 -18.6 18.6 -21.8 C22.6 -23.4 25.8 -22.4 25.4 -19 C25.2 -17 24 -16.2 24.2 -14.6 " +
  "C24.4 -12.6 22.6 -11.8 22.6 -10 C22.6 -8.4 21 -6.8 19.6 -5.6 C15 -3.4 8 -2 1.6 -1 Z";
const BF_HIND =
  "M1.6 0.2 C7 -0.4 14 0 18.6 2.6 C21.6 4.4 21.4 7.8 19 9.8 C18.4 12.4 15.6 14.6 13 14 " +
  "L11.2 19.6 C10.8 20.8 9.4 20.6 9.6 19.2 L10 13.6 C6.4 12.8 3.2 8.6 1.6 2.6 Z";
const BF_ANT = "M0.7 -6.4 C2 -11 4.2 -14.6 7.4 -16.6 C8.4 -17.2 9.2 -16.2 8.4 -15.4 C5.4 -13.6 3 -10.4 1.5 -6.2 Z";
const BF_CUTS =
  "M17.8 -19.6 C21.4 -21 23.6 -20 23 -17.4 C22.6 -15.6 21.8 -14 21.4 -12.2 C21 -10 19.6 -8.4 18 -7.2 " +
  "M3.4 -3.4 C8 -8 13 -13.6 18.6 -18.4 M4 -2.6 C10 -5 15.6 -7.6 20.2 -11.4 " +
  "M9.6 -7.4 C12.4 -8.6 15 -9.2 17.8 -9 C16.4 -11.6 14.6 -13.4 13 -14.8 " +
  "M16.8 3.4 C19.4 5 19.4 7.8 17.4 9.4 C16.6 11.4 14.8 12.6 13.4 12.2 " +
  "M3.4 1.2 C8 2.6 12.4 5.4 15.4 9.6 M3.4 1.8 C5.8 5.4 8 9 10.6 12.4 M3.6 0.8 C9 1 13.8 1.6 17.4 3.6";

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

/* ───────── 모란: 끝이 말린 꽃잎을 한 장씩 오려 둥근 씨방 둘레에 붙인 모란과 잎 ───────── */


/** 꽃잎·잎 하나: 국소 좌표(+x 방향으로 뻗음)의 베지어를 (ox, oy)에서 a만큼 돌려 배치 */
function frond(ox: number, oy: number, deg: number, len: number, w: number, curl: number, leaf = false) {
  const a = (deg * Math.PI) / 180;
  const T = ([u, v]: Pt): string => `${f(ox + u * Math.cos(a) - v * Math.sin(a))} ${f(oy + u * Math.sin(a) + v * Math.cos(a))}`;
  const L = len;
  const c = curl * w;
  const path = leaf
    ? `M${T([0, 0])} C${T([0.3 * L, -w])} ${T([0.72 * L, -0.85 * w])} ${T([L, 0])} ` +
      `C${T([0.72 * L, 0.85 * w])} ${T([0.3 * L, w])} ${T([0, 0])} Z`
    : `M${T([0, -0.35 * w])} C${T([0.35 * L, -w])} ${T([0.75 * L, -1.05 * w])} ${T([0.97 * L, -0.4 * w])} ` +
      `C${T([1.06 * L, 0.05 * c])} ${T([1.02 * L, 0.5 * c])} ${T([0.86 * L, 0.55 * c])} ` +
      `C${T([0.84 * L, 0.25 * c])} ${T([0.8 * L, 0.1 * c])} ${T([0.76 * L, 0.16 * c])} ` +
      `C${T([0.6 * L, 0.75 * w])} ${T([0.32 * L, 0.95 * w])} ${T([0, 0.35 * w])} Z`;
  const cut = leaf
    ? `M${T([0.12 * L, 0])} C${T([0.4 * L, -0.08 * w])} ${T([0.7 * L, -0.06 * w])} ${T([0.88 * L, 0])} ` +
      `M${T([0.35 * L, -0.03 * w])} L${T([0.55 * L, -0.55 * w])} M${T([0.55 * L, -0.03 * w])} L${T([0.72 * L, -0.45 * w])} ` +
      `M${T([0.35 * L, 0])} L${T([0.52 * L, 0.55 * w])}`
    : `M${T([0.22 * L, 0.05 * w])} C${T([0.45 * L, -0.05 * w])} ${T([0.62 * L, -0.15 * w])} ${T([0.8 * L, -0.32 * w])}`;
  const tip: Pt = [ox + L * Math.cos(a), oy + L * Math.sin(a)];
  return { path, cut, tip };
}

function peony() {
  const cx = 0;
  const cy = -2;
  // 각도(0=오른쪽, -90=위), 길이, 폭, 말림 방향 — 뒤에서 앞 순서로 붙임
  const spec: [number, number, number, number][] = [
    [-90, 16, 7.6, 1],
    [-130, 17, 8, -1],
    [-50, 17, 8, 1],
    [-165, 17, 7.4, -1],
    [-15, 17, 7.4, 1],
    [160, 14, 6.4, 1],
    [20, 14, 6.4, -1],
  ];
  const petals = spec.map(([d, l, w, k]) => {
    const r = (d * Math.PI) / 180;
    return { d, ...frond(cx + Math.cos(r) * 3, cy + Math.sin(r) * 3, d, l, w, k) };
  });
  const leaves = [frond(-0.6, 12, 152, 12.5, 4.4, 0, true), frond(0.6, 15.5, 22, 11, 3.8, 0, true)];
  const stem = "M-1 3 L1 3 C1.3 9 1.5 15 1.3 22 L-1.3 22 C-1.5 15 -1.3 9 -1 3 Z";
  const calyx = "M-7.6 1 C-5.6 6.4 5.6 6.4 7.6 1 C4.4 3.2 -4.4 3.2 -7.6 1 Z";
  const bulb = circle(cx, cy, 5.4);
  const path = [stem, ...leaves.map((l) => l.path), ...petals.map((p) => p.path), calyx, bulb].join(" ");
  const detail =
    [...leaves, ...petals].map((p) => p.cut).join(" ") +
    " M-4 -0.6 C-3.2 -5.8 3.2 -5.8 4 -0.6 M-2.2 0.4 C-1.8 -2.8 1.8 -2.8 2.2 0.4 M-5.4 3.8 C-2 5.2 2 5.2 5.4 3.8";

  // 왼쪽 아래 꽃잎부터 위를 거쳐 오른쪽 아래 꽃잎까지 시계 방향
  const sorted = [...petals].sort((p, q) => ((p.d - 150 + 360) % 360) - ((q.d - 150 + 360) % 360));
  const outline: string[] = [];
  sorted.forEach((p, i) => {
    outline.push(`${f(p.tip[0])} ${f(p.tip[1])}`);
    const n = sorted[i + 1];
    if (n) {
      const m = ((p.d + ((n.d - p.d + 360) % 360) / 2) * Math.PI) / 180;
      outline.push(`${f(cx + Math.cos(m) * 12)} ${f(cy + Math.sin(m) * 12)}`);
    }
  });
  const [lL, lR] = leaves;
  const cutPath =
    `M${outline.join(" L")} L6 7 L${f(lR.tip[0])} ${f(lR.tip[1])} L1.3 22 L-1.3 22 ` +
    `L${f(lL.tip[0])} ${f(lL.tip[1])} L-6 6 Z`;
  return { path, detail, cutPath };
}

/* ───────── 구름: 크고 둥근 덩이 세 개와 말린 꼬리, 덩이마다 소용돌이 홈 ───────── */

function spiral(cx: number, cy: number, r0: number, r1: number, turns: number, a0Deg: number, dir: 1 | -1) {
  const pts: string[] = [];
  const N = Math.ceil(turns * 40);
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const a = (a0Deg * Math.PI) / 180 + dir * turns * Math.PI * 2 * t;
    const r = r0 + (r1 - r0) * t;
    pts.push(`${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`);
  }
  return `M${pts.join(" L")}`;
}

const CLOUD =
  "M-32 7.2 C-28.6 6.6 -25.4 4.8 -22.4 3.2 " +
  "A6 6 0 0 1 -14.8 -4.5 " +
  "C-14 -4.7 -13.4 -4.85 -12.7 -4.9 " +
  "A11 11 0 0 1 8.7 -5.7 " +
  "C8.1 -4.2 7.5 -3.2 7 -2.4 " +
  "A7.5 7.5 0 0 1 21.2 2.2 " +
  "C24.6 3.6 28.2 5 32 6.6 C29.4 8.2 25.6 8.4 21 8.2 " +
  "C17 9.8 12.4 8.4 8.6 9.4 C3 10.8 -4 10.8 -9.4 9.4 C-14 8.2 -19 10.2 -23.6 8.8 C-27.4 8.2 -30.2 7.8 -32 7.2 Z";
const CLOUD_CUTS = [
  spiral(-2, -2.4, 8, 1.4, 1.3, 95, -1),
  spiral(-16.6, 1.8, 4.2, 0.9, 1.15, 80, 1),
  spiral(13.6, 1.2, 5.2, 1, 1.2, 100, -1),
  spiral(24.6, 5.4, 2, 0.5, 0.9, 200, 1),
  spiral(-25.4, 6.4, 1.9, 0.5, 0.9, 10, -1),
].join(" ");

const pe = peony();
const plum = plumCuts();
const geo = asanohaHex();
const kiku = kikuScroll();
const cloud2 = cloudLine();
const mtn = mountain();
const rk = rock();
const wv = wave();
const vn = vine();
const gl = grapeLeaf();
const gr = grapes();

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
  },
  butterfly: {
    id: "butterfly",
    kind: "shape",
    name: "나비",
    meaning: "기쁨",
    path: `${both(BF_FORE, BF_HIND, BF_ANT)} M-1.25 -5.4 C-1.4 -7.6 1.4 -7.6 1.25 -5.4 L1.1 10.6 C0.9 13.4 -0.9 13.4 -1.1 10.6 Z ${circle(0, -8.6, 1.5)}`,
    cutPath:
      "M0 -4 C3 -10 10 -19 19 -22 C23.5 -23.5 26 -22 25.4 -18 C24.5 -13 22.6 -9 20 -5 C22 1 22 7 19 9.8 " +
      "C18 12.4 15.6 14.6 13 14 L10 20 L9.6 13.6 C6 13 3 9 0 4 C-3 9 -6 13 -9.6 13.6 L-10 20 L-13 14 " +
      "C-15.6 14.6 -18 12.4 -19 9.8 C-22 7 -22 1 -20 -5 C-22.6 -9 -24.5 -13 -25.4 -18 C-26 -22 -23.5 -23.5 -19 -22 " +
      "C-10 -19 -3 -10 0 -4 Z",
    detail: `${both(BF_CUTS)} M-1 1 L1 1 M-1 3.6 L1 3.6 M-1 6.2 L1 6.2 M-0.9 8.8 L0.9 8.8`,
    detailWidth: 0.45,
  },
  cloud: {
    id: "cloud",
    kind: "shape",
    name: "구름",
    meaning: "장수",
    path: CLOUD,
    detail: CLOUD_CUTS,
    detailWidth: 0.85,
  },
  peony: {
    id: "peony",
    kind: "shape",
    name: "모란",
    meaning: "부귀",
    path: pe.path,
    cutPath: pe.cutPath,
    detail: pe.detail,
    detailWidth: 0.45,
  },
  crane: {
    id: "crane",
    kind: "shape",
    name: "학",
    meaning: "신선",
    path: CRANE1,
    cutPath:
      "M-30 -6.2 L-22 -7.4 C-16 -4 -10 -1 -6 0 C-9 -6 -12.5 -14 -14.2 -26 L-9 -22 L-6.4 -19.6 L-4.4 -21.4 " +
      "C-3 -23 2 -24 7 -27.5 L10 -26 L17 -11.8 L12 -6 L9 -2.4 C12 3.6 14 5 16 6.6 L30.4 11.4 L28.8 15.6 " +
      "L10.6 8.6 C4 8 -3 6 -7.5 3.4 C-13 1 -19 -2.4 -25 -5.4 Z",
    detail: CRANE1_CUTS,
    detailWidth: 0.42,
  },
  crane2: {
    id: "crane2",
    kind: "shape",
    name: "비상하는 학",
    meaning: "길상",
    path: CRANE2,
    cutPath:
      "M-31 0.2 L-26 -1.6 C-20 0.4 -14 2 -9 2 L-4 0 C-1 -10 6 -19 15 -26.6 L20 -15 L16.6 -5.6 L12.4 -1.6 " +
      "C18 -4 24 -4.6 30.6 -3 L26 6 L18.2 9 L14 9.2 L27.6 13 L25.8 17.4 L10.8 8.4 C6 8.4 -3 7.4 -9 4.2 " +
      "C-15 4.2 -20 2.6 -25.4 0.6 Z",
    detail: CRANE2_CUTS,
    detailWidth: 0.42,
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
  },
  kiku: {
    id: "kiku",
    kind: "pattern",
    name: "국화 넝쿨",
    meaning: "장수",
    ...kiku,
    detailWidth: 0.5,
  },
  orb: {
    id: "orb",
    kind: "shape",
    name: "해·달",
    meaning: "광명",
    path: circle(0, 0, 20),
  },
  cloudLine: {
    id: "cloudLine",
    kind: "shape",
    name: "선 구름",
    meaning: "길상",
    path: "",
    ...cloud2,
  },
  mountain: {
    id: "mountain",
    kind: "shape",
    name: "산",
    meaning: "굳건함",
    path: "",
    ...mtn,
  },
  rock: {
    id: "rock",
    kind: "shape",
    name: "바위",
    meaning: "불변",
    path: "",
    ...rk,
  },
  wave: {
    id: "wave",
    kind: "shape",
    name: "물결",
    meaning: "평안",
    path: "",
    ...wv,
  },
  vine: {
    id: "vine",
    kind: "shape",
    name: "포도넝쿨",
    meaning: "번성",
    path: "",
    ...vn,
  },
  grapeLeaf: {
    id: "grapeLeaf",
    kind: "shape",
    name: "포도잎",
    meaning: "풍요",
    ...gl,
    detailWidth: 0.5,
  },
  grapes: {
    id: "grapes",
    kind: "shape",
    name: "포도송이",
    meaning: "다산",
    ...gr,
  },
  moon: {
    id: "moon",
    kind: "shape",
    name: "초승달",
    meaning: "소망",
    path: "M0 -20 A20 20 0 0 0 0 20 A24 24 0 0 1 0 -20 Z",
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
  },
  turtle: {
    id: "turtle",
    kind: "pattern",
    name: "거북등",
    meaning: "무병장수",
    path: hexagon(17),
    tile: { a: [25.5, 14.72], b: [0, 29.44] },
    cost: 0.5,
    detail: (() => {
      let d = hexagon(10);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        d += ` M${pt(10, a)} L${pt(15.5, a)}`;
      }
      return `${d} ${hexagon(4)}`;
    })(),
  },
};

/** 문양 고르기에 보이는 목록 (모란·댓잎·거북등은 예전 작품 표시용으로만 남김) */
export const MOTIF_LIST: MotifDef[] = (
  [
    "crane",
    "crane2",
    "butterfly",
    "plum",
    "grapes",
    "grapeLeaf",
    "vine",
    "cloud",
    "cloudLine",
    "mountain",
    "rock",
    "wave",
    "orb",
    "moon",
    "diamond",
    "kiku",
  ] as MotifId[]
).map((id) => MOTIFS[id]);

export const SHAPE_MOTIFS = MOTIF_LIST.filter((m) => m.kind === "shape");
export const PATTERN_MOTIFS = MOTIF_LIST.filter((m) => m.kind === "pattern");

/** 밑그림·선택 표시·자르기에 쓰는 바깥 윤곽 */
export const motifOutline = (id: MotifId) => MOTIFS[id].cutPath ?? MOTIFS[id].path;

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
