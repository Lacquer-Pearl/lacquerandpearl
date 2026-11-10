"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Artwork from "@/components/Artwork";
import { Btn, Meter } from "@/components/ui";
import { SHAPES } from "@/lib/data";
import type { Design } from "@/lib/game";
import { t, tNode } from "@/lib/i18n";
import { loopLevel, sfx, startLoop, stopLoop } from "@/lib/sound";
import { useSave } from "@/lib/store";
import { StepHeader } from "./common";

const N = 50;
const CELL = 300 / N;
/** 삼베 조각 폭 */
const W = 46;
/** 이보다 짧게 끌면 붙이지 않음 */
const MIN_LEN = 24;
/** 축에서 이만큼 벗어나면 주름이 잡힌다 */
const SLACK = 6;

interface Strip {
  x: number;
  y: number;
  /** 라디안 */
  a: number;
  len: number;
  /** 주름 잡힌 위치 (시작점에서의 거리) */
  creases: number[];
  wrinkle: number;
}

interface Active {
  x: number;
  y: number;
  a: number | null;
  len: number;
  creases: number[];
  wrinkle: number;
  lastX: number;
  lastY: number;
}

function coverage(strips: Strip[], mask: Uint8Array) {
  const count = new Uint8Array(N * N);
  for (const s of strips) {
    const cos = Math.cos(s.a);
    const sin = Math.sin(s.a);
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const k = j * N + i;
        if (!mask[k]) continue;
        const dx = (i + 0.5) * CELL - s.x;
        const dy = (j + 0.5) * CELL - s.y;
        const along = dx * cos + dy * sin;
        const perp = -dx * sin + dy * cos;
        if (along >= 0 && along <= s.len && Math.abs(perp) <= W / 2) count[k] = Math.min(9, count[k] + 1);
      }
  }
  let total = 0;
  let covered = 0;
  let good = 0;
  let thick = 0;
  for (let k = 0; k < count.length; k++) {
    if (!mask[k]) continue;
    total++;
    if (count[k] >= 1) covered++;
    if (count[k] >= 1 && count[k] <= 2) good++;
    if (count[k] >= 3) thick++;
  }
  const n = total || 1;
  const wrinkle = strips.length ? strips.reduce((a, s) => a + s.wrinkle, 0) / strips.length : 0;
  return { covered: covered / n, good: good / n, thick: thick / n, wrinkle };
}

function StripGraphic({ s, fill, rolling }: { s: Pick<Strip, "x" | "y" | "a" | "len" | "creases">; fill: string; rolling?: boolean }) {
  const deg = (s.a * 180) / Math.PI;
  return (
    <g transform={`translate(${s.x} ${s.y}) rotate(${deg})`}>
      <rect x="0" y={-W / 2 + 1.5} width={s.len} height={W} fill="#2a1a0e" opacity="0.18" />
      <rect x="0" y={-W / 2} width={s.len} height={W} fill={fill} />
      <path
        d={`M0 ${-W / 2} H${s.len} M0 ${W / 2} H${s.len}`}
        stroke="#b49a6c"
        strokeWidth="1.2"
        strokeDasharray="1.5 1.2"
        opacity="0.8"
      />
      {s.creases.map((c, i) => (
        <g key={i} opacity="0.75">
          <path d={`M${c} ${-W / 2} q3 ${W / 4} -1 ${W / 2} t1 ${W / 2}`} stroke="#8a714a" strokeWidth="1.6" fill="none" />
          <path d={`M${c + 1.6} ${-W / 2} q3 ${W / 4} -1 ${W / 2} t1 ${W / 2}`} stroke="#fff6e2" strokeWidth="0.9" fill="none" />
        </g>
      ))}
      {rolling && (
        <g transform={`translate(${s.len} 0)`}>
          <rect x="-6" y={-W / 2 - 4} width="12" height={W + 8} rx="6" fill="#cdb689" stroke="#8a714a" strokeWidth="1.2" />
          <path d={`M-2 ${-W / 2 - 2} V${W / 2 + 2}`} stroke="#efe0bd" strokeWidth="2" opacity="0.8" />
        </g>
      )}
    </g>
  );
}

