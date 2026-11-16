"use client";

import { useEffect, useRef, useState } from "react";
import { SHAPES, type ShapeId } from "@/lib/data";
import { loopLevel, startLoop, stopLoop } from "@/lib/sound";
import { ToolCursor, WorkPoint, type ToolId } from "@/components/Tools";
import { claimCraftPointer, isForeignCraftPointer, releaseCraftPointer, toolLift, useBlockCraftScroll } from "./craftTouch";

export interface PaintStats {
  /** 조금이라도 작업된 칸 비율 */
  touched: number;
  /** 닿았지만 아직 연한(목표 범위 미달) 칸 비율 */
  thin: number;
  /** 목표 범위 안에 든 칸 비율 */
  inRange: number;
  /** 과하게 작업된 칸 비율 */
  over: number;
  /** 평균값 */
  mean: number;
}

export interface PaintConfig {
  brushRadius: number;
  /** 한 번 쓸고 지나갈 때 중심부에 쌓이는 양(대략) */
  passAmount: number;
  range: [number, number];
  over: number;
  /** 이 값에서 시각적으로 약 90% 덮이도록 맞춤 */
  opaqueAt: number;
  /** stamp: 누르고 있는 동안 도구 면적 전체가 시간에 따라 쌓인다 */
  mode: "paint" | "erase" | "pattern" | "stamp";
  color: string;
  initialFill?: string;
  overColor: string;
  overStyle: "drip" | "spot" | "haze" | "none";
  sound: "brush" | "sand" | "iron";
  tool: ToolId;
  /** 붓이 머금은 옻. 한 번 찍을 때마다 이 비율로 줄어든다 */
  inkDecay?: number;
  /** stamp: 초당 중심부에 쌓이는 양 */
  stampRate?: number;
  /** stamp: 덜 붙음 · 잘 붙음 · 탐 */
  stampLabels?: [string, string, string];
  /** 도구 끝(작업점)을 손가락 위로 띄워 손에 가리지 않게 한다 */
  lift?: boolean;
}

/** 0 = 덜 됨, 1 = 알맞음, 2 = 지나침 */
function stageOf(v: number, cfg: PaintConfig) {
  return v > cfg.over ? 2 : v >= cfg.range[0] ? 1 : 0;
}

const N = 50;
const CELL = 300 / N;
const RES = 2;
/** stamp를 누른 채 이만큼(작품 좌표) 넘게 움직이면 미끄러진 것으로 본다 */
const SLIDE_MIN = 0.8;
/** 미끄러진 거리 중 자개가 따라 밀리는 비율 */
const SLIDE_PUSH = 0.6;
/** 작업하지 않는 칸은 종이를 더 두껍게 덮어 둔다 */
const OFF_REGION: [number, number, number, number] = [236, 226, 206, 0.86];

/** 삼베 대신 한지·유산지처럼 보이는 종이 질감 */
function makeHempPattern(ctx: CanvasRenderingContext2D) {
  const S = 64;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  // 바탕: 따뜻한 한지색
  g.fillStyle = "#f3ead8";
  g.fillRect(0, 0, S, S);
  // 섬유 얼룩
  for (let i = 0; i < 420; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    const a = 0.04 + Math.random() * 0.1;
    g.fillStyle =
      Math.random() < 0.55
        ? `rgba(210, 190, 155, ${a})`
        : `rgba(255, 250, 240, ${a})`;
    g.fillRect(x, y, 0.8 + Math.random() * 2.2, 0.5 + Math.random() * 1.4);
  }
  // 은은한 결
  g.strokeStyle = "rgba(170, 145, 110, 0.12)";
  g.lineWidth = 0.6;
  for (let i = 0; i < 10; i++) {
    g.beginPath();
    g.moveTo(0, (i * S) / 9 + Math.random() * 2);
    g.bezierCurveTo(S * 0.35, i * 6 + 4, S * 0.65, i * 5 + 2, S, (i * S) / 9 + Math.random() * 3);
    g.stroke();
  }
  // 살짝 구겨진 주름
  g.strokeStyle = "rgba(140, 115, 85, 0.08)";
  g.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.moveTo(Math.random() * S, Math.random() * S);
    g.quadraticCurveTo(Math.random() * S, Math.random() * S, Math.random() * S, Math.random() * S);
    g.stroke();
  }
  return ctx.createPattern(c, "repeat")!;
}

