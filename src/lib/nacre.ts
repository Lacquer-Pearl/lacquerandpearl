// 자개(판자개) 텍스처를 절차적으로 그려 이미지로 캐시합니다.
// 얇게 켠 조각들을 줄지어 이어 붙인 판자개 구조, 조각마다 다른 성장선과 광채를 흉내 냅니다.

import { useEffect, useSyncExternalStore } from "react";
import type { PearlId } from "./data";

/** 텍스처 한 장이 덮는 문양 좌표 크기 */
export const NACRE_TILE = 96;
const SIZE = 512;
const VERSION = 4;

type RGB = readonly [number, number, number];

interface Recipe {
  /** fan: 부채꼴 성장선(진주패류) · swirl: 물결 띠(전복류) */
  kind: "fan" | "swirl";
  seed: number;
  body: RGB[];
  flash: RGB[];
  /** 결과 결 사이 어두운 바탕 */
  matrix: RGB;
  flashAmt: number;
  /** 광채 얼룩 밖에도 깔리는 기본 광채 */
  flashBase: number;
  ring: number;
  seam: number;
  sat: number;
  tileLight: number;
  rowH: [number, number];
  tileW: [number, number];
}

const rgb = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const pal = (...h: string[]) => h.map(rgb);

const RECIPES: Record<PearlId, Recipe> = {
  white: {
    kind: "fan",
    seed: 11,
    body: pal("#b9b4ad", "#cdc8c0", "#d9d4cc", "#c4bfb7", "#aea9a2"),
    flash: pal("#d9b3be", "#b3cbc6", "#b2bdd8", "#d8c8a4", "#c4b4d4", "#b6d0b2"),
    matrix: rgb("#a8a29a"),
    flashAmt: 0.66,
    flashBase: 0.35,
    ring: 0.08,
    seam: 0.2,
    sat: 0.82,
    tileLight: 0.11,
    rowH: [44, 72],
    tileW: [70, 170],
  },
  black: {
    kind: "fan",
    seed: 23,
    body: pal("#3c3834", "#514b45", "#625b53", "#45403b", "#2f2c29"),
    flash: pal("#b08595", "#5e9893", "#84a274", "#8a7fae", "#c2bcb2", "#a1806a"),
    matrix: rgb("#1e1b19"),
    flashAmt: 0.78,
    flashBase: 0.1,
    ring: 0.13,
    seam: 0.34,
    sat: 0.8,
    tileLight: 0.2,
    rowH: [40, 66],
    tileW: [64, 150],
  },
  abalone: {
    kind: "swirl",
    seed: 37,
    body: pal("#6f9690", "#8189ad", "#8ea47f", "#9d8ea6"),
    flash: pal("#7fb3ad", "#b58fb0", "#7f97c6", "#9cbf8c", "#c4b283", "#9a8ac0"),
    matrix: rgb("#6e6650"),
    flashAmt: 0.72,
    flashBase: 0,
    ring: 0.12,
    seam: 0.16,
    sat: 0.78,
    tileLight: 0.08,
    rowH: [60, 104],
    tileW: [110, 220],
  },
  paua: {
    kind: "swirl",
    seed: 53,
    body: pal("#24525e", "#2e4373", "#296457", "#4a3f72"),
    flash: pal("#3d8c9c", "#4d63ad", "#3c9676", "#7461a6", "#93ad58", "#4a83c2", "#2f6f8f"),
    matrix: rgb("#6b5833"),
    flashAmt: 0.86,
    flashBase: 0,
    ring: 0.12,
    seam: 0.22,
    sat: 0.84,
    tileLight: 0.1,
    rowH: [64, 112],
    tileW: [120, 240],
  },
};

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(x: number, y: number, s: number) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const mod = (a: number, n: number) => ((a % n) + n) % n;

