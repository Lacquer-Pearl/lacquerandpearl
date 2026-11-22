// 문양 기하 생성기: 선(띠)으로 오려 붙이는 문양과 반복 패턴 단위.
// 좌표는 문양 중심 기준 약 ±30 범위입니다.

export type Pt = [number, number];

/** 가늘게 켠 자개 띠 한 줄 */
export interface Stroke {
  d: string;
  w: number;
}

const f = (n: number) => +n.toFixed(2);
const P = (p: Pt) => `${f(p[0])} ${f(p[1])}`;
const rad = (d: number) => (d * Math.PI) / 180;
const TAU = Math.PI * 2;

export const poly = (pts: Pt[], close = false) => `M${pts.map(P).join(" L")}${close ? " Z" : ""}`;

export function ringPts(c: Pt, r: number, n = 72): Pt[] {
  return Array.from({ length: n }, (_, i) => [c[0] + Math.cos((i / n) * TAU) * r, c[1] + Math.sin((i / n) * TAU) * r]);
}

export function bez(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 28): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return [
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ];
  });
}

export function spiralPts(c: Pt, r0: number, r1: number, turns: number, a0Deg: number, dir: 1 | -1): Pt[] {
  const n = Math.ceil(turns * 40);
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const a = rad(a0Deg) + dir * turns * TAU * t;
    const r = r0 + (r1 - r0) * t;
    return [c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r];
  });
}

/** 덩굴손: start에서 heading 방향으로 lead만큼 뻗은 뒤 안으로 말려 들어감 */
export function tendril(start: Pt, heading: number, lead: number, rr: number, turns: number, sense: 1 | -1): Pt[] {
  const h = rad(heading);
  const s: Pt = [start[0] + Math.cos(h) * lead, start[1] + Math.sin(h) * lead];
  const c: Pt = [s[0] + rr * Math.cos(h + (sense * Math.PI) / 2), s[1] + rr * Math.sin(h + (sense * Math.PI) / 2)];
  const a0 = Math.atan2(s[1] - c[1], s[0] - c[0]);
  const n = Math.ceil(turns * 36);
  const pts: Pt[] = [start, s];
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const a = a0 + sense * t * turns * TAU;
    const r = rr * (1 - 0.72 * t);
    pts.push([c[0] + Math.cos(a) * r, c[1] + Math.sin(a) * r]);
  }
  return pts;
}

export function hull(points: Pt[]) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Pt[] = [];
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return poly([...lower.slice(0, -1), ...upper.slice(0, -1)], true);
}

/* ───────── 겹친 선 지우기: 앞쪽 덩어리에 가려지는 뒤쪽 선은 끊어 냄 ───────── */

interface Line {
  pts: Pt[];
  w: number;
  layer: number;
}
interface Occluder {
  layer: number;
  inside: (p: Pt) => boolean;
}

function occlude(lines: Line[], occs: Occluder[]): Stroke[] {
  const out: Stroke[] = [];
  for (const l of lines) {
    let run: Pt[] = [];
    const flush = () => {
      if (run.length > 1) out.push({ d: poly(run), w: l.w });
      run = [];
    };
    for (const p of l.pts) {
      if (occs.some((o) => o.layer > l.layer && o.inside(p))) flush();
      else run.push(p);
    }
    flush();
  }
  return out;
}

