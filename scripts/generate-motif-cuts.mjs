/**
 * 문양 절단선 생성.
 * PNG는 알파 등고선, SVG는 칠해진 면·획(선 두께 포함)을 래스터화한 뒤 같은 방식으로 외곽을 딴다.
 * 내부 선각(detail/holes)은 래스터에 넣지 않는다. 완전히 닫힌 구멍은 면 문양에서 버린다.
 * 실행: node scripts/generate-motif-cuts.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ISO = 128;
const PX_PER_UNIT = 14;
const VIEW = { x: -84, y: -84, w: 168, h: 168 };
/** 모티프 좌표에서 이보다 덜 벗어나면 점을 버린다. 화면에서 1px 안쪽. */
const EPS = 0.11;
const MIN_AREA = 0.28;

function loadMotifs() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "motif-cuts-"));
  const files = ["motifArt.ts", "motifStamps.ts", "motifCuts.ts", "motifs.ts"];
  for (const name of files) {
    const src = fs.readFileSync(path.join(root, "src/lib", name), "utf8");
    const out = ts.transpileModule(src, {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      fileName: name,
    });
    const js = out.outputText.replace(/require\("(\.\/[^"]+)"\)/g, 'require("$1.js")');
    fs.writeFileSync(path.join(dir, name.replace(/\.ts$/, ".js")), js);
  }
  const req = createRequire(path.join(dir, "motifs.js"));
  return req("./motifs.js").MOTIFS;
}

function lerp(va, vb, iso) {
  const d = vb - va;
  if (Math.abs(d) < 1e-8) return 0.5;
  return (iso - va) / d;
}

/** 모서리: 0 위, 1 오른쪽, 2 아래, 3 왼쪽. 비트: 1 TL, 2 TR, 4 BR, 8 BL. */
function cellSegments(c, cx, cy, tl, tr, br, bl, centerSolid) {
  const top = [cx + lerp(tl, tr, ISO), cy];
  const right = [cx + 1, cy + lerp(tr, br, ISO)];
  const bottom = [cx + lerp(bl, br, ISO), cy + 1];
  const left = [cx, cy + lerp(tl, bl, ISO)];
  const e = [top, right, bottom, left];
  const seg = (a, b) => [e[a], e[b]];
  switch (c) {
    case 1: return [seg(3, 0)];
    case 2: return [seg(0, 1)];
    case 3: return [seg(3, 1)];
    case 4: return [seg(1, 2)];
    case 5: return centerSolid ? [seg(3, 0), seg(1, 2)] : [seg(0, 1), seg(3, 2)];
    case 6: return [seg(0, 2)];
    case 7: return [seg(3, 2)];
    case 8: return [seg(2, 3)];
    case 9: return [seg(2, 0)];
    case 10: return centerSolid ? [seg(0, 1), seg(2, 3)] : [seg(3, 0), seg(1, 2)];
    case 11: return [seg(2, 1)];
    case 12: return [seg(1, 3)];
    case 13: return [seg(1, 0)];
    case 14: return [seg(0, 3)];
    default: return [];
  }
}