function vnoise(x: number, y: number, px: number, py: number, s: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  let fx = x - ix;
  let fy = y - iy;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  const x0 = mod(ix, px);
  const x1 = mod(ix + 1, px);
  const y0 = mod(iy, py);
  const y1 = mod(iy + 1, py);
  const a = hash(x0, y0, s);
  const b = hash(x1, y0, s);
  const c = hash(x0, y1, s);
  const d = hash(x1, y1, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** 이음매 없이 반복되는 fbm. u, v는 0~1 텍스처 좌표, fx·fy는 정수 주파수 */
function fbm(u: number, v: number, fx: number, fy: number, s: number, oct: number) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(u * fx, v * fy, fx, fy, s + i * 17);
    norm += amp;
    fx *= 2;
    fy *= 2;
    amp *= 0.5;
  }
  return sum / norm;
}

/** 자개 결정이 모인 잔 면(셀)마다 고유한 값 */
function cell(x: number, y: number, n: number, s: number) {
  const gx = (x / SIZE) * n;
  const gy = (y / SIZE) * n;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  let best = 1e9;
  let id = 0;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const cx = mod(ix + i, n);
      const cy = mod(iy + j, n);
      const dx = ix + i + hash(cx, cy, s) - gx;
      const dy = iy + j + hash(cx, cy, s + 1) - gy;
      const d = dx * dx + dy * dy;
      if (d < best) {
        best = d;
        id = hash(cx, cy, s + 2);
      }
    }
  return id;
}

/** fbm 값은 0.5 근처에 몰리므로 0~1로 넓혀 씁니다 */
const stretch = (n: number) => Math.max(0, Math.min(1, (n - 0.5) * 2.4 + 0.5));

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function cyc(p: RGB[], t: number, out: number[]) {
  const n = p.length;
  const f = (t - Math.floor(t)) * n;
  const i = Math.floor(f);
  let k = f - i;
  k = k * k * (3 - 2 * k);
  const a = p[i % n];
  const b = p[(i + 1) % n];
  out[0] = a[0] + (b[0] - a[0]) * k;
  out[1] = a[1] + (b[1] - a[1]) * k;
  out[2] = a[2] + (b[2] - a[2]) * k;
}

function lin(p: RGB[], t: number, out: number[]) {
  const f = Math.max(0, Math.min(0.9999, t)) * (p.length - 1);
  const i = Math.floor(f);
  const k = f - i;
  const a = p[i];
  const b = p[i + 1];
  out[0] = a[0] + (b[0] - a[0]) * k;
  out[1] = a[1] + (b[1] - a[1]) * k;
  out[2] = a[2] + (b[2] - a[2]) * k;
}

interface Tile {
  w: number;
  h: number;
  fx: number;
  fy: number;
  freq: number;
  light: number;
  phase: number;
  flash: number;
  fiberK: number;
  fiberS: number;
  ox: number;
  oy: number;
}