export default function PaintCanvas({
  shape,
  config,
  background,
  foreground,
  onStats,
  disabled,
  inkRef,
  ink = 1,
  onInk,
  region,
  regionMargin = 0,
  onSlide,
  forceDebug = false,
}: {
  shape: ShapeId;
  config: PaintConfig;
  background: React.ReactNode;
  foreground?: React.ReactNode;
  onStats: (s: PaintStats) => void;
  disabled?: boolean;
  /** 붓이 머금은 옻 (0~1). config.inkDecay가 있을 때만 쓴다 */
  inkRef?: React.RefObject<number>;
  ink?: number;
  onInk?: (ink: number) => void;
  /** 이 경로(와 regionMargin 둘레) 안만 작업 칸으로 센다 */
  region?: Path2D | null;
  regionMargin?: number;
  /** stamp: 누른 채 미끄러질 때. at은 미끄러지기 전 작업점 */
  onSlide?: (at: { x: number; y: number }, dx: number, dy: number) => void;
  /** 개발용 포인터 기록. 프로덕션 빌드에서는 보이지 않는다. */
  forceDebug?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLCanvasElement>(null);
  const qualityRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef<HTMLCanvasElement>(null);
  const grid = useRef(new Float32Array(N * N));
  const mask = useRef(new Uint8Array(N * N));
  const flagged = useRef(new Uint8Array(N * N));
  const masked = useRef(0);
  const qualityBuf = useRef<HTMLCanvasElement | null>(null);
  const dripBuf = useRef<HTMLCanvasElement | null>(null);
  const last = useRef<{ x: number; y: number } | null>(null);
  const pattern = useRef<CanvasPattern | null>(null);
  const raf = useRef(0);
  const dripFrame = useRef(0);
  const velocity = useRef(0);
  const gesture = useRef<number | null>(null);
  const recapture = useRef(0);
  const [cursor, setCursor] = useState<{ x: number; y: number; lift?: number } | null>(null);
  const slideCb = useRef(onSlide);
  const [debug, setDebug] = useState(forceDebug);
  const debugRef = useRef(forceDebug);
  const lastMoveLog = useRef(0);
  const [trace, setTrace] = useState<{ t: string; id: number; note: string }[]>([]);
  const cfgRef = useRef(config);
  const statsRef = useRef(onStats);
  const inkCb = useRef(onInk);
  const strokeDir = useRef(0);
  const hold = useRef<{ x: number; y: number; t: number } | null>(null);
  const holdFrame = useRef(0);
  const smokeAt = useRef(0);
  const smokeId = useRef(0);
  const stampBuf = useRef<HTMLCanvasElement | null>(null);
  const [pressed, setPressed] = useState<{ x: number; y: number; stage: number } | null>(null);
  const [smoke, setSmoke] = useState<{ id: number; x: number; y: number }[]>([]);

  useEffect(() => {
    cfgRef.current = config;
    statsRef.current = onStats;
    inkCb.current = onInk;
    slideCb.current = onSlide;
    debugRef.current = debug;
  });

  useEffect(() => {
    if (forceDebug || process.env.NODE_ENV !== "development") return;
    const query = new URLSearchParams(window.location.search);
    if (query.get("paintdebug") === "1") setDebug(true);
  }, [forceDebug]);

  useBlockCraftScroll(wrapRef, () => {
    if (!debugRef.current) return;
    setTrace((rows) => [...rows.slice(-14), { t: "touchmove", id: -1, note: "취소 불가. 브라우저가 스크롤로 가져감" }]);
  });

  useEffect(() => {
    const layer = layerRef.current!;
    const quality = qualityRef.current!;
    const over = overRef.current!;
    const path = new Path2D(SHAPES[shape].path);
    for (const cv of [layer, quality, over]) {
      cv.width = 300 * RES;
      cv.height = 300 * RES;
      const ctx = cv.getContext("2d")!;
      ctx.setTransform(RES, 0, 0, RES, 0, 0);
      ctx.clip(path);
    }
    grid.current.fill(0);
    flagged.current.fill(0);
    qualityBuf.current = null;
    dripBuf.current = null;
    const ctx = layer.getContext("2d")!;
    pattern.current = makeHempPattern(ctx);
    if (cfgRef.current.initialFill) {
      ctx.fillStyle = cfgRef.current.initialFill;
      ctx.fillRect(0, 0, 300, 300);
    }
    startLoop(cfgRef.current.sound);
    loopLevel(0);
    return () => {
      stopLoop();
      cancelAnimationFrame(raf.current);
      cancelAnimationFrame(dripFrame.current);
      cancelAnimationFrame(holdFrame.current);
      raf.current = 0;
      dripFrame.current = 0;
      hold.current = null;
    };
  }, [shape]);

  useEffect(() => {
    const path = new Path2D(SHAPES[shape].path);
    const probe = document.createElement("canvas").getContext("2d")!;
    probe.lineWidth = regionMargin * 2;
    probe.lineJoin = "round";
    let count = 0;
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const x = (i + 0.5) * CELL;
        const y = (j + 0.5) * CELL;
        const inside =
          probe.isPointInPath(path, x, y) &&
          (!region || probe.isPointInPath(region, x, y) || (regionMargin > 0 && probe.isPointInStroke(region, x, y)));
        mask.current[j * N + i] = inside ? 1 : 0;
        if (inside) count++;
      }
    masked.current = count;
    if (cfgRef.current.mode === "stamp" && region) redrawStamp();
    report();
    // redrawStamp/report는 ref만 읽는다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shape, region, regionMargin]);

  /**
   * 도포 단계(참고 2~3) 마감.
   * 2 연함: 매트·광택 없음(옅은 베이지 덮개를 씌우지 않음)
   * 3 알맞음: 깊은 색 위 부드러운 비단 광택
   * 4 과함(젖은): over 레이어가 담당. 여기선 거의 손대지 않음
   * 5 경화 주름: 건조 연결용 — 아직 미반영
   */
  function redrawQuality() {
    const cfg = cfgRef.current;
    const canvas = qualityRef.current;
    if (!canvas) return;
    if (cfg.mode === "stamp") {
      canvas.getContext("2d")!.clearRect(0, 0, 300, 300);
      return;
    }
    let buf = qualityBuf.current;
    if (!buf) {
      buf = document.createElement("canvas");
      buf.width = buf.height = N;
      qualityBuf.current = buf;
    }
    const bctx = buf.getContext("2d")!;
    const img = bctx.createImageData(N, N);
    const g = grid.current;
    const m = mask.current;
    const [lo, hi] = cfg.range;
    const lac = hexRgb(cfg.color);
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        const o = k * 4;
        if (!m[k]) {
          img.data[o + 3] = 0;
          continue;
        }
        const v = g[k];
        let r = 0,
          gg = 0,
          b = 0,
          a = 0;
        if (v > cfg.over) {
          img.data[o + 3] = 0;
          continue;
        } else if (v >= lo && v <= hi) {
          // 3: 붓으로 칠해진 칸만 — 칠 두께·이웃 결로 국소 새틴 광택 (전역 흰 호선 없음)
          const t = (v - lo) / Math.max(0.001, hi - lo);
          const vl = i > 0 && m[k - 1] ? g[k - 1] : v;
          const vr = i < N - 1 && m[k + 1] ? g[k + 1] : v;
          const vu = j > 0 && m[k - N] ? g[k - N] : v;
          const vd = j < N - 1 && m[k + N] ? g[k + N] : v;
          const nx = (vl - vr) * 0.9;
          const ny = (vu - vd) * 0.9;
          // 결을 따르되, 두꺼워질수록 흰 능선이 파이지 않게 약하게
          const ridge = Math.max(0, 0.4 + nx * 0.55 + ny * 0.4);
          const grain = 0.75 + cellNoise(k) * 0.25;
          const sheen = Math.pow(ridge, 1.35) * (0.22 + t * 0.28) * grain;
          r = Math.round(lac.r * 0.45 + 190 * sheen * 0.4);
          gg = Math.round(lac.g * 0.45 + 180 * sheen * 0.35);
          b = Math.round(lac.b * 0.45 + 170 * sheen * 0.3);
          a = 0.03 + sheen * 0.12;
        } else if (v > 0.05) {
          // 2: 매트 — 광택 없이 살짝만 눌러 나무결이 비치게
          const thin = 1 - Math.min(1, v / lo);
          r = Math.round(lac.r * 0.55);
          gg = Math.round(lac.g * 0.55);
          b = Math.round(lac.b * 0.55);
          a = 0.05 + thin * 0.12;
        }
        img.data[o] = Math.min(255, r);
        img.data[o + 1] = Math.min(255, gg);
        img.data[o + 2] = Math.min(255, b);
        img.data[o + 3] = Math.round(Math.min(1, a) * 255);
      }
    bctx.putImageData(img, 0, 0);
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 300, 300);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.save();
    ctx.filter = "blur(1.4px)";
    ctx.drawImage(buf, 0, 0, 300, 300);
    ctx.restore();
  }

  function report() {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const { range, over } = cfgRef.current;
      let touched = 0,
        thin = 0,
        inRange = 0,
        overN = 0,
        sum = 0;
      const g = grid.current;
      const m = mask.current;
      for (let k = 0; k < g.length; k++) {
        if (!m[k]) continue;
        const v = g[k];
        sum += v;
        if (v > 0.05) touched++;
        if (v > 0.05 && v < range[0]) thin++;
        if (v >= range[0] && v <= range[1]) inRange++;
        if (v > over) overN++;
      }
      const n = masked.current || 1;
      statsRef.current({ touched: touched / n, thin: thin / n, inRange: inRange / n, over: overN / n, mean: sum / n });
      redrawQuality();
      if (cfgRef.current.inkDecay && inkRef) inkCb.current?.(inkRef.current);
    });
  }

  function dab(x: number, y: number) {
    const cfg = cfgRef.current;
    const r = cfg.brushRadius;
    const spacing = r / 3;
    let load = 1;
    if (cfg.inkDecay && inkRef) {
      load = inkRef.current;
      if (load < 0.03) return;
      inkRef.current = load * cfg.inkDecay;
      load *= 1.25;
    }
    const rate = ((cfg.passAmount * spacing) / r) * load;
    const alpha = Math.min(0.9, (2.3 * rate) / cfg.opaqueAt);
    const ctx = layerRef.current!.getContext("2d")!;

    if (cfg.mode === "pattern") {
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = Math.min(1, alpha * 1.6);
      ctx.fillStyle = pattern.current!;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (cfg.mode === "erase") {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      ctx.globalCompositeOperation = "destination-out";
      grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.globalCompositeOperation = "source-over";
    } else {
      // 나무 위에 붓질하는 살짝 거친 결 (가느다란 모 여러 가닥)
      dabRoughBrush(ctx, x, y, r, alpha, cfg.color, cfg.overColor || cfg.color, strokeDir.current);
    }

    const g = grid.current;
    const m = mask.current;
    const i0 = Math.max(0, Math.floor((x - r) / CELL));
    const i1 = Math.min(N - 1, Math.floor((x + r) / CELL));
    const j0 = Math.max(0, Math.floor((y - r) / CELL));
    const j1 = Math.min(N - 1, Math.floor((y + r) / CELL));
    const octx = overRef.current!.getContext("2d")!;
    const fresh: { x: number; y: number }[] = [];
    let dripTouch = false;
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const k = j * N + i;
        if (!m[k]) continue;
        const cx = (i + 0.5) * CELL;
        const cy = (j + 0.5) * CELL;
        const d2 = ((cx - x) ** 2 + (cy - y) ** 2) / (r * r);
        if (d2 >= 1) continue;
        g[k] += rate * (1 - d2);
        if (g[k] <= cfg.over) continue;
        if (cfg.overStyle === "drip") {
          dripTouch = true;
          flagged.current[k] = 1;
          continue;
        }
        const level = cfg.overStyle === "haze" ? (g[k] > cfg.over * 1.8 ? 3 : g[k] > cfg.over * 1.35 ? 2 : 1) : 1;
        if (flagged.current[k] < level) {
          fresh.push({ x: cx, y: cy });
          flagged.current[k] = level;
        }
      }
    if (dripTouch) scheduleDrip();
    else if (cfg.overStyle !== "none") for (const p of fresh) drawOver(octx, p.x, p.y, cfg, strokeDir.current);
  }

  function stampColor(v: number, cfg: PaintConfig): [number, number, number, number] {
    const [lo, hi] = cfg.range;
    // 연함(노란 종이) → 알맞음(맑은 밀색) → 과함(짙은 눌음) 대비를 키운다.
    const stops: [number, [number, number, number, number]][] = [
      [0, [246, 238, 220, 0.78]],
      [lo * 0.55, [236, 210, 150, 0.62]],
      [lo, [198, 214, 176, 0.22]],
      [hi, [168, 196, 150, 0.28]],
      [cfg.over, [168, 96, 48, 0.62]],
      [cfg.over + 0.6, [96, 40, 18, 0.9]],
      [cfg.over + 1.6, [42, 18, 8, 0.96]],
    ];
    if (v <= 0) return stops[0][1];
    for (let s = 1; s < stops.length; s++) {
      const [b, cb] = stops[s];
      if (v > b) continue;
      const [a, ca] = stops[s - 1];
      const t = (v - a) / (b - a || 1);
      return [0, 1, 2, 3].map((c) => ca[c] + (cb[c] - ca[c]) * t) as [number, number, number, number];
    }
    return stops[stops.length - 1][1];
  }

  /** 다림질 결과를 칸 단위가 아니라 부드럽게 번진 색으로 다시 그린다 */
  function redrawStamp() {
    const cfg = cfgRef.current;
    let buf = stampBuf.current;
    if (!buf) {
      buf = document.createElement("canvas");
      buf.width = buf.height = N;
      stampBuf.current = buf;
    }
    const bctx = buf.getContext("2d")!;
    const img = bctx.createImageData(N, N);
    const g = grid.current;
    const m = mask.current;
    for (let k = 0; k < g.length; k++) {
      const [r, gg, b, a] = m[k] ? stampColor(g[k], cfg) : OFF_REGION;
      img.data[k * 4] = r;
      img.data[k * 4 + 1] = gg;
      img.data[k * 4 + 2] = b;
      img.data[k * 4 + 3] = Math.round(a * 255);
    }
    bctx.putImageData(img, 0, 0);
    const ctx = layerRef.current!.getContext("2d")!;
    ctx.clearRect(0, 0, 300, 300);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.save();
    ctx.filter = "blur(2.5px)";
    ctx.drawImage(buf, 0, 0, 300, 300);
    ctx.restore();
  }

  function pressStep(now: number) {
    const h = hold.current;
    if (!h) return;
    const cfg = cfgRef.current;
    const dt = Math.min(0.05, (now - h.t) / 1000);
    h.t = now;
    const r = cfg.brushRadius;
    const add = (cfg.stampRate ?? 1) * dt;
    const g = grid.current;
    const m = mask.current;
    const i0 = Math.max(0, Math.floor((h.x - r) / CELL));
    const i1 = Math.min(N - 1, Math.floor((h.x + r) / CELL));
    const j0 = Math.max(0, Math.floor((h.y - r) / CELL));
    const j1 = Math.min(N - 1, Math.floor((h.y + r) / CELL));
    let sum = 0;
    let n = 0;
    let burnt = false;
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const k = j * N + i;
        if (!m[k]) continue;
        const d2 = (((i + 0.5) * CELL - h.x) ** 2 + ((j + 0.5) * CELL - h.y) ** 2) / (r * r);
        if (d2 >= 1) continue;
        g[k] += add * (1 - d2 * d2);
        if (d2 < 0.5) {
          sum += g[k];
          n++;
        }
        if (g[k] > cfg.over) burnt = true;
      }
    redrawStamp();
    report();
    const stage = n ? stageOf(sum / n, cfg) : 0;
    setPressed((p) => (p && p.stage === stage ? p : { x: h.x, y: h.y, stage }));
    loopLevel(burnt ? 1 : 0.6);
    if (burnt && now - smokeAt.current > 130) {
      smokeAt.current = now;
      const id = ++smokeId.current;
      const puff = { id, x: h.x + (Math.random() - 0.5) * r * 0.9, y: h.y + (Math.random() - 0.5) * r * 0.6 };
      setSmoke((s) => [...s.slice(-14), puff]);
      setTimeout(() => setSmoke((s) => s.filter((p) => p.id !== id)), 1600);
    }
    holdFrame.current = requestAnimationFrame(pressStep);
  }

  function startPress(p: { x: number; y: number }) {
    hold.current = { ...p, t: performance.now() };
    setPressed({ ...p, stage: 0 });
    cancelAnimationFrame(holdFrame.current);
    holdFrame.current = requestAnimationFrame(pressStep);
  }

  function endPress() {
    if (!hold.current) return;
    hold.current = null;
    cancelAnimationFrame(holdFrame.current);
    setPressed(null);
    loopLevel(0);
  }

  function scheduleDrip() {
    if (dripFrame.current) return;
    dripFrame.current = requestAnimationFrame(() => {
      dripFrame.current = 0;
      const canvas = overRef.current;
      const cfg = cfgRef.current;
      if (!canvas || cfg.overStyle !== "drip") return;
      let buf = dripBuf.current;
      if (!buf) {
        buf = document.createElement("canvas");
        buf.width = buf.height = N;
        dripBuf.current = buf;
      }
      redrawDrips(canvas.getContext("2d")!, grid.current, cfg.over, cfg.color, cfg.overColor || cfg.color, buf);
    });
  }

  function pointOf(clientX: number, clientY: number, pointerType?: string) {
    const rect = wrapRef.current?.getBoundingClientRect();
    const width = rect?.width || 1;
    const height = rect?.height || 1;
    const lift = cfgRef.current.lift ? toolLift(pointerType) : 0;
    return {
      x: ((clientX - (rect?.left ?? 0)) / width) * 300,
      y: ((clientY - lift - (rect?.top ?? 0)) / height) * 300,
      lift: (lift / height) * 300,
    };
  }

  function logPointer(e: React.PointerEvent, note = "") {
    if (!debugRef.current) return;
    if (e.type === "pointermove" && performance.now() - lastMoveLog.current < 120) return;
    if (e.type === "pointermove") lastMoveLog.current = performance.now();
    setTrace((rows) => [...rows.slice(-14), { t: e.type, id: e.pointerId, note }]);
  }

  function stopStroke(e: React.PointerEvent) {
    if (!releaseCraftPointer(e, gesture)) return false;
    recapture.current = 0;
    last.current = null;
    velocity.current = 0;
    endPress();
    loopLevel(0);
    return true;
  }

  function stroke(p: { x: number; y: number }) {
    const l = last.current;
    const spacing = cfgRef.current.brushRadius / 3;
    if (!l) {
      dab(p.x, p.y);
      last.current = p;
      return;
    }
    const dist = Math.hypot(p.x - l.x, p.y - l.y);
    if (dist > 0.5) strokeDir.current = Math.atan2(p.y - l.y, p.x - l.x);
    velocity.current = velocity.current * 0.7 + dist * 0.3;
    loopLevel(Math.min(1, velocity.current / 6));
    if (dist < spacing) return;
    const steps = Math.floor(dist / spacing);
    for (let s = 1; s <= steps; s++) {
      dab(l.x + ((p.x - l.x) * s) / steps, l.y + ((p.y - l.y) * s) / steps);
    }
    last.current = p;
    report();
  }

  const stamp = config.mode === "stamp";
  const toolAt = pressed ?? cursor;
  const brushColor =
    config.mode !== "paint" ? undefined : config.inkDecay ? mixHex(config.color, "#cbb58c", 1 - Math.min(1, ink)) : config.color;
  const pct = (v: number) => `${(v / 300) * 100}%`;

  return (
    <>
    <div
      ref={wrapRef}
      data-paint-canvas="1"
      className="craft-touch-area relative aspect-square w-full"
      onPointerDown={(e) => {
        const ignored = gesture.current != null;
        logPointer(e, ignored ? "다른 손가락이라 무시" : "");
        if (disabled || !claimCraftPointer(e, gesture)) return;
        recapture.current = 0;
        last.current = null;
        const p = pointOf(e.clientX, e.clientY, e.pointerType);
        setCursor(p);
        if (stamp) {
          startPress({ x: p.x, y: p.y });
          return;
        }
        stroke(p);
        report();
      }}
      onPointerMove={(e) => {
        if (isForeignCraftPointer(e, gesture)) return;
        const native = e.nativeEvent;
        const coalesced = typeof native.getCoalescedEvents === "function" ? native.getCoalescedEvents() : [];
        const samples = coalesced.length ? coalesced : [native];
        logPointer(e, samples.length > 1 ? `중간 점 ${samples.length}` : "");
        if (gesture.current == null) {
          setCursor(pointOf(e.clientX, e.clientY, e.pointerType));
          return;
        }
        if (disabled || stamp) {
          const p = pointOf(samples[samples.length - 1].clientX, samples[samples.length - 1].clientY, e.pointerType);
          setCursor(p);
          const h = hold.current;
          if (stamp && !disabled && h) {
            const dx = p.x - h.x;
            const dy = p.y - h.y;
            if (Math.hypot(dx, dy) > SLIDE_MIN) {
              slideCb.current?.({ x: h.x, y: h.y }, dx * SLIDE_PUSH, dy * SLIDE_PUSH);
              h.x = p.x;
              h.y = p.y;
              setPressed((prev) => (prev ? { ...prev, x: p.x, y: p.y } : prev));
            }
          }
          return;
        }
        let p = pointOf(e.clientX, e.clientY);
        for (const sample of samples) {
          p = pointOf(sample.clientX, sample.clientY);
          stroke(p);
        }
        setCursor(p);
      }}
      onPointerUp={(e) => {
        logPointer(e, gesture.current != null && gesture.current !== e.pointerId ? "다른 손가락이라 붓질 유지" : "");
        stopStroke(e);
      }}
      onPointerCancel={(e) => {
        logPointer(e, gesture.current != null && gesture.current !== e.pointerId ? "다른 손가락이라 붓질 유지" : "브라우저가 터치를 취소함");
        stopStroke(e);
      }}
      onLostPointerCapture={(e) => {
        if (e.pointerId !== gesture.current) {
          logPointer(e, "");
          return;
        }
        if (e.buttons > 0 && recapture.current < 1) {
          recapture.current += 1;
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
            logPointer(e, "캡처가 풀려 다시 잡음");
            return;
          } catch {
            logPointer(e, "캡처를 다시 잡지 못함");
          }
        } else {
          logPointer(e, e.buttons > 0 ? "손가락이 눌린 채 캡처가 풀림" : "캡처 종료");
        }
        stopStroke(e);
      }}
      onPointerLeave={(e) => {
        logPointer(e, gesture.current === e.pointerId ? "영역 밖이지만 붓질 유지" : "");
        if (gesture.current != null) return;
        setCursor(null);
      }}
    >
      <div className="pointer-events-none absolute inset-0">{background}</div>
      <canvas ref={layerRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <canvas ref={qualityRef} className="pointer-events-none absolute inset-0 h-full w-full paint-quality-map" />
      <canvas ref={overRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {foreground && <div className="pointer-events-none absolute inset-0">{foreground}</div>}
      {stamp && cursor && !pressed && !disabled && (
        <div
          className="iron-footprint"
          style={{ left: pct(cursor.x), top: pct(cursor.y), width: pct(config.brushRadius * 2), height: pct(config.brushRadius * 2) }}
        />
      )}
      {pressed && (
        <>
          <div
            className={`iron-footprint pressing stage-${pressed.stage}`}
            style={{ left: pct(pressed.x), top: pct(pressed.y), width: pct(config.brushRadius * 2), height: pct(config.brushRadius * 2) }}
          />
          {config.stampLabels && (
            <div
              className={`iron-label stage-${pressed.stage}`}
              style={{ left: pct(pressed.x), top: pct(pressed.y - config.brushRadius - 6) }}
            >
              {config.stampLabels[pressed.stage]}
            </div>
          )}
        </>
      )}
      {smoke.map((s) => (
        <span key={s.id} className="iron-smoke" style={{ left: pct(s.x), top: pct(s.y) }} />
      ))}
      {toolAt && !disabled && (
        <ToolCursor tool={config.tool} color={brushColor} x={pct(toolAt.x)} y={pct(toolAt.y)} />
      )}
      {config.lift && toolAt && !disabled && (
        <svg viewBox="0 0 300 300" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
          <WorkPoint x={toolAt.x} y={toolAt.y} lift={cursor?.lift ?? 0} r={5} />
        </svg>
      )}
    </div>
    {process.env.NODE_ENV === "development" && (
      <div className="mt-2 flex flex-col gap-2">
        <button type="button" className="self-end text-xs text-[var(--cream)] underline" onClick={() => setDebug((on) => !on)}>
          {debug ? "터치 기록 숨기기" : "터치 기록"}
        </button>
        {debug && (
          <ol data-paint-trace="1" className="panel max-h-40 overflow-y-auto py-2 text-xs text-[var(--brown)]">
            {trace.length === 0 && <li>아직 포인터 이벤트가 없습니다.</li>}
            {trace.map((row, index) => (
              <li key={`${row.t}-${row.id}-${index}`}>
                {row.t} #{row.id}
                {row.note ? ` · ${row.note}` : ""}
              </li>
            ))}
          </ol>
        )}
      </div>
    )}
    </>
  );
}