/** 봉우리 하나: 아래가 열린 둥근 능선, 법선 방향으로 울퉁불퉁 */
function ridge(
  cx: number,
  by: number,
  hw: number,
  h: number,
  prof: (u: number) => number,
  wob: { amp: number; k: number; phase: number },
  n = 90,
): { pts: Pt[]; y: (x: number) => number } {
  const y = (x: number) => by - h * prof(Math.min(1, Math.abs((x - cx) / hw)));
  const base: Pt[] = Array.from({ length: n + 1 }, (_, i) => {
    const x = cx - hw + (2 * hw * i) / n;
    return [x, y(x)];
  });
  const pts = base.map((p, i): Pt => {
    const a = base[Math.max(0, i - 1)];
    const b = base[Math.min(n, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    const o = wob.amp * Math.sin((i / n) * wob.k * TAU + wob.phase);
    return [p[0] - (ty / l) * o, p[1] + (tx / l) * o];
  });
  return { pts, y };
}

type RidgeSpec = [cx: number, by: number, hw: number, h: number];

function ridgeArt(
  groups: { layer: number; ridges: RidgeSpec[] }[],
  prof: (u: number) => number,
  amp: number,
  k: number,
  w: number,
) {
  const lines: Line[] = [];
  const occs: Occluder[] = [];
  let seed = 0;
  for (const g of groups) {
    g.ridges.forEach(([cx, by, hw, h], i) => {
      const r = ridge(cx, by, hw, h, prof, { amp, k: k * (0.6 + hw / 30), phase: seed++ * 1.7 });
      lines.push({ pts: r.pts, w, layer: g.layer });
      if (i === 0)
        occs.push({
          layer: g.layer,
          inside: ([x, y]) => Math.abs(x - cx) < hw - 0.4 && y > r.y(x) - (w * 1.4 + amp),
        });
    });
  }
  const strokes = occlude(lines, occs);
  return { strokes, cutPath: hull(lines.flatMap((l) => l.pts)) };
}

/* ───────── 산: 겹겹이 이어지는 둥근 봉우리 ───────── */

export function mountain() {
  const front = (cx: number, hw: number, h: number): RidgeSpec[] => [
    [cx, 20, hw, h],
    [cx, 20, hw * 0.56, h * 0.52],
  ];
  return ridgeArt(
    [
      { layer: 0, ridges: [[0, 12, 17, 32], [0, 14, 12.5, 25], [0, 16, 8.5, 17]] },
      { layer: 1, ridges: [[-18, 16, 12.5, 22], [-18, 17, 8.5, 14], [-19, 18, 5, 7]] },
      { layer: 1, ridges: [[18, 16, 12.5, 22], [18, 17, 8.5, 14], [19, 18, 5, 7]] },
      { layer: 2, ridges: front(-23, 7.5, 6) },
      { layer: 2, ridges: front(23, 7.5, 6) },
      { layer: 3, ridges: front(-8, 8, 7) },
      { layer: 3, ridges: front(8, 8, 7) },
    ],
    (u) => Math.pow(Math.cos((u * Math.PI) / 2), 1.3),
    0.32,
    5,
    1.3,
  );
}

/* 『우리나라 전통무늬 3: 나전·화각』 도판 090, 나전장생문상자의 괴석을 참고한 도안. */
export function rock() {
  // 큰 돌을 한 장으로 오린다. 움푹 들어간 허리와 밑동의 열린 틈은 외곽의 일부다.
  const path =
    "M-27 17.6 Q-25.8 15.6 -23.6 15 C-19.1 13.8 -18.6 9.3 -18.5 5.7 " +
    "Q-15.3 5.6 -13.1 2.9 C-10.6 4 -7 3.3 -6.3 0.6 C-5.6 -2.1 -7.8 -5.2 -10.1 -6.4 " +
    "Q-7.8 -8.6 -8.2 -11.8 Q-5.2 -12.8 -3.8 -15.4 Q-1.7 -17.8 -1.2 -20.3 " +
    "Q2.8 -19.6 5.7 -21 C8.7 -18.1 11.6 -17.8 15.5 -18.1 Q16.8 -14.7 20.5 -12.9 " +
    "Q18.1 -10 18.2 -7.1 C12.5 -7.4 8.3 -4.9 8.1 -2.7 C8 -0.9 10.8 -0.1 13.6 -1.5 " +
    "Q14.7 1.3 17.4 2 C16.3 6.4 18.5 8 22.1 8.7 Q21.7 12.4 25.2 14.5 L27 16.3 " +
    "Q21.5 18.2 17.3 17.3 C15.4 16.8 15.9 11.6 12.8 11.8 C9.1 12.1 11.8 17.5 7.2 18.9 " +
    "Q3.4 20.2 0.7 18.6 C-2.2 17.6 0.2 13.9 -2.3 12.4 C-5.5 10.6 -10.3 13.7 -10.7 17.3 " +
    "Q-11 19.4 -13.1 19.1 Q-17.2 18.1 -20 19 Q-23.4 18.1 -27 17.6 Z";

  const holes = [
    "M-1.3 -11.7 C0.2 -14.3 4.2 -14.5 7.6 -14.3 Q10.4 -14.1 11.7 -14.7 " +
      "C12.2 -12.1 9.1 -9.4 5.5 -8.3 C1.7 -7 -3.5 -8.2 -1.3 -11.7 Z",
    "M-1.5 5.4 C-1.1 2.8 1.5 0.6 4 0.7 C6.8 0.7 6.3 3.9 5.1 5.4 " +
      "C3.6 7.7 0.1 8.4 -1.6 7.2 Q-2.2 6.6 -1.5 5.4 Z",
  ].join(" ");

  // 가장자리의 접힌 면과 구멍의 턱. 짧은 활 모양 칼금은 그늘지는 면에만 모은다.
  const detail = [
    "M-6.8 -11.1 Q-3.5 -12.6 -1 -18.1 Q2.2 -17.7 5.4 -19.4",
    "M7.2 -18 Q10.2 -15.9 14.2 -16.3 Q15 -13.9 17.4 -12.6",
    "M-2.5 -10.9 C-4.4 -6.5 1.1 -5.3 5.6 -7 M7.2 -7.5 Q11.7 -9.4 12.4 -12.1",
    "M15.2 -6.4 C6.8 -6.1 4.3 0 10.3 0.1",
    "M-16.9 7.1 Q-14.6 6.7 -13 4.7 Q-9.9 5.7 -7.4 4.1",
    "M-12 16 Q-11.5 11.8 -7.5 10.6 M-2.6 6.4 Q-3.4 3.4 -0.9 1.4",
    "M0 8.7 Q4 9.2 6.3 5.4 M17.5 9.8 Q18.1 12.5 20.9 14.1",
    "M-20.3 13.4 Q-19.2 11.9 -19.6 10.7 M-18.8 12.6 Q-17.9 11.5 -18 10",
    "M1.4 -16 Q2 -16.8 2.2 -17.4 M2.8 -15.9 Q3.5 -16.6 3.6 -17.2",
    "M2.5 -3.9 Q2.6 -2.7 1.5 -1.7 M3.8 -3.8 Q3.7 -2.2 2.9 -1.6",
  ].join(" ");
  const toolMarks = [
    "M-5.6 -7.8 Q-3.5 -7.3 -3.4 -5.2 Q-4.1 -6.9 -5.6 -7.8 Z",
    "M-6.4 -6.8 Q-4.1 -5.6 -4.2 -4 Q-4.9 -5.5 -6.4 -6.8 Z",
    "M13.6 -11.8 Q15 -13 15.7 -13.1 Q14 -11.6 13.5 -9.9 Z",
    "M-11.2 7 Q-9.4 6.3 -8.7 5.4 Q-9.4 7.2 -11.2 7.8 Z",
    "M8.3 5.9 Q9.8 6.6 10.2 8.7 Q9.4 7 8.3 5.9 Z",
    "M9.4 5.3 Q11.4 6 11.7 8 Q10.8 6.4 9.4 5.3 Z",
  ].join(" ");
  return { path, holes: holes + " " + toolMarks, detail, detailWidth: 0.35 };
}

/* ───────── 물결: 겹친 비늘 물결 위로 말려 오르는 물마루와 물방울 ───────── */

export function wave() {
  const W = 1.2;
  const lines: Line[] = [];
  const occs: Occluder[] = [];
  const scallop = (cx: number, cy: number, r: number, layer: number) => {
    for (const k of [1, 0.67, 0.34]) {
      const n = 56;
      lines.push({
        pts: Array.from({ length: n + 1 }, (_, i) => {
          const a = Math.PI + (Math.PI * i) / n;
          return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k];
        }),
        w: W,
        layer,
      });
    }
    occs.push({ layer, inside: ([x, y]) => Math.hypot(x - cx, y - cy) < r + W * 1.3 && y < cy + 0.6 });
  };
  const crest = (sx: number, sy: number, h: number, dir: 1 | -1, rr: number) => {
    const top: Pt = [sx, sy - h];
    const tail = bez([sx - dir * 3, sy], [sx - dir * 3, sy - h * 0.5], [sx - dir * 0.4, sy - h * 0.85], top, 20);
    const c: Pt = [sx + dir * rr, sy - h];
    const sp = spiralPts(c, rr, rr * 0.3, 1.15, dir > 0 ? 180 : 0, dir).slice(1);
    lines.push({ pts: [...tail, ...sp], w: W, layer: -1 });
  };
  crest(-27, 9, 9, 1, 3);
  crest(-23.5, 9, 6, 1, 2.2);
  crest(11, 8, 17, -1, 4.6);
  crest(14.5, 8, 12, -1, 3.2);
  crest(27, 9, 8.5, -1, 2.8);
  for (const x of [-16, 0, 16]) scallop(x, 10, 8, 0);
  for (const x of [-24, -8, 8, 24]) scallop(x, 16, 8, 1);
  const strokes = occlude(lines, occs);
  const bubbles: Pt[] = [[-29, 3], [-14, -3], [-10.5, 1.8], [-2, -7], [2.5, -2.2], [20, -11], [22.5, -1.5], [30, 3]];
  for (const b of bubbles) strokes.push({ d: poly(ringPts(b, 1.25, 24), true), w: 0.85 });
  const all = [...lines.flatMap((l) => l.pts), ...bubbles];
  return { strokes, cutPath: hull(all) };
}

/* 도판 088, 나전운학문상자(조선 18세기). 서로 마주 굽은 조각 사이로 옻칠이 넝쿨처럼 이어진다. */
const cloudScrolls = [
  // 구름머리 위쪽의 아래로 열린 고리
  {
    grainAngle: 12,
    shell: "M-11.2 -4.5 C-12.7 -9.7 -8.9 -14.3 -3.7 -14.7 C0.1 -15.1 3.3 -12.6 3.6 -9.3 " +
      "C3.8 -7.2 2.3 -5.9 0.8 -7.1 C-0.4 -8.1 0 -10 -2.2 -10.2 C-4.8 -10.5 -6.1 -8.4 -5.8 -6.5 " +
      "C-5.1 -3.1 -7.6 -1.9 -9.5 -2.7 Q-10.7 -3.1 -11.2 -4.5 Z",
    spine: "M-8.4 -4.3 C-10.4 -12.9 -0.4 -16 1.8 -8.4",
  },
  // 왼쪽 꼬리는 불룩한 마디를 한 번 꺾고 가늘게 빠진다.
  {
    grainAngle: 81,
    shell: "M-29.35 8.65 C-23.55 6.15 -23.05 1.15 -19.95 -2.05 C-17.55 -4.65 -14.35 -4.85 -12.35 -3.75 " +
      "Q-11.15 -2.85 -11.65 -1.55 C-9.05 -2.85 -7.45 -1.85 -7.55 0.15 C-7.55 2.65 -9.55 4.75 -11.85 4.55 " +
      "Q-14.25 4.35 -13.95 2.05 C-18.75 2.05 -19.75 9.55 -29.35 8.65 Z",
    spine: "M-28.05 8.25 C-21.75 6.45 -19.95 -2.25 -15.75 -1.85 Q-13.25 -2.35 -12.05 0.65 Q-10.65 3.15 -8.95 0.25",
  },
  // 마주 굽는 두 조각이 맞물려 작은 빈 구름눈을 만든다.
  {
    grainAngle: -32,
    shell: "M-4.6 -0.4 C-2.5 -1.2 -2.3 1.5 -0.4 1.9 C2.4 2.6 4.7 0.5 4.1 -1.6 " +
      "C3.6 -3.6 1.3 -3.7 1.4 -5.2 C1.8 -7.2 4.7 -7.2 6.5 -5.7 C10.1 -2.7 8.9 2.2 6 4.4 " +
      "C2 7.4 -4.5 6.4 -6 3 C-6.8 1.5 -6.2 0.3 -4.6 -0.4 Z",
    spine: "M-4.3 1.5 C-1.1 7.6 10.3 3.7 6 -3.2 Q5.1 -4.9 3 -5.4",
  },
  {
    grainAngle: 48,
    shell: "M-7.7 2.5 C-6.1 2.4 -5.5 3.9 -6 5.2 C-6.7 7.6 -3.7 9.9 -0.9 9.4 " +
      "C1.5 9 1.8 6.3 3.6 6.1 C6.1 5.9 6.8 8.9 5.1 11.3 C2.3 15.9 -4.7 16.3 -8.8 12.9 " +
      "C-11.9 10.5 -12.5 6.5 -10.6 4 Q-9.4 2.6 -7.7 2.5 Z",
    spine: "M-8.3 4.7 C-12.5 12.9 0.9 18.3 4.3 8.4",
  },
  // 오른쪽 위와 아래의 꼬리는 굽이와 길이가 서로 다르다.
  {
    grainAngle: -71,
    shell: "M4.3 -7.35 C2.8 -11.05 5.3 -15.25 8.7 -16.55 Q11.1 -17.65 14.7 -17.95 Q18.1 -18.35 21.1 -21.75 " +
      "C20.2 -17.05 17 -15.45 13 -13.95 C9.2 -12.65 8.5 -10.65 9.2 -9.25 C10.1 -8.05 11.8 -8.55 12.2 -9.85 " +
      "C13.4 -6.85 10.7 -4.15 7.9 -4.25 Q5.3 -4.35 4.3 -7.35 Z",
    spine: "M20.2 -20.55 C17.8 -15.65 13 -16.75 8.8 -13.65 C3.5 -9.45 7.4 -3.85 10.7 -6.95",
  },
  {
    grainAngle: 20,
    shell: "M8.05 1.7 C9.85 -1.9 13.85 -2.5 16.95 -0.2 C20.45 2.5 21.65 7.2 28.75 9.2 " +
      "C23.05 10.6 18.65 6.9 15.35 4.5 C13.85 3.3 12.15 3.7 11.75 4.9 Q13.15 5.2 13.65 6.3 " +
      "C12.35 8 9.35 7.8 8.05 6.3 Q6.45 4.3 8.05 1.7 Z",
    spine: "M10.35 5.4 C8.15 0.8 13.35 -0.7 16.95 2.6 Q23.15 9 27.65 9.2",
  },
];
export const CLOUD_INLAY = {
  path: cloudScrolls.map(({ shell }) => shell).join(" "),
  grainAngles: cloudScrolls.map(({ grainAngle }) => grainAngle),
};

export function cloudLine() {
  return { strokes: cloudScrolls.map(({ spine }) => ({ d: spine, w: 1.65 })) };
}

/* ───────── 포도: 넝쿨 · 잎 · 송이 ───────── */

export function vine() {
  const s1: [Pt, Pt, Pt, Pt] = [[-30, 10], [-20, -4], [-10, 16], [0, 4]];
  const s2: [Pt, Pt, Pt, Pt] = [[0, 4], [8, -6], [18, 4], [30, -10]];
  const at = (s: [Pt, Pt, Pt, Pt], t: number) => bez(...s, 100)[Math.round(t * 100)];
  const main1 = bez(...s1, 40);
  const main2 = bez(...s2, 40);
  const twigStart = at(s1, 0.86);
  const twig = bez(twigStart, [2, -4], [6, -10], [10, -14], 20);
  const curls = [
    tendril(at(s1, 0.3), -80, 4, 3, 1.3, 1),
    tendril(at(s1, 0.6), 100, 3, 2.5, 1.2, -1),
    tendril(at(s2, 0.35), -100, 5, 3, 1.25, -1),
    tendril(at(s2, 0.8), 70, 3, 2.4, 1.2, 1),
    tendril([10, -14], -60, 1.5, 2.5, 1.3, 1),
    tendril([30, -10], -40, 1, 2.2, 1.2, -1),
  ];
  const strokes: Stroke[] = [
    { d: poly(main1), w: 2.4 },
    { d: poly(main2), w: 1.7 },
    { d: poly(twig), w: 1.2 },
    ...curls.map((c) => ({ d: poly(c), w: 0.8 })),
  ];
  return { strokes, cutPath: hull([...main1, ...main2, ...twig, ...curls.flat()]) };
}

export function grapeLeaf() {
  const c: Pt = [0, -1];
  const lobes: [number, number, number][] = [
    [-90, 1, 0.42],
    [-38, 0.9, 0.4],
    [-142, 0.9, 0.4],
    [28, 0.68, 0.36],
    [152, 0.68, 0.36],
  ];
  const rOf = (th: number) => {
    let m = 0;
    for (const [a, wgt, sig] of lobes) {
      let d = Math.abs(th - rad(a));
      if (d > Math.PI) d = TAU - d;
      m = Math.max(m, wgt * Math.exp(-((d / sig) ** 2)));
    }
    let dBot = Math.abs(th - Math.PI / 2);
    if (dBot > Math.PI) dBot = TAU - dBot;
    const notch = 1 - 0.38 * Math.exp(-((dBot / 0.32) ** 2));
    const serr = 1 + 0.07 * Math.sin(th * 24) * (0.35 + 0.65 * m);
    return 21 * (0.26 + 0.74 * m) * notch * serr;
  };
  const edge = (n: number): Pt[] =>
    Array.from({ length: n }, (_, i) => {
      const th = (i / n) * TAU;
      return [c[0] + Math.cos(th) * rOf(th), c[1] + Math.sin(th) * rOf(th)];
    });
  let detail = "";
  for (const [a] of lobes) {
    const tr = rOf(rad(a)) * 0.84;
    const tip: Pt = [c[0] + Math.cos(rad(a)) * tr, c[1] + Math.sin(rad(a)) * tr];
    const mid: Pt = [c[0] + Math.cos(rad(a)) * tr * 0.48, c[1] + Math.sin(rad(a)) * tr * 0.48];
    detail += ` M${P([c[0] + Math.cos(rad(a)) * 1.4, c[1] + Math.sin(rad(a)) * 1.4])} Q${P(mid)} ${P(tip)}`;
    for (const side of [-1, 1]) {
      const b: Pt = [c[0] + Math.cos(rad(a)) * tr * 0.46, c[1] + Math.sin(rad(a)) * tr * 0.46];
      const e: Pt = [b[0] + Math.cos(rad(a + side * 42)) * tr * 0.32, b[1] + Math.sin(rad(a + side * 42)) * tr * 0.32];
      detail += ` M${P(b)} L${P(e)}`;
    }
  }
  return {
    path: poly(edge(320), true),
    strokes: [{ d: poly(bez([0, 10], [0.2, 14], [0.8, 18], [1.6, 22], 16)), w: 1.5 }],
    detail: detail.trim(),
    cutPath: poly(edge(90), true),
  };
}

export function grapes() {
  const counts = [2, 3, 4, 3, 3, 2, 1];
  const r = 3.7;
  const berries: Pt[] = [];
  counts.forEach((n, i) => {
    for (let j = 0; j < n; j++) {
      berries.push([
        (j - (n - 1) / 2) * 6.2 + Math.sin(i * 5 + j * 2) * 0.45,
        -14 + i * 5.6 + Math.abs(j - (n - 1) / 2) * 0.4,
      ]);
    }
  });
  const stem = bez([0, -16.8], [0.4, -21], [2.4, -24.4], [6.2, -26.5], 16);
  const curl = tendril([3.6, -24.8], -150, 2.2, 2.4, 1.25, 1);
  return {
    path: berries.map((b) => poly(ringPts(b, r, 36), true)).join(" "),
    strokes: [
      { d: poly(stem), w: 1.45 },
      { d: poly(curl), w: 0.75 },
    ],
    cutPath: hull([...berries.flatMap((b) => ringPts(b, r, 14)), ...stem, ...curl]),
  };
}

/* ───────── 반복 패턴 단위 ───────── */

/** 삼각형을 내심 쪽으로 d만큼 줄인 구멍 */
function insetTri(a: Pt, b: Pt, c: Pt, d: number) {
  const la = Math.hypot(b[0] - c[0], b[1] - c[1]);
  const lb = Math.hypot(a[0] - c[0], a[1] - c[1]);
  const lc = Math.hypot(a[0] - b[0], a[1] - b[1]);
  const per = la + lb + lc;
  const ix = (la * a[0] + lb * b[0] + lc * c[0]) / per;
  const iy = (la * a[1] + lb * b[1] + lc * c[1]) / per;
  const area = Math.abs((b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1])) / 2;
  const k = 1 - d / ((2 * area) / per);
  const q = (p: Pt): Pt => [ix + (p[0] - ix) * k, iy + (p[1] - iy) * k];
  return poly([q(a), q(b), q(c)], true);
}