function render(r: Recipe) {
  const rnd = mulberry32(r.seed);
  const range = ([a, b]: [number, number]) => a + rnd() * (b - a);

  const heights: number[] = [];
  let sum = 0;
  while (sum < SIZE) {
    const h = range(r.rowH);
    heights.push(h);
    sum += h;
  }
  const rowOf = new Int16Array(SIZE);
  const rowY0: number[] = [];
  const tileOf: Int16Array[] = [];
  const localX: Float32Array[] = [];
  const tiles: Tile[] = [];
  let y0 = 0;
  heights.forEach((h0, row) => {
    const h = (h0 * SIZE) / sum;
    rowY0.push(y0);
    for (let y = Math.round(y0); y < Math.min(SIZE, Math.round(y0 + h)); y++) rowOf[y] = row;

    const widths: number[] = [];
    let ws = 0;
    while (ws < SIZE) {
      const w = range(r.tileW);
      widths.push(w);
      ws += w;
    }
    const off = rnd() * SIZE;
    const ids = new Int16Array(SIZE);
    const lx = new Float32Array(SIZE);
    const starts: number[] = [];
    let acc = 0;
    for (const w0 of widths) {
      const w = (w0 * SIZE) / ws;
      starts.push(acc);
      tiles.push({
        w,
        h,
        fx: w * (0.15 + rnd() * 0.7),
        fy: rnd() < 0.75 ? h * (0.95 + rnd() * 0.45) : -h * (rnd() * 0.45),
        freq: (Math.PI * 2) / (3 + rnd() * 3.5),
        light: (rnd() * 2 - 1) * r.tileLight,
        phase: rnd(),
        flash: rnd(),
        fiberK: 18 + rnd() * 30,
        fiberS: Math.floor(rnd() * 1000),
        ox: rnd(),
        oy: rnd(),
      });
      acc += w;
    }
    const first = tiles.length - widths.length;
    for (let x = 0; x < SIZE; x++) {
      const xx = mod(x - off, SIZE);
      let k = starts.length - 1;
      while (k > 0 && starts[k] > xx) k--;
      ids[x] = first + k;
      lx[x] = xx - starts[k];
    }
    tileOf.push(ids);
    localX.push(lx);
    y0 += h;
  });

  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(SIZE, SIZE);
  const data = img.data;
  const s = r.seed * 101;
  const base = [0, 0, 0];
  const fl = [0, 0, 0];
  const fan = r.kind === "fan";

  for (let y = 0; y < SIZE; y++) {
    const row = rowOf[y];
    const ly = y - rowY0[row] + 0.5;
    const v = y / SIZE;
    const ids = tileOf[row];
    const lxs = localX[row];
    for (let x = 0; x < SIZE; x++) {
      const t = tiles[ids[x]];
      const lx = lxs[x] + 0.5;
      const u = x / SIZE;
      const edge = Math.min(lx, t.w - lx, ly, t.h - ly);
      const hc = cell(x, y, 40, s + 50);
      const hm = cell(x, y, 96, s + 60);
      const n1 = stretch(fbm(u, v, 8, 8, s + 1, 3));
      const n2 = stretch(fbm(u, v, 3, 3, s + 5, 3));
      let R: number;
      let G: number;
      let B: number;
      let glint: number;

      if (fan) {
        const dx = lx - t.fx;
        const dy = ly - t.fy;
        const rr = Math.sqrt(dx * dx + dy * dy);
        const ang = Math.atan2(dy, dx);
        const ph = (rr + (n1 - 0.5) * 14 + (hm - 0.5) * 1.2) * t.freq;
        const cs = 0.5 + 0.5 * Math.cos(ph);
        const c4 = cs * cs * cs * cs;
        const line = c4 * c4 * c4 * smooth(0.25, 0.8, n2 * 0.6 + (1 - n1) * 0.4);
        const band = 0.5 + 0.5 * Math.cos(ph * 0.09 + n2 * 5 + t.phase * 6.28);
        const fib = vnoise(ang * t.fiberK, t.fiberS, 1 << 20, 1 << 20, s + 9);
        const fade = Math.min(1, rr / (t.h * 1.5));
        const L =
          1 +
          t.light +
          (band - 0.5) * 0.07 +
          (fib - 0.5) * 0.24 * fade +
          line * r.ring +
          (hm - 0.5) * 0.08 +
          Math.max(0, 1 - rr / (t.h * 1.6)) * 0.14;
        cyc(r.flash, t.phase + rr * 0.008 + n1 * 0.9 + (hc - 0.5) * 0.35, fl);
        lin(r.body, n2 * 0.85 + band * 0.15, base);
        const patch = smooth(
          0.3,
          0.62,
          n2 * 0.5 + n1 * 0.5 + (t.flash - 0.5) * 0.4 + (band - 0.5) * 0.2 + (hc - 0.5) * 0.18,
        );
        const a = (r.flashBase + (1 - r.flashBase) * patch) * r.flashAmt;
        R = (base[0] + (fl[0] - base[0]) * a) * L;
        G = (base[1] + (fl[1] - base[1]) * a) * L;
        B = (base[2] + (fl[2] - base[2]) * a) * L;
        glint = line * smooth(0.55, 0.85, n1) * (0.35 + patch * 0.65);
      } else {
        const uu = u + t.ox;
        const vv = v + t.oy;
        const qx = fbm(uu, vv, 3, 5, s + 20, 3);
        const qy = fbm(uu, vv, 3, 5, s + 30, 3);
        const fv = fbm(uu + (qx - 0.5) * 0.7, vv + (qy - 0.5) * 0.7, 2, 3, s + 40, 3);
        const val = fv * 26 + t.phase * 4;
        const band = Math.floor(val);
        const fr = val - band;
        const lineM = Math.max(0, 1 - fr / 0.06, (fr - 0.95) / 0.05) * smooth(0.2, 0.6, n1);
        const ridge = Math.sin(fr * Math.PI);
        cyc(r.flash, fv * 3.2 + hash(band & 1023, 7, s) * 0.22 + (hc - 0.5) * 0.2, fl);
        lin(r.body, n2, base);
        const a = r.flashAmt * (0.6 + 0.4 * ridge);
        const L = 0.8 + 0.24 * ridge + t.light + (hm - 0.5) * 0.08 + (n1 - 0.5) * 0.16;
        R = (base[0] + (fl[0] - base[0]) * a) * L;
        G = (base[1] + (fl[1] - base[1]) * a) * L;
        B = (base[2] + (fl[2] - base[2]) * a) * L;
        const m = lineM * 0.8;
        R += (r.matrix[0] - R) * m;
        G += (r.matrix[1] - G) * m;
        B += (r.matrix[2] - B) * m;
        glint = smooth(0.78, 1, ridge * n1 * 1.25) * 0.45;
      }

      let mul = 1;
      if (edge < 1.2) mul = 1 - r.seam;
      else if (edge < 2.4) mul = 1 + r.seam * 0.3;
      const gl = glint * 80;
      const grain = (hash(x, y, s + 99) - 0.5) * 8;
      R = R * mul + gl + grain;
      G = G * mul + gl + grain;
      B = B * mul + gl + grain;
      const gray = R * 0.3 + G * 0.59 + B * 0.11;
      const i = (y * SIZE + x) * 4;
      data[i] = gray + (R - gray) * r.sat;
      data[i + 1] = gray + (G - gray) * r.sat;
      data[i + 2] = gray + (B - gray) * r.sat;
      data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/jpeg", 0.86);
}

function dataUrlToBlob(dataUrl: string) {
  const comma = dataUrl.indexOf(",");
  const type = dataUrl.slice(5, dataUrl.indexOf(";"));
  const bin = atob(dataUrl.slice(comma + 1));
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type });
}

