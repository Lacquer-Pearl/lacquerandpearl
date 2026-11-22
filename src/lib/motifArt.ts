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

/* ───────── 괴석: 비스듬히 선 큰 돌과 그 밑동을 가리는 두 개의 낮은 돌 ───────── */

export function rock() {
  // 앞돌의 윗선과 뒤돌의 아랫선 사이에 옻이 가늘게 보인다.
  const main = "M-16.6 5.4 Q-13.7 0.4 -14.6 -3.5 Q-10.1 -5.7 -11.5 -10.5 " +
    "C-11.7 -12 -8.8 -11.7 -7.6 -14.4 Q-6.9 -16 -7.4 -17.7 C-6.7 -19.6 -3.8 -19.5 -2.6 -20.9 " +
    "Q0.5 -22.6 4 -21.6 L8.7 -20 Q8 -18.5 6.8 -17.3 C4.1 -13.7 7.3 -13.7 7.7 -12.1 " +
    "C8.1 -10.6 5.4 -8.9 6.5 -6.7 Q7.4 -5.2 10.7 -4.4 Q14 -3.8 12.2 -0.1 " +
    "L6.3 1.9 Q5.1 2.2 3.7 5.8 L0.3 6.6 L-1.4 10.6 Q-4.5 9 -6 4.3 L-11.7 2.2 Z";
  const left = "M-27.7 17.4 Q-24.7 14.7 -25 12 Q-21.7 10.8 -22.3 8.2 " +
    "Q-22.7 7.3 -20.8 7.2 Q-17.6 7.2 -13.3 4.1 Q-11.6 3.1 -9.9 4.3 L-7 5.4 " +
    "Q-6.4 9.5 -1.8 12.2 L-4.7 16.5 Q-8.8 18.1 -15.4 18.8 Q-22.1 19 -27.7 17.4 Z";
  const right = "M-4 18.4 Q0.6 13.6 1.4 8 Q5.3 7 6.9 3.6 Q7 2.8 10.2 2.6 " +
    "Q14.2 2.5 16.2 -0.7 Q17.9 -1.4 20.6 0.6 Q18.9 3.6 21.4 5.9 " +
    "C23 7.6 20.1 9.6 22.1 11.9 Q23.2 13.4 25 13.8 L27.2 16.7 " +
    "Q23.5 17.6 19.6 17.2 L14 18.5 Q6.8 20.2 -4 18.4 Z";

  const fissures = [
    // 돌의 층이 돌아서는 부위에 긴 결을, 깎여 나간 한 곳에만 깊은 구멍을 둔다.
    "M7.6 -19.5 Q5.1 -18.4 2.1 -18.4 Q-0.8 -18.4 -1.8 -16.2 " +
      "C-3.1 -13.9 -1.6 -12.3 -2.8 -10.5 Q-3.6 -9.3 -5.5 -8.8 Q-7.2 -5.4 -7.6 -2 " +
      "Q-6.5 -5.2 -5 -8.1 Q-0.5 -9.8 -1.4 -13.3 C-2.1 -16.2 0 -17.6 2.5 -17.7 Q5.8 -17.8 7.6 -19.5 Z",
    "M1 -6.4 C2.5 -7.3 4 -8.4 4.3 -10.1 C5.5 -8.5 4.1 -6.9 3.4 -6 " +
      "C2.8 -5.1 3.5 -4.6 2.3 -3.6 Q0.8 -2.9 -1 -2.9 Q0.5 -4 -0.2 -4.5 Q-0.7 -5.6 1 -6.4 Z",
    "M-22.9 15.2 Q-20.7 13.3 -19 10.5 Q-17.8 9.2 -15.4 8.9 Q-13.6 7.1 -12.3 4.2 " +
      "Q-13 7.7 -14.9 9.5 Q-18.1 9.7 -19.2 11.7 Q-20.8 14.2 -22.9 15.2 Z",
    "M16.6 -0.1 Q15.1 2.1 14.7 4.6 Q14.6 6.1 12.4 6.8 L10.1 7.7 Q9.8 11.4 5.5 15.6 " +
      "Q10.1 12.6 11 8.4 Q15.4 6.8 15.5 5.4 Q15.5 2.9 16.6 -0.1 Z",
    "M19.5 10.5 Q18.3 13 15.3 14.5 L11.7 16 Q16.6 14.9 18.5 13.1 Z",
  ];
  const detail = [
    "M-6.3 -14.2 Q-5.6 -17.7 -2.2 -18.9",
    "M-9.9 -6 Q-10.7 -2.9 -12.5 -0.8",
    "M-9 8.5 Q-8.1 11.8 -10.8 14.3",
    "M-10.5 10.6 Q-10.4 11.9 -12 13.6",
    "M13.2 10.6 Q12 13 9.8 14.7",
  ].join(" ");
  return { path: [main, left, right].join(" "), holes: fissures.join(" "), detail, detailWidth: 0.36 };
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

/* ───────── 구름: 여의두처럼 굽은 머리에서 두 갈래로 풀리는 꼬리 ───────── */

export const CLOUD_OUTLINE =
  "M-31 3.4 C-29.9 -1.7 -26.3 -7.6 -20.9 -7.6 Q-18.9 -7.7 -17.3 -6.5 " +
  "C-16.6 -12 -10.9 -15.7 -5.7 -14.1 Q-1.7 -13.1 -0.5 -9.5 " +
  "C3.3 -11.5 7 -9.4 7.5 -6.3 C11.6 -7.9 14.5 -5.9 18.8 -5.6 " +
  "Q24.7 -5 31.3 -10.1 C27.1 -3 20.7 -1.8 15.3 -2.6 " +
  "Q20.2 1.6 29.9 -0.1 C24.5 4.5 18.4 4.7 12.8 3.6 C7.2 2.3 4.9 3.9 0.9 6.6 " +
  "C-3.7 9.8 -8.3 10 -11.2 8 Q-15.1 12.6 -21.3 11.1 C-26.5 10 -26.9 5.4 -31 3.4 Z";

export function cloudLine() {
  const strokes: Stroke[] = [
    { d: CLOUD_OUTLINE, w: 1.2 },
    { d: "M-24.2 5.8 C-20 9.3 -13.6 7.9 -10.5 3.2 C-8.9 0.6 -10.5 -1.9 -13.4 -1.7 " +
         "C-14.2 -5.7 -11.1 -10.4 -6.7 -10.1 Q-3.3 -10.1 -1.6 -6.8", w: 0.98 },
    { d: "M-4.6 4.8 C0.1 2.5 2.7 -0.8 7 -1.5 C10.3 -2 12.7 -1.3 15 -0.9", w: 0.85 },
  ];
  return { strokes, cutPath: CLOUD_OUTLINE };
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