function keyOf(p) {
  return `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
}

function stitch(segments) {
  const unused = new Map();
  segments.forEach((seg, i) => {
    for (const p of seg) {
      const k = keyOf(p);
      if (!unused.has(k)) unused.set(k, []);
      unused.get(k).push(i);
    }
  });
  const used = new Uint8Array(segments.length);
  const loops = [];
  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    const loop = [segments[i][0], segments[i][1]];
    used[i] = 1;
    let guard = 0;
    while (guard++ < segments.length + 2) {
      const end = loop[loop.length - 1];
      if (keyOf(end) === keyOf(loop[0]) && loop.length > 2) break;
      const cands = unused.get(keyOf(end)) || [];
      let next = -1;
      for (const si of cands) {
        if (!used[si]) {
          next = si;
          break;
        }
      }
      if (next < 0) break;
      used[next] = 1;
      const [a, b] = segments[next];
      loop.push(keyOf(a) === keyOf(end) ? b : a);
    }
    if (loop.length > 3 && keyOf(loop[0]) === keyOf(loop[loop.length - 1])) {
      loop.pop();
      loops.push(loop.map(([x, y]) => ({ x, y })));
    }
  }
  return loops;
}

function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

function rdp(pts, eps) {
  if (pts.length < 3) return pts;
  const closed = pts[0];
  const open = pts[pts.length - 1].x === closed.x && pts[pts.length - 1].y === closed.y ? pts.slice(0, -1) : pts;
  if (open.length < 3) return open;
  const keep = new Uint8Array(open.length);
  keep[0] = 1;
  keep[open.length - 1] = 1;
  const stack = [[0, open.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0;
    let idx = -1;
    const ax = open[a].x;
    const ay = open[a].y;
    const bx = open[b].x;
    const by = open[b].y;
    const dx = bx - ax;
    const dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * open[i].x - dx * open[i].y + bx * ay - by * ax) / len;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > eps) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return open.filter((_, i) => keep[i]);
}

/**
 * alpha: Uint8Array row-major.
 * mapPoint(px, py)는 픽셀 중심 격자 좌표(원본 이미지의 열·행)를 모티프 좌표로 보낸다.
 * keepHoles: 획으로만 된 리본의 안쪽 경계도 남긴다.
 */
function traceAlpha(alpha, width, height, mapPoint, keepHoles) {
  const W = width + 2;
  const H = height + 2;
  const grid = new Float32Array(W * H);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) grid[(y + 1) * W + (x + 1)] = alpha[y * width + x];
  }
  const segments = [];
  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const tl = grid[y * W + x];
      const tr = grid[y * W + x + 1];
      const br = grid[(y + 1) * W + x + 1];
      const bl = grid[(y + 1) * W + x];
      let c = 0;
      if (tl >= ISO) c |= 1;
      if (tr >= ISO) c |= 2;
      if (br >= ISO) c |= 4;
      if (bl >= ISO) c |= 8;
      if (c === 0 || c === 15) continue;
      const center = (tl + tr + br + bl) / 4 >= ISO;
      for (const [p, q] of cellSegments(c, x, y, tl, tr, br, bl, center)) segments.push([p, q]);
    }
  }
  const loops = stitch(segments);
  const mapped = loops.map((loop) => {
    const pts = loop.map((p) => {
      const m = mapPoint(p.x - 1, p.y - 1);
      return { x: m.x, y: m.y };
    });
    return { pts, area: signedArea(pts) };
  });
  if (!mapped.length) return [];
  const outerSign = mapped.reduce((s, l) => s + l.area, 0) >= 0 ? 1 : -1;
  return mapped
    .filter((l) => keepHoles || Math.sign(l.area) === outerSign || l.area === 0)
    .map((l) => {
      const simplified = rdp(l.pts, EPS);
      const area = Math.abs(signedArea(simplified));
      return { pts: simplified, area };
    })
    .filter((l) => l.pts.length >= 3 && l.area >= MIN_AREA)
    .sort((a, b) => a.pts.reduce((m, p) => Math.min(m, p.y), 1e9) - b.pts.reduce((m, p) => Math.min(m, p.y), 1e9)
      || a.pts.reduce((m, p) => Math.min(m, p.x), 1e9) - b.pts.reduce((m, p) => Math.min(m, p.x), 1e9));
}

function pathOf(pts) {
  const f = (n) => (Math.round(n * 100) / 100).toFixed(2);
  return `M${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join(" L")} Z`;
}

function mapRaster(gx, gy, originX, originY, imgW, imgH, boxW, boxH) {
  return {
    x: originX + ((gx + 0.5) / imgW) * boxW,
    y: originY + ((gy + 0.5) / imgH) * boxH,
  };
}

async function pngAlpha(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * info.channels + info.channels - 1];
  return { alpha, width: info.width, height: info.height };
}

function motifSvg(motif) {
  const parts = [];
  if (motif.path) parts.push(`<path d="${motif.path}" fill="#fff"/>`);
  for (const st of motif.strokes || []) {
    parts.push(
      `<path d="${st.d}" fill="none" stroke="#fff" stroke-width="${st.w}" stroke-linecap="round" stroke-linejoin="round"/>`,
    );
  }
  const size = Math.round(VIEW.w * PX_PER_UNIT);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}">${parts.join("")}</svg>`;
  return { svg, size };
}