/** 개발용. 저장을 건드리지 않고 옻칠 터치만 확인한다. */
export function PaintLab() {
  return (
    <div className="screen" data-paint-lab="1">
      <div className="screen-body flex flex-col gap-3">
        <div className="workbench">
          <PaintCanvas
            shape="round"
            forceDebug
            onStats={() => undefined}
            background={<div className="h-full w-full bg-[#f3ead8]" />}
            config={{
              brushRadius: 22,
              passAmount: 0.82,
              range: [0.52, 3.4],
              over: 4.2,
              opaqueAt: 0.52,
              mode: "paint",
              color: "#100c0a",
              overColor: "#040302",
              overStyle: "drip",
              sound: "brush",
              tool: "brush",
              inkDecay: 0.9887,
            }}
          />
        </div>
        <div className="panel py-3 text-sm text-[var(--brown)]">
          이 칸 밖을 끌면 화면이 스크롤됩니다. 위 작업 칸을 끌면 스크롤되지 않아야 합니다.
        </div>
        <div className="h-[70vh]" />
      </div>
    </div>
  );
}

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function hexRgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mixHex(hex: string, to: string, t: number) {
  const a = hexRgb(hex);
  const b = hexRgb(to);
  const m = (x: number, y: number) => Math.round(x + (y - x) * t);
  return `rgb(${m(a.r, b.r)},${m(a.g, b.g)},${m(a.b, b.b)})`;
}