export default function ClothStep({ design, onDone }: { design: Design; onDone: (score: number) => void }) {
  const lang = useSave((s) => s.lang);
  const shapePath = SHAPES[design.shape].path;
  const mask = useMemo(() => {
    const m = new Uint8Array(N * N);
    if (typeof document === "undefined") return m;
    const probe = document.createElement("canvas").getContext("2d")!;
    const path = new Path2D(shapePath);
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) m[j * N + i] = probe.isPointInPath(path, (i + 0.5) * CELL, (j + 0.5) * CELL) ? 1 : 0;
    return m;
  }, [shapePath]);
  const [strips, setStrips] = useState<Strip[]>([]);
  const [active, setActive] = useState<Active | null>(null);
  const [done, setDone] = useState(false);
  const act = useRef<Active | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const stats = useMemo(() => coverage(strips, mask), [strips, mask]);
  const ready = stats.covered >= 0.5;

  useEffect(() => {
    startLoop("brush");
    loopLevel(0);
    return () => stopLoop();
  }, []);

  const toLocal = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 300, y: ((e.clientY - r.top) / r.height) * 300 };
  };

  const finishStrip = () => {
    const a = act.current;
    act.current = null;
    setActive(null);
    loopLevel(0);
    if (!a || a.a == null || a.len < MIN_LEN) return;
    const strip: Strip = { x: a.x, y: a.y, a: a.a, len: a.len, creases: a.creases, wrinkle: Math.min(1, a.wrinkle) };
    setStrips((s) => [...s, strip]);
    if (strip.wrinkle > 0.3) sfx.fail();
    else sfx.place();
  };

  const score = () => Math.round(Math.max(0, Math.min(100, stats.good * 108 - stats.thick * 60 - stats.wrinkle * 30)));

  return (
    <div className="flex flex-col gap-3">
      <StepHeader title={t(lang, "cloth.title")} emoji="🧵">
        {tNode(lang, "cloth.tip", { b: <b>{t(lang, "cloth.tipB")}</b> })}
      </StepHeader>
      <div className="workbench">
        <svg
          ref={svgRef}
          viewBox="0 0 300 300"
          className="aspect-square w-full select-none"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            if (done) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = toLocal(e);
            const a: Active = { x: p.x, y: p.y, a: null, len: 0, creases: [], wrinkle: 0, lastX: p.x, lastY: p.y };
            act.current = a;
            setActive({ ...a });
            sfx.tick();
          }}
          onPointerMove={(e) => {
            const a = act.current;
            if (!a) return;
            const p = toLocal(e);
            const dx = p.x - a.x;
            const dy = p.y - a.y;
            if (a.a == null) {
              if (Math.hypot(dx, dy) < 14) return;
              a.a = Math.atan2(dy, dx);
            }
            const cos = Math.cos(a.a);
            const sin = Math.sin(a.a);
            const along = dx * cos + dy * sin;
            const off = Math.abs(-dx * sin + dy * cos);
            const step = Math.hypot(p.x - a.lastX, p.y - a.lastY);
            a.lastX = p.x;
            a.lastY = p.y;
            loopLevel(Math.min(1, step / 6));
            if (along > a.len) {
              if (off > SLACK) {
                a.wrinkle += (off - SLACK) * 0.0015 * (along - a.len);
                const lastCrease = a.creases[a.creases.length - 1] ?? -99;
                if (along - lastCrease > 12) a.creases.push(along);
              }
              a.len = Math.min(440, along);
            }
            setActive({ ...a, creases: [...a.creases] });
          }}
          onPointerUp={finishStrip}
          onPointerCancel={finishStrip}
        >
          <defs>
            <pattern id="hemp-weave" width="5" height="5" patternUnits="userSpaceOnUse">
              <rect width="5" height="5" fill="#e4d2ab" />
              <path d="M0 1.2 H5 M0 3.7 H5" stroke="#c9b282" strokeWidth="0.9" />
              <path d="M1.2 0 V5 M3.7 0 V5" stroke="#efe2c4" strokeWidth="0.8" opacity="0.9" />
            </pattern>
            <clipPath id="cloth-clip">
              <path d={shapePath} />
            </clipPath>
          </defs>
          <Artwork design={design} surface="wood" showPieces={false} />
          <g opacity="0.3" pointerEvents="none">
            {strips.map((s, i) => (
              <StripGraphic key={i} s={s} fill="url(#hemp-weave)" />
            ))}
          </g>
          <g clipPath="url(#cloth-clip)" pointerEvents="none">
            {strips.map((s, i) => (
              <StripGraphic key={i} s={s} fill="url(#hemp-weave)" />
            ))}
          </g>
          {active && active.a != null && (
            <g pointerEvents="none">
              <StripGraphic s={{ ...active, a: active.a }} fill="url(#hemp-weave)" rolling />
            </g>
          )}
          {active && <circle cx={active.x} cy={active.y} r="4" fill="#d9b25f" stroke="#fff" strokeWidth="1.2" />}
        </svg>
      </div>
      <div className="panel flex flex-col gap-2 py-3">
        <Meter
          value={stats.covered}
          color="var(--mint-deep)"
          label={
            <>
              <span>{t(lang, "cloth.good")}</span>
              <span>{Math.round(stats.covered * 100)}%</span>
            </>
          }
        />
        <Meter
          value={Math.min(1, stats.wrinkle + stats.thick * 2)}
          color="var(--red)"
          label={
            <>
              <span>{t(lang, "cloth.over")}</span>
              <span>{t(lang, "cloth.count", { n: strips.length })}</span>
            </>
          }
        />
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <Btn variant="cream" size="lg" disabled={!strips.length || done} onClick={() => setStrips((s) => s.slice(0, -1))}>
          {t(lang, "cloth.undo")}
        </Btn>
        <Btn
          variant="mint"
          size="lg"
          disabled={!ready || done}
          onClick={() => {
            setDone(true);
            onDone(score());
          }}
        >
          {ready ? t(lang, "common.done") : t(lang, "common.doneMore")}
        </Btn>
      </div>
    </div>
  );
}