/** 끊음질 삼잎(마엽) 단위: 육각형 하나. 이웃과 맞붙이면 무늬가 끝없이 이어짐 */
export function asanohaHex(R = 12, inset = 0.55) {
  const V: Pt[] = Array.from({ length: 6 }, (_, k) => [Math.cos(rad(-90 + 60 * k)) * R, Math.sin(rad(-90 + 60 * k)) * R]);
  const O: Pt = [0, 0];
  let holes = "";
  for (let k = 0; k < 6; k++) {
    const a = V[k];
    const b = V[(k + 1) % 6];
    const g: Pt = [(a[0] + b[0]) / 3, (a[1] + b[1]) / 3];
    holes += insetTri(O, a, g, inset) + " " + insetTri(a, b, g, inset) + " " + insetTri(b, O, g, inset) + " ";
  }
  const s3 = Math.sqrt(3);
  return {
    path: poly(V, true),
    holes: holes.trim(),
    tile: { a: [s3 * R, 0] as Pt, b: [(s3 * R) / 2, 1.5 * R] as Pt },
  };
}
/** 열린 자개 띠: 끝은 자르고, 옆 조각과 이어 붙일 수 있게 한다 */
function ribbon(pts: Pt[], w: number) {
  if (pts.length < 2) return "";
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)];
    const b = pts[Math.min(pts.length - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    const nx = (-ty / l) * (w / 2);
    const ny = (tx / l) * (w / 2);
    left.push([pts[i][0] + nx, pts[i][1] + ny]);
    right.push([pts[i][0] - nx, pts[i][1] - ny]);
  }
  return poly([...left, ...right.reverse()], true);
}

