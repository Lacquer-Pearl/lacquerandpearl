"use client";

import { useEffect, useRef, useState } from "react";
import Artwork from "@/components/Artwork";
import { Btn, Meter } from "@/components/ui";
import { SHAPES } from "@/lib/data";
import type { Design } from "@/lib/game";
import { t, tNode } from "@/lib/i18n";
import { loopLevel, sfx, startLoop, stopLoop } from "@/lib/sound";
import { useSave } from "@/lib/store";
import { StepHeader } from "./common";
import { claimCraftPointer, isForeignCraftPointer, releaseCraftPointer, useBlockCraftScroll } from "./craftTouch";

export default function PeelStep({ design, onDone }: { design: Design; onDone: (score: number) => void }) {
  const lang = useSave((s) => s.lang);
  const [progress, setProgress] = useState(0);
  const [wet, setWet] = useState(false);
  const [lifts, setLifts] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const st = useRef({ down: false, lastY: 0, lastT: 0, p: 0, lifts: 0, cooldown: 0, done: false, speed: 0 });
  const surfaceRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<number | null>(null);
  useBlockCraftScroll(surfaceRef);
  const [speed, setSpeed] = useState(0);
  const limit = wet ? 1.1 : 0.55;

  useEffect(() => {
    startLoop("peel");
    loopLevel(0);
    return () => stopLoop();
  }, []);

  const onMove = (e: React.PointerEvent) => {
    const s = st.current;
    if (isForeignCraftPointer(e, gesture) || !s.down || s.done) return;
    const r = e.currentTarget.getBoundingClientRect();
    const y = ((e.clientY - r.top) / r.height) * 300;
    const now = performance.now();
    const dy = y - s.lastY;
    const dt = Math.max(1, now - s.lastT);
    s.lastY = y;
    s.lastT = now;
    if (dy <= 0) return;
    const v = dy / dt;
    s.speed = s.speed * 0.6 + v * 0.4;
    setSpeed(s.speed);
    loopLevel(Math.min(1, s.speed));
    if (s.speed > limit && now > s.cooldown) {
      s.lifts++;
      s.cooldown = now + 700;
      setLifts(s.lifts);
      sfx.crack();
      setShake(true);
      setTimeout(() => setShake(false), 350);
      setMsg(wet ? t(lang, "peel.warnWet") : t(lang, "peel.warnDry"));
      setTimeout(() => setMsg(null), 1300);
    }
    s.p = Math.min(1, s.p + dy / 260);
    setProgress(s.p);
    if (s.p >= 1 && !s.done) {
      s.done = true;
      loopLevel(0);
      sfx.success();
      setTimeout(() => onDone(Math.max(15, 100 - s.lifts * 16)), 300);
    }
  };

  const shape = SHAPES[design.shape];
  const top = progress * 300;

  return (
    <div className="flex flex-col gap-3">
      <StepHeader title={t(lang, "peel.title")} icon="hanji">
        {tNode(lang, "peel.tip", {
          b1: <b>{t(lang, "peel.tipB1")}</b>,
          b2: <b>{t(lang, "peel.tipB2")}</b>,
        })}
      </StepHeader>
      <div className={`workbench relative ${shake ? "shake" : ""}`}>
        <div
          ref={surfaceRef}
          className="craft-touch-area relative aspect-square w-full"
          onPointerDown={(e) => {
            if (!claimCraftPointer(e, gesture)) return;
            const r = e.currentTarget.getBoundingClientRect();
            st.current.down = true;
            st.current.lastY = ((e.clientY - r.top) / r.height) * 300;
            st.current.lastT = performance.now();
          }}
          onPointerMove={onMove}
          onPointerUp={(e) => {
            if (!releaseCraftPointer(e, gesture)) return;
            st.current.down = false;
            st.current.speed = 0;
            setSpeed(0);
            loopLevel(0);
          }}
          onPointerCancel={(e) => {
            if (!releaseCraftPointer(e, gesture)) return;
            st.current.down = false;
          }}
          onLostPointerCapture={(e) => {
            if (!releaseCraftPointer(e, gesture)) return;
            st.current.down = false;
            loopLevel(0);
          }}
        >
          <Artwork design={design} className="pointer-events-none absolute inset-0 h-full w-full" gloss={0.2} />
          <svg viewBox="0 0 300 300" className="pointer-events-none absolute inset-0 h-full w-full">
            <defs>
              <clipPath id="peel-clip">
                <path d={shape.path} />
              </clipPath>
            </defs>
            <g clipPath="url(#peel-clip)">
              <rect x="0" y={top} width="300" height={300 - top} fill={wet ? "#e9dcc0" : "#f6eedc"} opacity="0.8" />
              {wet &&
                Array.from({ length: 14 }, (_, i) => (
                  <circle key={i} cx={(i * 47) % 300} cy={top + 20 + ((i * 71) % Math.max(1, 280 - top))} r="3" fill="#cfe9f5" opacity="0.7" />
                ))}
            </g>
            {progress < 1 && (
              <>
                <ellipse cx="150" cy={top} rx="140" ry="9" fill="#fffaf0" stroke="#d9c7b3" strokeWidth="2" />
                <text x="150" y={top + 30} textAnchor="middle" fontSize="22">
                  👇
                </text>
              </>
            )}
          </svg>
        </div>
        {msg && <div className="event-toast pop-in">{msg}</div>}
      </div>
      <div className="panel flex flex-col gap-2 py-3">
        <Meter
          value={progress}
          color="var(--gold)"
          label={
            <>
              <span>{t(lang, "peel.progress")}</span>
              <span>{Math.round(progress * 100)}%</span>
            </>
          }
        />
        <Meter
          value={Math.min(1, speed / (limit * 1.4))}
          zone={[0, 1 / 1.4]}
          color={speed > limit ? "var(--red)" : "var(--mint-deep)"}
          label={
            <>
              <span>{t(lang, "peel.speed")}</span>
              <span>{t(lang, "peel.lifts", { n: lifts })}</span>
            </>
          }
        />
      </div>
      <Btn
        variant="lavender"
        size="lg"
        disabled={wet}
        onClick={() => {
          setWet(true);
          sfx.bubble();
          setTimeout(sfx.bubble, 120);
        }}
      >
        {wet ? t(lang, "peel.wetDone") : t(lang, "peel.wet")}
      </Btn>
    </div>
  );
}
