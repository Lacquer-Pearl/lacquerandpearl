"use client";

import { useRef, useState } from "react";
import type { UiIconId } from "@/components/UiIcon";
import { Btn, Meter } from "@/components/ui";
import type { ShapeId } from "@/lib/data";
import { t } from "@/lib/i18n";
import { sfx } from "@/lib/sound";
import { useSave } from "@/lib/store";
import PaintCanvas, { type PaintConfig, type PaintStats } from "./PaintCanvas";
import { StepHeader } from "./common";

export interface PaintStepDef {
  title: string;
  icon: UiIconId;
  tip: React.ReactNode;
  config: PaintConfig;
  goodLabel: string;
  overLabel?: string;
  /** 완료 버튼 활성 조건 */
  minTouched: number;
  score: (s: PaintStats) => number;
}

export default function PaintStep({
  def,
  shape,
  background,
  foreground,
  onDone,
}: {
  def: PaintStepDef;
  shape: ShapeId;
  background: React.ReactNode;
  foreground?: React.ReactNode;
  onDone: (score: number, stats: PaintStats) => void;
}) {
  const lang = useSave((s) => s.lang);
  const [stats, setStats] = useState<PaintStats>({ touched: 0, inRange: 0, over: 0, mean: 0 });
  const [done, setDone] = useState(false);
  const inkRef = useRef(0);
  const [ink, setInk] = useState(0);
  const [dipping, setDipping] = useState(false);
  const ready = stats.touched >= def.minTouched;
  const usesInk = !!def.config.inkDecay;

  const dip = () => {
    if (done) return;
    inkRef.current = 1;
    setInk(1);
    setDipping(true);
    sfx.bubble();
    setTimeout(() => setDipping(false), 380);
  };

  return (
    <div className="flex flex-col gap-3">
      <StepHeader title={def.title} icon={def.icon}>
        {def.tip}
      </StepHeader>
      <div className="workbench">
        <PaintCanvas
          shape={shape}
          config={def.config}
          background={background}
          foreground={foreground}
          onStats={setStats}
          disabled={done}
          inkRef={usesInk ? inkRef : undefined}
          ink={ink}
          onInk={setInk}
        />
      </div>
      {usesInk && (
        <div className="panel flex items-center gap-3 py-2">
          <button
            className={`lacquer-bowl ${dipping ? "dip" : ""}`}
            onPointerDown={dip}
            aria-label={t(lang, "lacquer.dip")}
            disabled={done}
          >
            <svg viewBox="0 0 64 44" className="h-11 w-16">
              <ellipse cx="32" cy="14" rx="28" ry="9" fill="#3a2418" />
              <path d="M4 14 Q6 40 32 41 Q58 40 60 14 Z" fill="#7a4a2a" />
              <path d="M8 18 Q12 36 32 37" stroke="#a46c42" strokeWidth="2" fill="none" opacity="0.6" />
              <ellipse cx="32" cy="14" rx="24" ry="7" fill={def.config.color} />
              <ellipse cx="24" cy="12" rx="8" ry="2" fill="#fff" opacity="0.18" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <Meter
              value={ink}
              color={ink < 0.15 ? "var(--red)" : "var(--gold-deep)"}
              label={
                <>
                  <span>{t(lang, "lacquer.load")}</span>
                  <span>{ink < 0.03 ? t(lang, "lacquer.empty") : `${Math.round(ink * 100)}%`}</span>
                </>
              }
            />
            <div className="mt-1 text-xs text-[var(--brown-light)]">{t(lang, "lacquer.dipHint")}</div>
          </div>
        </div>
      )}
      <div className="panel flex flex-col gap-2 py-3">
        <Meter
          value={stats.inRange}
          color="var(--mint-deep)"
          label={
            <>
              <span>{def.goodLabel}</span>
              <span>{Math.round(stats.inRange * 100)}%</span>
            </>
          }
        />
        {def.overLabel && (
          <Meter
            value={Math.min(1, stats.over * 4)}
            color="var(--red)"
            label={
              <>
                <span>{def.overLabel}</span>
                <span>{Math.round(stats.over * 100)}%</span>
              </>
            }
          />
        )}
      </div>
      <Btn
        variant="mint"
        size="lg"
        disabled={!ready || done}
        onClick={() => {
          setDone(true);
          onDone(Math.max(0, Math.min(100, Math.round(def.score(stats)))), stats);
        }}
      >
        {ready ? t(lang, "common.done") : t(lang, "common.doneMore")}
      </Btn>
    </div>
  );
}