function cutFit(motif) {
  const target = 200;
  if (motif.stamp) {
    const { x, y, w, h } = motif.stamp;
    return { ox: x + w / 2, oy: y + h / 2, scale: Math.min(target / Math.max(w, 1), target / Math.max(h, 1)) };
  }
  if (motif.kind === "pattern") return { ox: 0, oy: 0, scale: 6.2 };
  if (motif.strokes?.length && !motif.path) return { ox: 0, oy: 0, scale: 3.6 };
  return { ox: 0, oy: 0, scale: 4.5 };
}

function subpaths(d) {
  return d
    .split(/(?=M)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
}

/** 미리보기 점·정렬용. 저장된 절단선은 원래 곡선 그대로 둔다. */
function flattenPath(d) {
  const tokens = d.match(/[MLCQAHVZmlcqahvz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) || [];
  let i = 0;
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const pts = [];
  const num = () => Number(tokens[i++]);
  const add = (x, y) => {
    cx = x;
    cy = y;
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(last.x - x, last.y - y) > 0.04) pts.push({ x, y });
  };
  const cubic = (x1, y1, x2, y2, x, y) => {
    const x0 = cx;
    const y0 = cy;
    for (let t = 1; t <= 8; t++) {
      const u = t / 8;
      const k = 1 - u;
      add(
        k * k * k * x0 + 3 * k * k * u * x1 + 3 * k * u * u * x2 + u * u * u * x,
        k * k * k * y0 + 3 * k * k * u * y1 + 3 * k * u * u * y2 + u * u * u * y,
      );
    }
  };
  const arc = (rx, ry, rot, large, sweep, x, y) => {
    const x0 = cx;
    const y0 = cy;
    if (Math.hypot(x - x0, y - y0) < 1e-6) {
      add(x, y);
      return;
    }
    const phi = (rot * Math.PI) / 180;
    const cos = Math.cos(phi);
    const sin = Math.sin(phi);
    const dx = (x0 - x) / 2;
    const dy = (y0 - y) / 2;
    const x1 = cos * dx + sin * dy;
    const y1 = -sin * dx + cos * dy;
    let rx2 = Math.abs(rx);
    let ry2 = Math.abs(ry);
    const lam = (x1 * x1) / (rx2 * rx2) + (y1 * y1) / (ry2 * ry2);
    if (lam > 1) {
      const s = Math.sqrt(lam);
      rx2 *= s;
      ry2 *= s;
    }
    const sign = large !== sweep ? 1 : -1;
    const sq = Math.max(0, (rx2 * rx2 * ry2 * ry2 - rx2 * rx2 * y1 * y1 - ry2 * ry2 * x1 * x1) / (rx2 * rx2 * y1 * y1 + ry2 * ry2 * x1 * x1));
    const coef = sign * Math.sqrt(sq);
    const cx1 = (coef * rx2 * y1) / ry2;
    const cy1 = (-coef * ry2 * x1) / rx2;
    const ccx = cos * cx1 - sin * cy1 + (x0 + x) / 2;
    const ccy = sin * cx1 + cos * cy1 + (y0 + y) / 2;
    const ang = (ux, uy) => Math.atan2(uy, ux);
    const a0 = ang((x1 - cx1) / rx2, (y1 - cy1) / ry2);
    let da = ang((-x1 - cx1) / rx2, (-y1 - cy1) / ry2) - a0;
    if (!sweep && da > 0) da -= Math.PI * 2;
    if (sweep && da < 0) da += Math.PI * 2;
    const n = Math.max(8, Math.ceil(Math.abs(da) / (Math.PI / 10)));
    for (let k = 1; k <= n; k++) {
      const a = a0 + (da * k) / n;
      const px = rx2 * Math.cos(a);
      const py = ry2 * Math.sin(a);
      add(cos * px - sin * py + ccx, sin * px + cos * py + ccy);
    }
  };
  while (i < tokens.length) {
    const cmd = tokens[i++];
    const abs = cmd === cmd.toUpperCase();
    const op = cmd.toUpperCase();
    if (op === "Z") {
      add(sx, sy);
      cx = sx;
      cy = sy;
      continue;
    }
    if (op === "H") {
      const x = abs ? num() : cx + num();
      add(x, cy);
      continue;
    }
    if (op === "V") {
      const y = abs ? num() : cy + num();
      add(cx, y);
      continue;
    }
    if (op === "M" || op === "L") {
      const x = abs ? num() : cx + num();
      const y = abs ? num() : cy + num();
      add(x, y);
      if (op === "M") {
        sx = x;
        sy = y;
      }
      continue;
    }
    if (op === "C") {
      const x1 = abs ? num() : cx + num();
      const y1 = abs ? num() : cy + num();
      const x2 = abs ? num() : cx + num();
      const y2 = abs ? num() : cy + num();
      const x = abs ? num() : cx + num();
      const y = abs ? num() : cy + num();
      cubic(x1, y1, x2, y2, x, y);
      continue;
    }
    if (op === "Q") {
      const x1 = abs ? num() : cx + num();
      const y1 = abs ? num() : cy + num();
      const x = abs ? num() : cx + num();
      const y = abs ? num() : cy + num();
      cubic(cx + (2 / 3) * (x1 - cx), cy + (2 / 3) * (y1 - cy), x + (2 / 3) * (x1 - x), y + (2 / 3) * (y1 - y), x, y);
      continue;
    }
    if (op === "A") {
      const rx = num();
      const ry = num();
      const rot = num();
      const large = num();
      const sweep = num();
      const x = abs ? num() : cx + num();
      const y = abs ? num() : cy + num();
      arc(rx, ry, rot, large, sweep, x, y);
      continue;
    }
  }
  return pts;
}

async function rasterContours(svg, size, keepHoles) {
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = new Uint8Array(info.width * info.height);
  for (let i = 0; i < alpha.length; i++) alpha[i] = data[i * info.channels + info.channels - 1];
  return traceAlpha(
    alpha,
    info.width,
    info.height,
    (gx, gy) => mapRaster(gx, gy, VIEW.x, VIEW.y, size, size, VIEW.w, VIEW.h),
    keepHoles,
  );
}

async function contoursOf(motif) {
  if (motif.stamp) {
    const file = path.join(root, "public", motif.stamp.src);
    const { alpha, width, height } = await pngAlpha(file);
    const { x, y, w, h } = motif.stamp;
    return traceAlpha(alpha, width, height, (gx, gy) => mapRaster(gx, gy, x, y, width, height, w, h), false);
  }
  const loops = [];
  if (motif.path) {
    for (const d of subpaths(motif.path)) {
      const pts = flattenPath(d);
      if (pts.length >= 3) loops.push({ pts, area: Math.abs(signedArea(pts)), d });
    }
  }
  const size = Math.round(VIEW.w * PX_PER_UNIT);
  for (const st of motif.strokes || []) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}"><path d="${st.d}" fill="none" stroke="#fff" stroke-width="${st.w}" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
      loops.push(...(await rasterContours(svg, size, true)));
  }
  return loops.sort((a, b) => {
    const top = (loop) => loop.pts.reduce((m, p) => Math.min(m, p.y), 1e9);
    const left = (loop) => loop.pts.reduce((m, p) => Math.min(m, p.x), 1e9);
    return top(a) - top(b) || left(a) - left(b);
  });
}

