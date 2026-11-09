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

/* ───────── 바위: 물결치듯 굽은 윤곽이 겹겹이 들어앉은 괴석 ───────── */

export function rock() {
  return ridgeArt(
    [
      { layer: 0, ridges: [[0, 20, 13, 42], [0.5, 20, 9.5, 33], [1, 20, 6, 23]] },
      { layer: 1, ridges: [[-17.5, 20, 10.5, 25], [-18, 20, 7, 17], [-19, 20, 3.6, 9]] },
      { layer: 1, ridges: [[17.5, 20, 10.5, 25], [18, 20, 7, 17], [19, 20, 3.6, 9]] },
      { layer: 1, ridges: [[0, 20, 6.4, 13]] },
    ],
    (u) => Math.pow(Math.max(0, 1 - Math.pow(u, 3)), 0.55),
    0.85,
    3.2,
    1.35,
  );
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

/* ───────── 선 구름: 테두리와 소용돌이를 자개 띠로 두른 구름 ───────── */

export function cloudLine() {
  const outline =
    "M-31 8 C-26 7.4 -22.6 5.6 -20.2 3 A6 6 0 0 1 -12 -5.2 C-11.4 -6.2 -10.9 -7 -10.36 -7.65 " +
    "A9.5 9.5 0 0 1 8.36 -7.65 C8.3 -6.9 8.28 -6.4 8.27 -6 A7 7 0 0 1 20.58 0.39 " +
    "C24 0 27.6 -1.2 31 -3.6 C28.4 0.6 25 3.6 21 5 C19.6 5.6 18.4 6.4 17.42 6.95 " +
    "A5.5 5.5 0 0 1 6.83 7.88 C6.3 8.2 5.8 8.5 5.28 8.68 A6.5 6.5 0 0 1 -7.28 8.68 " +
    "C-7.5 8.2 -7.6 7.9 -7.65 7.66 A4.5 4.5 0 0 1 -15.9 8.75 C-21 10.6 -26.4 10 -31 8 Z";
  const spirals = [
    spiralPts([-1, -5.5], 6.4, 1.1, 1.25, 90, -1),
    spiralPts([-15, 0.4], 3.8, 0.8, 1.15, 70, 1),
    spiralPts([14, -1.4], 4.6, 0.9, 1.2, 120, -1),
    spiralPts([-1, 6.6], 3.2, 0.7, 1.05, 200, 1),
  ];
  const strokes: Stroke[] = [
    { d: outline, w: 1.4 },
    ...spirals.map((s) => ({ d: poly(s), w: 1.2 })),
    { d: "M-28.6 7.6 C-25 6.8 -22 5.8 -19.4 4.8", w: 0.95 },
    { d: "M29.4 -2.2 C26.6 -0.2 24 1.2 21.6 2.2", w: 0.95 },
  ];
  return { strokes, cutPath: outline };
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

/** 국화 넝쿨 단위: 둥근 테 안에 국화 한 송이와,  spiral 로 말린 고사리 잎 */
export function kikuScroll(R = 22) {
  const comma = (c: Pt, deg: number, len: number, w: number) => {
    const a = rad(deg);
    const T = ([u, v]: Pt): Pt => [c[0] + u * Math.cos(a) - v * Math.sin(a), c[1] + u * Math.sin(a) + v * Math.cos(a)];
    const s = (p: Pt) => P(T(p));
    const L = len;
    return (
      `M${s([0, -w * 0.45])} C${s([0.38 * L, -w * 0.95])} ${s([0.78 * L, -w * 0.45])} ${s([L, 0])} ` +
      `C${s([0.78 * L, w * 0.4])} ${s([0.4 * L, w * 0.85])} ${s([0, w * 0.45])} ` +
      `C${s([-0.28 * w, w * 0.4])} ${s([-0.28 * w, -w * 0.4])} ${s([0, -w * 0.45])} Z`
    );
  };
  const parts: string[] = [];
  for (let s = 0; s < 2; s++) {
    const n = 22;
    for (let i = 0; i < n; i++) {
      const t = (i + s * 0.5) / n;
      const a = t * 2.7 * TAU + s * 0.9;
      const rr = 7.2 + t * (R - 9.4);
      if (rr > R - 2.4) continue;
      parts.push(comma([Math.cos(a) * rr, Math.sin(a) * rr], (a * 180) / Math.PI + 72, 4.6 - t * 1.1, 1.7 - t * 0.35));
    }
  }
  let detail = "";
  for (let i = 0; i < 8; i++) {
    const th = rad(i * 45 - 90);
    const T = ([u, v]: Pt): Pt => [u * Math.cos(th) - v * Math.sin(th), u * Math.sin(th) + v * Math.cos(th)];
    parts.push(
      `M${P(T([2.5, -1.55]))} C${P(T([4.8, -2.9]))} ${P(T([7.2, -2.3]))} ${P(T([8.1, 0]))} ` +
        `C${P(T([7.2, 2.3]))} ${P(T([4.8, 2.9]))} ${P(T([2.5, 1.55]))} Z`,
    );
    detail += ` M${P(T([4.2, 0]))} L${P(T([7, 0]))}`;
  }
  parts.push(poly(ringPts([0, 0], 2.5, 36), true));
  detail += ` ${poly(ringPts([0, 0], 1.35, 28), true)}`;
  return {
    path: parts.join(" "),
    strokes: [{ d: poly(ringPts([0, 0], R - 0.55, 120), true), w: 1.15 }],
    detail: detail.trim(),
    cutPath: poly(ringPts([0, 0], R, 60), true),
    tile: { a: [2 * R, 0] as Pt, b: [R, R * Math.sqrt(3)] as Pt },
  };
}