const urls = new Map<PearlId, string>();
const dataUrls = new Map<string, string>();
const pending = new Set<PearlId>();
const listeners = new Set<() => void>();
let queue: Promise<void> = Promise.resolve();

function dropStale() {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith("nacre-v") && !k.startsWith(`nacre-v${VERSION}-`)) localStorage.removeItem(k);
    }
  } catch {}
}

async function load(pearl: PearlId) {
  const key = `nacre-v${VERSION}-${pearl}`;
  let data: string | null = null;
  try {
    data = localStorage.getItem(key);
  } catch {}
  if (!data) dropStale();
  if (!data) {
    // 첫 화면이 먼저 그려지도록 한 프레임 양보합니다
    await new Promise((r) => setTimeout(r, 30));
    data = render(RECIPES[pearl]);
    try {
      localStorage.setItem(key, data);
    } catch {}
  }
  const url = URL.createObjectURL(dataUrlToBlob(data));
  urls.set(pearl, url);
  dataUrls.set(url, data);
  pending.delete(pearl);
  listeners.forEach((l) => l());
}

function requestNacre(pearl: PearlId) {
  if (urls.has(pearl) || pending.has(pearl)) return;
  pending.add(pearl);
  queue = queue
    .then(() => load(pearl))
    .catch(() => {
      pending.delete(pearl);
    });
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** 자개 텍스처 이미지 URL (준비 전에는 null) */
export function useNacreTexture(pearl: PearlId) {
  useEffect(() => {
    requestNacre(pearl);
  }, [pearl]);
  return useSyncExternalStore(
    subscribe,
    () => urls.get(pearl) ?? null,
    () => null,
  );
}

/** SVG를 이미지로 내보낼 때 blob 텍스처를 data URL로 바꿔 넣습니다 */
export function inlineNacreImages(root: Element) {
  root.querySelectorAll("image").forEach((el) => {
    const href = el.getAttribute("href");
    const data = href ? dataUrls.get(href) : undefined;
    if (data) el.setAttribute("href", data);
  });
}