function selfTest() {
  const w = 48;
  const h = 48;
  const alpha = new Uint8Array(w * h);
  const dot = (x, y, r, v) => {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if ((i - x) ** 2 + (j - y) ** 2 <= r * r) alpha[j * w + i] = v;
      }
    }
  };
  dot(24, 24, 14, 255);
  dot(24, 24, 6, 0);
  const loops = traceAlpha(alpha, w, h, (gx, gy) => ({ x: gx, y: gy }), false);
  const all = traceAlpha(alpha, w, h, (gx, gy) => ({ x: gx, y: gy }), true);
  if (loops.length !== 1) throw new Error(`바깥 윤곽 테스트 실패: ${loops.length}`);
  if (all.length !== 2) throw new Error(`구멍 포함 테스트 실패: ${all.length}`);
  const area = Math.abs(signedArea(loops[0].pts));
  if (area < 400 || area > 800) throw new Error(`원 면적 이상: ${area.toFixed(1)}`);
}

async function preview(motif, cuts, fit) {
  const screen = (p) => ({ x: 150 + (p.x - fit.ox) * fit.scale, y: 150 + (p.y - fit.oy) * fit.scale });
  let shape = "";
  if (motif.stamp) {
    const b64 = fs.readFileSync(path.join(root, "public", motif.stamp.src)).toString("base64");
    const s = motif.stamp;
    shape = `<image href="data:image/png;base64,${b64}" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" preserveAspectRatio="xMidYMid meet"/>`;
  } else {
    if (motif.path) shape += `<path d="${motif.path}" fill="#f4f1ea"/>`;
    for (const st of motif.strokes || []) {
      shape += `<path d="${st.d}" fill="none" stroke="#f4f1ea" stroke-width="${st.w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  }
  const guides = cuts
    .map((c, i) => {
      const start = screen(c.pts[0]);
      const end = screen(c.pts[Math.max(0, c.pts.length - 2)]);
      return `<path d="${c.d}" fill="none" stroke="#ff4fd8" stroke-width="${1.15 / fit.scale}" stroke-dasharray="${4 / fit.scale} ${2.6 / fit.scale}"/>
        <circle cx="${c.pts[0].x}" cy="${c.pts[0].y}" r="${5 / fit.scale}" fill="#3ddc7a"/>
        <circle cx="${c.pts[Math.max(0, c.pts.length - 2)].x}" cy="${c.pts[Math.max(0, c.pts.length - 2)].y}" r="${4 / fit.scale}" fill="#ffb15a"/>
        <text x="${start.x + 7}" y="${start.y - 6}" fill="#ffe27a" font-size="11" font-family="sans-serif">${i + 1} ${c.id}</text>`;
    })
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 300 300">
    <rect width="300" height="300" fill="#1c1416"/>
    <g transform="translate(150 150) scale(${fit.scale}) translate(${-fit.ox} ${-fit.oy})">${shape}${guides.replace(/<text[\s\S]*?<\/text>/g, "")}</g>
    ${guides.match(/<text[\s\S]*?<\/text>/g)?.join("") ?? ""}
  </svg>`;
  const out = path.join("/tmp/cutguides", `${motif.id}.png`);
  await sharp(Buffer.from(svg)).png().toFile(out);
}

function emit(all) {
  const body = Object.entries(all)
    .map(([id, cuts]) => {
      const rows = cuts
        .map((c) => `    { id: "${c.id}", d: ${JSON.stringify(c.d)} },`)
        .join("\n");
      return `  ${id}: [\n${rows}\n  ],`;
    })
    .join("\n");
  const text = `/** 생성된 절단선. scripts/generate-motif-cuts.mjs 가 만든다. 직접 고치지 말 것. */
export type MotifCut = { id: string; d: string };

export const MOTIF_CUTS: Record<string, MotifCut[]> = {
${body}
};
`;
  fs.writeFileSync(path.join(root, "src/lib/motifCuts.ts"), text);
}

async function main() {
  selfTest();
  const motifs = loadMotifs();
  fs.mkdirSync("/tmp/cutguides", { recursive: true });
  const all = {};
  const report = [];
  for (const motif of Object.values(motifs)) {
    const raw = await contoursOf(motif);
    const cuts = raw.map((loop, i) => ({
      id: `${motif.id}-${i + 1}`,
      d: loop.d || pathOf(loop.pts),
      pts: loop.pts,
      area: loop.area,
      n: loop.pts.length,
    }));
    if (!cuts.length) throw new Error(`${motif.id}: 절단선이 없습니다`);
    all[motif.id] = cuts.map(({ id, d }) => ({ id, d }));
    const fit = cutFit(motif);
    await preview(motif, cuts, fit);
    const pts = cuts.reduce((n, c) => n + c.n, 0);
    report.push(`${motif.id.padEnd(12)} ${String(cuts.length).padStart(3)} paths  ${String(pts).padStart(5)} pts  ${cuts.map((c) => c.n).join(",")}`);
  }
  emit(all);
  console.log(report.join("\n"));
  console.log("wrote src/lib/motifCuts.ts");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