/** 당초 잎 한 장: 초승달처럼 말린 넓은 잎 */
function acanthus(c: Pt, deg: number, len: number, w: number, curl: number) {
  const a = rad(deg);
  const T = ([u, v]: Pt): Pt => [c[0] + u * Math.cos(a) - v * Math.sin(a), c[1] + u * Math.sin(a) + v * Math.cos(a)];
  const s = (p: Pt) => P(T(p));
  const L = len;
  const k = curl * w;
  return (
    `M${s([0, 0])} C${s([0.18 * L, -0.95 * w])} ${s([0.52 * L, -1.15 * w])} ${s([0.9 * L, -0.15 * w])} ` +
    `C${s([1.08 * L, 0.55 * k])} ${s([0.78 * L, 0.95 * k])} ${s([0.48 * L, 0.12 * w])} ` +
    `C${s([0.28 * L, 0.62 * w])} ${s([0.1 * L, 0.28 * w])} ${s([0, 0])} Z`
  );
}

/** 국화 넝쿨 단위: 국화 둘레에 열린 당초, 좌우로 잘린 줄기가 이웃과 이어짐 */
export function kikuScroll() {
  const half = 28;
  const fx = 0;
  const fy = -1.5;
  const stemPts: Pt[] = Array.from({ length: 29 }, (_, i) => {
    const t = i / 28;
    return [-half + 2 * half * t, 6 + 1.4 * Math.sin(t * TAU)];
  });
  const volute = (cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, w: number) => {
    const n = 24;
    const spine: Pt[] = Array.from({ length: n + 1 }, (_, i) => {
      const t = i / n;
      const a = rad(a0 + (a1 - a0) * t);
      const r = r0 + (r1 - r0) * t;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    });
    return ribbon(spine, w);
  };
  const parts: string[] = [
    ribbon(stemPts, 2.2),
    volute(fx - 0.5, fy + 0.5, 7.2, 14.5, 200, 55, 2.35),
    volute(fx + 1.5, fy + 2.5, 6.2, 13, -25, 125, 2.15),
    acanthus([fx + 13, fy - 3], -8, 13, 5.2, 1),
    acanthus([fx + 15, fy + 6], 48, 11.5, 4.6, -1),
    acanthus([fx + 22, fy + 2], 4, 9.5, 3.8, 1),
    acanthus([fx - 14, fy - 2], 172, 13, 5.2, -1),
    acanthus([fx - 16, fy + 7], 220, 11, 4.4, 1),
    acanthus([fx - 23, fy + 3], 176, 9, 3.6, -1),
  ];
  let detail = "";
  for (let i = 0; i < 8; i++) {
    const th = rad(i * 45 - 90);
    const T = ([u, v]: Pt): Pt => [fx + u * Math.cos(th) - v * Math.sin(th), fy + u * Math.sin(th) + v * Math.cos(th)];
    parts.push(
      `M${P(T([2.4, -1.85]))} C${P(T([4.8, -3.4]))} ${P(T([7.2, -2.5]))} ${P(T([8.1, 0]))} ` +
        `C${P(T([7.2, 2.5]))} ${P(T([4.8, 3.4]))} ${P(T([2.4, 1.85]))} Z`,
    );
    detail += ` M${P(T([4, 0]))} L${P(T([6.8, 0]))}`;
  }
  parts.push(poly(ringPts([fx, fy], 2.9, 32), true));
  detail += ` ${poly(ringPts([fx, fy], 1.5, 28), true)}`;
  return {
    path: parts.join(" "),
    detail: detail.trim(),
    cutPath: `M${-half} -18 H${half} V20 H${-half} Z`,
    tile: { a: [2 * half, 0] as Pt, b: [0, 36] as Pt },
    cost: 0.5,
  };
}

