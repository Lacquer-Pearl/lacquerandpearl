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
  thinLabel?: string;
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
  region,
  regionMargin,
  onSlide,
  onDone,
}: {
  def: PaintStepDef;
  shape: ShapeId;
  background: React.ReactNode;
  foreground?: React.ReactNode;
  region?: Path2D | null;
  regionMargin?: number;
  onSlide?: (at: { x: number; y: number }, dx: number, dy: number) => void;
  onDone: (score: number, stats: PaintStats) => void;
}) {
  const lang = useSave((s) => s.lang);
  const [stats, setStats] = useState<PaintStats>({ touched: 0, thin: 0, inRange: 0, over: 0, mean: 0 });
  const [done, setDone] = useState(false);
  const inkRef = useRef(0);
  const [ink, setInk] = useState(0);
  const [dipping, setDipping] = useState(false);
  const ready = stats.touched >= def.minTouched;
  const usesInk = !!def.config.inkDecay;
  const showMap = def.config.mode !== "stamp";

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
      {stats.touched === 0 && <p className="demo-hint">{usesInk && !ink ? (lang === "ko" ? "먼저 붓을 옻에 적셔 주세요." : "Dip your brush first.") : def.config.mode === "erase" ? (lang === "ko" ? "숫돌로 문질러 자개를 드러내세요. 빛이 나면 옆으로 옮기세요." : "Rub until the shell shines, then move on.") : def.config.mode === "stamp" ? (lang === "ko" ? "자개 위에 인두를 누른 뒤 적당한 때 떼세요." : "Press the iron onto the shell, then lift.") : (lang === "ko" ? "작업면에 붓을 대고 한 획을 그으세요." : "Draw a stroke across the surface.")}</p>}
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
          region={region}
          regionMargin={regionMargin}
          onSlide={onSlide}
        />
      </div>
      {usesInk && (
        <div className="panel flex items-center gap-3 py-2">
          <button
            className={`lacquer-bowl ${dipping ? "dip" : ""}`}
            onClick={dip}
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
        {showMap && (
          <div className="paint-quality-legend" aria-hidden="true">
            <span className="paint-quality-swatch thin">{t(lang, "paint.legendThin")}</span>
            <span className="paint-quality-swatch good">{t(lang, "paint.legendGood")}</span>
            <span className="paint-quality-swatch over">{t(lang, "paint.legendOver")}</span>
          </div>
        )}
        <Meter
          value={stats.touched}
          color="var(--gold-deep)"
          target={def.minTouched}
          label={
            <>
              <span>{t(lang, "paint.covered")}</span>
              <span>
                {ready
                  ? t(lang, "paint.goalReached")
                  : t(lang, "paint.toGoal", { n: Math.max(1, Math.ceil((def.minTouched - stats.touched) * 100)) })}
              </span>
            </>
          }
        />
        {def.thinLabel && (
          <Meter
            value={stats.thin}
            color="#c4a574"
            label={
              <>
                <span>{def.thinLabel}</span>
                <span>{Math.round(stats.thin * 100)}%</span>
              </>
            }
          />
        )}
        <Meter
          value={stats.inRange}
          color="#7a9a8a"
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
            color="#6e3228"
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