/** 얇은 옻층. 더 칠해도 조금밖에 두꺼워지지 않는다. */
function dripHeight(amount: number, over: number) {
  const excess = amount - over;
  if (excess <= 0) return 0;
  return Math.min(3.6, 0.45 + Math.sqrt(excess) * 1.15);
}

/** 칸마다 다른 울퉁불퉁함을 위한 값 */
function cellNoise(k: number) {
  const n = Math.sin(k * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
}

/** 나무에 옻을 바르는 거친 붓 결. 본색만 쓰고 검정 코어 반점은 만들지 않는다. */
function dabRoughBrush(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  alpha: number,
  color: string,
  _deep: string,
  dir: number,
) {
  const cos = Math.cos(dir);
  const sin = Math.sin(dir);
  const bristles = 8;
  // deep(거의 검정) 코어를 섞으면 반점처럼 보여서 본색만 사용
  const boost = Math.min(1, alpha * 1.25);
  ctx.globalCompositeOperation = "source-over";
  for (let b = 0; b < bristles; b++) {
    const along = (b / (bristles - 1) - 0.5) * 2;
    const n0 = cellNoise((b * 17 + Math.round(x * 3 + y)) | 0);
    const n1 = cellNoise((b * 31 + Math.round(x + y * 5)) | 0);
    const px = x + (-sin * along + cos * (n0 - 0.5) * 0.35) * r * 0.88;
    const py = y + (cos * along + sin * (n0 - 0.5) * 0.35) * r * 0.88;
    const rw = r * (0.2 + n1 * 0.16);
    const rh = r * (0.75 + n0 * 0.35);
    const aB = boost * (0.4 + n1 * 0.35);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(dir);
    ctx.scale(rh / r, rw / r);
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    grad.addColorStop(0, hexA(color, aB));
    grad.addColorStop(0.5, hexA(color, aB * 0.5));
    grad.addColorStop(1, hexA(color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/**
 * 참고 4: 과다 도포 — 부드러운 물감/옻 고임.
 * 높이맵 기반 부드러운 부피·윤기. 딱딱한 외곽·핏자국형 셀 셰딩 없음.
 */
function redrawDrips(
  ctx: CanvasRenderingContext2D,
  grid: Float32Array,
  over: number,
  color: string,
  deep: string,
  buf: HTMLCanvasElement,
) {
  ctx.clearRect(0, 0, 300, 300);
  const heights = new Float32Array(N * N);
  let any = false;
  for (let k = 0; k < grid.length; k++) {
    const h = dripHeight(grid[k], over);
    if (h <= 0) continue;
    heights[k] = h;
    any = true;
  }
  if (!any) return;

  const bctx = buf.getContext("2d")!;
  const fill = bctx.createImageData(N, N);
  const gloss = bctx.createImageData(N, N);
  const { r: cr, g: cg, b: cb } = hexRgb(color);
  const { r: dr, g: dg, b: db } = hexRgb(deep);
  const gray = 0.299 * cr + 0.587 * cg + 0.114 * cb;
  const chroma = Math.max(Math.abs(cr - gray), Math.abs(cg - gray), Math.abs(cb - gray));
  const isInk = chroma < 18 && gray < 48;

  // 물감 본체: 본색에 가깝고 채도만 살짝, 명도는 거의 유지
  const sat = isInk ? 0.08 : 0.28;
  const body = (c: number) =>
    Math.min(255, Math.max(0, Math.round(gray + (c - gray) * (1 + sat))));
  const br = body(cr);
  const bg = body(cg);
  const bb = body(cb);
  // 두꺼운 곳 그림자 / 빛 — 같은 색 계열
  const shR = Math.round(br * 0.82 + dr * 0.18);
  const shG = Math.round(bg * 0.82 + dg * 0.18);
  const shB = Math.round(bb * 0.82 + db * 0.18);
  const hiR = Math.min(255, Math.round(br * 0.72 + 255 * 0.28));
  const hiG = Math.min(255, Math.round(bg * 0.72 + 255 * 0.28));
  const hiB = Math.min(255, Math.round(bb * 0.72 + 255 * 0.28));

  const hAt = (i: number, j: number) => {
    if (i < 0 || j < 0 || i >= N || j >= N) return 0;
    return heights[j * N + i];
  };

  for (let j = 0; j < N; j++)
    for (let i = 0; i < N; i++) {
      const k = j * N + i;
      const o = k * 4;
      const h = heights[k];
      if (h <= 0) {
        fill.data[o + 3] = 0;
        gloss.data[o + 3] = 0;
        continue;
      }

      const hl = hAt(i - 1, j);
      const hr = hAt(i + 1, j);
      const hu = hAt(i, j - 1);
      const hd = hAt(i, j + 1);
      const neigh = (hl > 0 ? 1 : 0) + (hr > 0 ? 1 : 0) + (hu > 0 ? 1 : 0) + (hd > 0 ? 1 : 0);
      // 가장자리는 알파로만 부드럽게 페더 (선 테두리 X)
      const feather = 0.35 + neigh * 0.16;

      // 높이·기울기로 부드러운 부피 명암
      const nx = (hl - hr) * 0.45;
      const ny = (hu - hd) * 0.45;
      const lit = Math.max(0, Math.min(1, 0.48 + nx * 0.55 + ny * 0.4 + Math.min(h, 2.2) * 0.06));
      const thick = Math.min(1, h / 2.4);

      fill.data[o] = Math.round(shR + (br - shR) * lit + (hiR - br) * lit * lit * 0.35);
      fill.data[o + 1] = Math.round(shG + (bg - shG) * lit + (hiG - bg) * lit * lit * 0.35);
      fill.data[o + 2] = Math.round(shB + (bb - shB) * lit + (hiB - bb) * lit * lit * 0.35);
      fill.data[o + 3] = Math.round(Math.min(0.92, (0.38 + thick * 0.42) * feather) * 255);

      // 젖은 물감 윤기 — 능선·밝은 쪽에만 부드러운 광
      const sheen = Math.pow(Math.max(0, lit - 0.42), 1.6) * (0.2 + thick * 0.55) * feather;
      gloss.data[o] = hiR;
      gloss.data[o + 1] = hiG;
      gloss.data[o + 2] = hiB;
      gloss.data[o + 3] = Math.round(Math.min(0.34, sheen) * 255);
    }

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // 부드러운 본체 (물감처럼 번진 가장자리)
  bctx.putImageData(fill, 0, 0);
  ctx.globalAlpha = 1;
  ctx.filter = "blur(1.8px)";
  ctx.drawImage(buf, 0, 0, 300, 300);
  ctx.filter = "blur(0.7px)";
  ctx.globalAlpha = 0.85;
  ctx.drawImage(buf, 0, 0, 300, 300);

  // 젖은 윤기
  bctx.putImageData(gloss, 0, 0);
  ctx.filter = "blur(2.4px)";
  ctx.globalAlpha = 0.75;
  ctx.drawImage(buf, 0, 0, 300, 300);

  ctx.restore();
  ctx.filter = "none";
  ctx.globalAlpha = 1;
}

function drawOver(ctx: CanvasRenderingContext2D, x: number, y: number, cfg: PaintConfig, dir: number) {
  if (cfg.overStyle === "haze") {
    drawWear(ctx, x, y, dir);
    return;
  }
  ctx.fillStyle = cfg.overColor;
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.arc(x + (Math.random() - 0.5) * 3, y + (Math.random() - 0.5) * 3, CELL * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** 너무 갈아낸 곳: 광택이 죽어 뿌옇게 연해지고, 숫돌 결을 따라 잔 흠집이 난다 */
function drawWear(ctx: CanvasRenderingContext2D, x: number, y: number, dir: number) {
  const jx = x + (Math.random() - 0.5) * CELL;
  const jy = y + (Math.random() - 0.5) * CELL;
  ctx.save();
  ctx.filter = "blur(2.6px)";
  ctx.globalAlpha = 0.13;
  ctx.fillStyle = "#efe9e2";
  ctx.beginPath();
  ctx.arc(jx, jy, CELL * 1.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.lineCap = "round";
  const lines = 1 + (Math.random() < 0.5 ? 1 : 0);
  for (let s = 0; s < lines; s++) {
    const a = dir + (Math.random() - 0.5) * 0.5;
    const len = 4 + Math.random() * 9;
    const sx = jx + (Math.random() - 0.5) * CELL * 1.4;
    const sy = jy + (Math.random() - 0.5) * CELL * 1.4;
    const ex = sx + Math.cos(a) * len;
    const ey = sy + Math.sin(a) * len;
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "#1a120e";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(sx + 0.3, sy + 0.4);
    ctx.lineTo(ex + 0.3, ey + 0.4);
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = "#fbf7f1";
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
  }
  ctx.restore();
}
