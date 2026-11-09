"use client";

import { useEffect, useRef, useState } from "react";
import { SHAPES, type ShapeId } from "@/lib/data";
import { loopLevel, startLoop, stopLoop } from "@/lib/sound";
import { ToolCursor, type ToolId } from "@/components/Tools";

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
  mode: "paint" | "erase" | "pattern";
  color: string;
  initialFill?: string;
  overColor: string;
  overStyle: "drip" | "spot" | "haze";
  sound: "brush" | "sand" | "iron";
  tool: ToolId;
}

const N = 50;
const CELL = 300 / N;
const RES = 2;

function makeHempPattern(ctx: CanvasRenderingContext2D) {
  const S = 40;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "#d6c39c";
  g.fillRect(0, 0, S, S);
  for (let y = 0; y < S; y += 4) {
    g.fillStyle = `rgba(${180 + Math.random() * 20},${155 + Math.random() * 15},${110 + Math.random() * 15},0.9)`;
    g.fillRect(0, y + 0.5, S, 2.2);
  }
  for (let x = 0; x < S; x += 4) {
    for (let y = 0; y < S; y += 8) {
      const o = (x / 4) % 2 ? 4 : 0;
      g.fillStyle = `rgba(${225 + Math.random() * 15},${208 + Math.random() * 12},${170 + Math.random() * 12},0.85)`;
      g.fillRect(x + 0.6, y + o, 2.2, 3.4);
    }
  }
  g.strokeStyle = "rgba(120,90,50,0.25)";
  g.lineWidth = 0.4;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(Math.random() * S, Math.random() * S);
    g.lineTo(Math.random() * S, Math.random() * S);
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
}: {
  shape: ShapeId;
  config: PaintConfig;
  background: React.ReactNode;
  foreground?: React.ReactNode;
  onStats: (s: PaintStats) => void;
  disabled?: boolean;
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
  const velocity = useRef(0);
  const down = useRef(false);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const cfgRef = useRef(config);
  const statsRef = useRef(onStats);

  useEffect(() => {
    cfgRef.current = config;
    statsRef.current = onStats;
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
    });
  }

  function dab(x: number, y: number) {
    const cfg = cfgRef.current;
    const r = cfg.brushRadius;
    const spacing = r / 3;
    const rate = (cfg.passAmount * spacing) / r;
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
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const k = j * N + i;
        if (!m[k]) continue;
        const cx = (i + 0.5) * CELL;
        const cy = (j + 0.5) * CELL;
        const d2 = ((cx - x) ** 2 + (cy - y) ** 2) / (r * r);
        if (d2 >= 1) continue;
        g[k] += rate * (1 - d2);
        if (g[k] > cfg.over && !flagged.current[k]) {
          flagged.current[k] = 1;
          drawOver(octx, cx, cy, cfg);
        }
      }
  }

  function toLocal(e: React.PointerEvent) {
    const rect = wrapRef.current!.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 300,
      y: ((e.clientY - rect.top) / rect.height) * 300,
    };
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

  function end() {
    down.current = false;
    last.current = null;
    velocity.current = 0;
    loopLevel(0);
  }

  return (
    <div
      ref={wrapRef}
      className="relative aspect-square w-full select-none"
      style={{ touchAction: "none" }}
      onPointerDown={(e) => {
        if (disabled) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        down.current = true;
        last.current = null;
        const p = toLocal(e);
        setCursor(p);
        stroke(p);
        report();
      }}
      onPointerMove={(e) => {
        const p = toLocal(e);
        setCursor(p);
        if (down.current && !disabled) stroke(p);
      }}
      onPointerUp={end}
      onPointerCancel={end}
      onPointerLeave={() => {
        setCursor(null);
        end();
      }}
    >
      <div className="absolute inset-0">{background}</div>
      <canvas ref={layerRef} className="absolute inset-0 h-full w-full" />
      <canvas ref={overRef} className="absolute inset-0 h-full w-full" />
      {foreground && <div className="pointer-events-none absolute inset-0">{foreground}</div>}
      {cursor && !disabled && (
        <ToolCursor
          tool={config.tool}
          color={config.mode === "paint" ? config.color : undefined}
          x={`${(cursor.x / 300) * 100}%`}
          y={`${(cursor.y / 300) * 100}%`}
        />
      )}
    </div>
  );
}

function hexA(hex: string, a: number) {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function drawOver(ctx: CanvasRenderingContext2D, x: number, y: number, cfg: PaintConfig) {
  ctx.fillStyle = cfg.overColor;
  if (cfg.overStyle === "drip") {
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.ellipse(x, y + 3, CELL * 0.55, CELL * 1.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x - 1, y, 1, 0, Math.PI * 2);
    ctx.fill();
  } else if (cfg.overStyle === "spot") {
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.arc(x + (Math.random() - 0.5) * 3, y + (Math.random() - 0.5) * 3, CELL * 0.9, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.globalAlpha = 0.5;
    ctx.fillRect(x - CELL / 2, y - CELL / 2, CELL, CELL);
  }
  ctx.globalAlpha = 1;
}
