"use client";

import { useEffect, useRef, useState } from "react";
import { SHAPES, type ShapeId } from "@/lib/data";
import { loopLevel, startLoop, stopLoop } from "@/lib/sound";
import { ToolCursor, type ToolId } from "@/components/Tools";
import { claimCraftPointer, isForeignCraftPointer, releaseCraftPointer, useBlockCraftScroll } from "./craftTouch";

export interface PaintStats {
  /** 조금이라도 작업된 칸 비율 */
  touched: number;
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
}

/** 0 = 덜 됨, 1 = 알맞음, 2 = 지나침 */
function stageOf(v: number, cfg: PaintConfig) {
  return v > cfg.over ? 2 : v >= cfg.range[0] ? 1 : 0;
}

const N = 50;
const CELL = 300 / N;
const RES = 2;

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
  /** 개발용 포인터 기록. 프로덕션 빌드에서는 보이지 않는다. */
  forceDebug?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const layerRef = useRef<HTMLCanvasElement>(null);
  const overRef = useRef<HTMLCanvasElement>(null);
  const grid = useRef(new Float32Array(N * N));
  const mask = useRef(new Uint8Array(N * N));
  const flagged = useRef(new Uint8Array(N * N));
  const masked = useRef(0);
  const last = useRef<{ x: number; y: number } | null>(null);
  const pattern = useRef<CanvasPattern | null>(null);
  const raf = useRef(0);
  const dripFrame = useRef(0);
  const velocity = useRef(0);
  const gesture = useRef<number | null>(null);
  const recapture = useRef(0);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
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
    const over = overRef.current!;
    const path = new Path2D(SHAPES[shape].path);
    for (const cv of [layer, over]) {
      cv.width = 300 * RES;
      cv.height = 300 * RES;
      const ctx = cv.getContext("2d")!;
      ctx.setTransform(RES, 0, 0, RES, 0, 0);
      ctx.clip(path);
    }
    const probe = document.createElement("canvas").getContext("2d")!;
    let count = 0;
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const inside = probe.isPointInPath(path, (i + 0.5) * CELL, (j + 0.5) * CELL);
        mask.current[j * N + i] = inside ? 1 : 0;
        if (inside) count++;
      }
    masked.current = count;
    grid.current.fill(0);
    flagged.current.fill(0);
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
      hold.current = null;
    };
  }, [shape]);

  function report() {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      const { range, over } = cfgRef.current;
      let touched = 0,
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
        if (v >= range[0] && v <= range[1]) inRange++;
        if (v > over) overN++;
      }
      const n = masked.current || 1;
      statsRef.current({ touched: touched / n, inRange: inRange / n, over: overN / n, mean: sum / n });
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
    } else {
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      if (cfg.mode === "erase") {
        ctx.globalCompositeOperation = "destination-out";
        grad.addColorStop(0, `rgba(0,0,0,${alpha})`);
        grad.addColorStop(1, "rgba(0,0,0,0)");
      } else {
        ctx.globalCompositeOperation = "source-over";
        grad.addColorStop(0, hexA(cfg.color, alpha));
        grad.addColorStop(0.7, hexA(cfg.color, alpha * 0.5));
        grad.addColorStop(1, hexA(cfg.color, 0));
      }
      ctx.fillStyle = grad;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
      ctx.globalCompositeOperation = "source-over";
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
    const stops: [number, [number, number, number, number]][] = [
      [0, [246, 238, 220, 0.72]],
      [lo * 0.55, [240, 228, 204, 0.6]],
      [lo, [218, 194, 150, 0.26]],
      [hi, [206, 176, 122, 0.3]],
      [cfg.over, [168, 112, 56, 0.55]],
      [cfg.over + 0.6, [92, 48, 20, 0.86]],
      [cfg.over + 1.6, [48, 24, 10, 0.94]],
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
    for (let k = 0; k < g.length; k++) {
      const [r, gg, b, a] = stampColor(g[k], cfg);
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
    ctx.filter = "blur(1.5px)";
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
      redrawDrips(canvas.getContext("2d")!, grid.current, cfg.over, cfg.color);
    });
  }

  function pointOf(clientX: number, clientY: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    const width = rect?.width || 1;
    const height = rect?.height || 1;
    return {
      x: ((clientX - (rect?.left ?? 0)) / width) * 300,
      y: ((clientY - (rect?.top ?? 0)) / height) * 300,
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
        const p = pointOf(e.clientX, e.clientY);
        setCursor(p);
        if (stamp) {
          startPress(p);
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
          setCursor(pointOf(e.clientX, e.clientY));
          return;
        }
        if (disabled || stamp) {
          setCursor(pointOf(samples[samples.length - 1].clientX, samples[samples.length - 1].clientY));
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
              passAmount: 0.6,
              range: [0.8, 1.9],
              over: 2.5,
              opaqueAt: 0.9,
              mode: "paint",
              color: "#1a120e",
              overColor: "#1a120e",
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
  return Math.min(3.4, 0.4 + Math.sqrt(excess) * 1.05);
}

/**
 * 칠한 면과 같은 색의 얇은 막.
 * 가장자리는 흐려 아래 칠과 이어지고, 더 칠한 곳만 아래로 조금 불룩하다.
 */
function redrawDrips(ctx: CanvasRenderingContext2D, grid: Float32Array, over: number, color: string) {
  ctx.clearRect(0, 0, 300, 300);
  const cells: { x: number; y: number; h: number }[] = [];
  for (let k = 0; k < grid.length; k++) {
    const h = dripHeight(grid[k], over);
    if (h <= 0) continue;
    const i = k % N;
    const j = (k / N) | 0;
    cells.push({ x: (i + 0.5) * CELL, y: (j + 0.5) * CELL, h });
  }
  if (cells.length === 0) return;

  const { r, g, b } = hexRgb(color);
  const dark = (0.3 * r + 0.59 * g + 0.11 * b) / 255 < 0.2;
  const lip = dark ? mixHex(color, "#000000", 0.35) : mixHex(color, "#140806", 0.28);
  const rx = CELL * 1.08;

  ctx.save();
  ctx.filter = "blur(3.2px)";
  ctx.globalAlpha = dark ? 0.28 : 0.18;
  ctx.fillStyle = "#1a0e0c";
  ctx.beginPath();
  for (const c of cells) ctx.ellipse(c.x + c.h * 0.08, c.y + c.h * 0.42, rx, rx, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.filter = "blur(2px)";
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = lip;
  ctx.beginPath();
  for (const c of cells) ctx.ellipse(c.x, c.y + 0.25 + c.h * 0.7, rx, rx, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.filter = "blur(1.7px)";
  ctx.globalAlpha = 1;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (const c of cells) ctx.ellipse(c.x, c.y, rx, rx, 0, 0, Math.PI * 2);
  ctx.fill();
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
