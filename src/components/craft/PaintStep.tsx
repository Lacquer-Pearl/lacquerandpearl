"use client";

import { useState } from "react";
import { Btn, Meter } from "@/components/ui";
import type { ShapeId } from "@/lib/data";
import { t } from "@/lib/i18n";
import { useSave } from "@/lib/store";
import PaintCanvas, { type PaintConfig, type PaintStats } from "./PaintCanvas";
import { StepHeader } from "./common";

export interface PaintStepDef {
  title: string;
  emoji: string;
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
  const ready = stats.touched >= def.minTouched;

  return (
    <div className="flex flex-col gap-3">
      <StepHeader title={def.title} emoji={def.emoji}>
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
        />
      </div>
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
