"use client";

import { useEffect, useRef, useState } from "react";
import Artwork from "@/components/Artwork";
import { Btn, Meter } from "@/components/ui";
import type { Design } from "@/lib/game";
import { t as tr, tNode } from "@/lib/i18n";
import { sfx } from "@/lib/sound";
import { useSave } from "@/lib/store";
import { StepHeader } from "./common";

const H_ZONE: [number, number] = [70, 85];
const T_ZONE: [number, number] = [20, 30];
const TICK = 100;

type Phase = "open" | "closing" | "inside";

/** "이모지\n라벨" 형태의 사전 문자열을 두 줄 버튼 라벨로 */
function NudgeLabel({ text }: { text: string }) {
  const [emoji, label] = text.split("\n");
  return (
    <>
      {emoji}
      <br />
      <small>{label}</small>
    </>
  );
}

export default function DryStep({ design, onDone }: { design: Design; onDone: (score: number) => void }) {
  const lang = useSave((s) => s.lang);
  const [phase, setPhase] = useState<Phase>("open");
  const [running, setRunning] = useState(false);
  const [h, setH] = useState(52);
  const [t, setT] = useState(15);
  const [progress, setProgress] = useState(0);
  const [event, setEvent] = useState<string | null>(null);
  const stats = useRef({ ticks: 0, good: 0 });
  const live = useRef({ h: 52, t: 15, p: 0 });
  const finished = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const s = live.current;
      s.h += (45 - s.h) * 0.012 + (Math.random() - 0.55) * 1.4;
      s.t += (14 - s.t) * 0.01 + (Math.random() - 0.5) * 0.5;
      if (Math.random() < 0.012) {
        const ev = Math.random() < 0.5 ? "dry" : "hot";
        if (ev === "dry") {
          s.h -= 12;
          setEvent(tr(lang, "dry.wind"));
        } else {
          s.t += 5;
          setEvent(tr(lang, "dry.sun"));
        }
        sfx.fail();
        setTimeout(() => setEvent(null), 1800);
      }
      s.h = Math.max(20, Math.min(100, s.h));
      s.t = Math.max(5, Math.min(40, s.t));
      const inH = s.h >= H_ZONE[0] && s.h <= H_ZONE[1];
      const inT = s.t >= T_ZONE[0] && s.t <= T_ZONE[1];
      const good = inH && inT;
      stats.current.ticks++;
      if (good) stats.current.good++;
      s.p += good ? 0.9 : inH || inT ? 0.3 : 0.08;
      setH(s.h);
      setT(s.t);
      setProgress(s.p);
      if (s.p >= 100 && !finished.current) {
        finished.current = true;
        setRunning(false);
        const { ticks, good: g } = stats.current;
        sfx.success();
        onDone(Math.round(Math.min(100, (g / ticks) * 115)));
      }
    }, TICK);
    return () => clearInterval(id);
  }, [running, onDone, lang]);

  const nudge = (dh: number, dt: number) => {
    live.current.h = Math.max(20, Math.min(100, live.current.h + dh));
    live.current.t = Math.max(5, Math.min(40, live.current.t + dt));
    setH(live.current.h);
    setT(live.current.t);
    sfx.bubble();
  };

  const closeDoors = () => {
    if (phase !== "open") return;
    setPhase("closing");
    sfx.click();
    window.setTimeout(() => {
      setPhase("inside");
      setRunning(true);
      sfx.place();
    }, 1100);
  };

  const inH = h >= H_ZONE[0] && h <= H_ZONE[1];
  const inT = t >= T_ZONE[0] && t <= T_ZONE[1];
  const inside = phase === "inside";

  return (
    <div className="flex flex-col gap-3">
      <StepHeader title={tr(lang, "dry.title")} emoji="🌡️">
        {phase === "open" ? (
          <>{tNode(lang, "dry.tipOpen", { b: <b>{tr(lang, "dry.tipOpenB")}</b> })}</>
        ) : phase === "closing" ? (
          <>{tr(lang, "dry.tipClosing")}</>
        ) : (
          <>
            {tNode(lang, "dry.tip", {
              b: <b>{tr(lang, "dry.tipB")}</b>,
              h: <b>70~85%</b>,
              t: <b>20~30℃</b>,
            })}
          </>
        )}
      </StepHeader>
      <div className="workbench relative">
        <div className={`cabinet ${phase}${inside && inT ? " warm" : ""}`}>
          <div className="cabinet-chamber">
            <Artwork design={design} showPieces={false} className="h-full w-full" shadow={false} gloss={inside ? 0.35 : 0.2} />
            {inside && inH && running && <div className="steam">💨</div>}
            {inside && inH && running && <div className="cabinet-mist" />}
          </div>
          <div className="cabinet-door left" aria-hidden>
            <span className="cabinet-handle" />
          </div>
          <div className="cabinet-door right" aria-hidden>
            <span className="cabinet-handle" />
          </div>
        </div>
        {event && <div className="event-toast pop-in">{event}</div>}
      </div>
      {inside ? (
        <div className="panel flex flex-col gap-3 py-3">
          <Meter
            value={(h - 20) / 80}
            zone={[(H_ZONE[0] - 20) / 80, (H_ZONE[1] - 20) / 80]}
            color={inH ? "var(--mint-deep)" : "var(--blue)"}
            label={
              <>
                <span>{tr(lang, "dry.humidity")}</span>
                <span>{Math.round(h)}%</span>
              </>
            }
          />
          <Meter
            value={(t - 5) / 35}
            zone={[(T_ZONE[0] - 5) / 35, (T_ZONE[1] - 5) / 35]}
            color={inT ? "var(--mint-deep)" : "var(--orange)"}
            label={
              <>
                <span>{tr(lang, "dry.temp")}</span>
                <span>{t.toFixed(1)}℃</span>
              </>
            }
          />
          <Meter
            value={progress / 100}
            color="var(--gold)"
            label={
              <>
                <span>{tr(lang, "dry.progress")}</span>
                <span>{Math.min(100, Math.round(progress))}%</span>
              </>
            }
          />
        </div>
      ) : (
        <div className="panel py-3 text-center text-sm text-[var(--brown)]">
          {phase === "closing" ? tr(lang, "dry.panelClosing") : tr(lang, "dry.panelOpen")}
        </div>
      )}
      {phase === "open" && (
        <Btn variant="mint" size="lg" onClick={closeDoors}>
          {tr(lang, "dry.start")}
        </Btn>
      )}
      {inside && (
        <div className="grid grid-cols-4 gap-2">
          <Btn size="sm" variant="lavender" sound={false} onClick={() => nudge(6, 0)} disabled={!running}>
            <NudgeLabel text={tr(lang, "dry.humidify")} />
          </Btn>
          <Btn size="sm" variant="cream" sound={false} onClick={() => nudge(-6, 0)} disabled={!running}>
            <NudgeLabel text={tr(lang, "dry.vent")} />
          </Btn>
          <Btn size="sm" variant="pink" sound={false} onClick={() => nudge(0, 2)} disabled={!running}>
            <NudgeLabel text={tr(lang, "dry.heat")} />
          </Btn>
          <Btn size="sm" variant="mint" sound={false} onClick={() => nudge(0, -2)} disabled={!running}>
            <NudgeLabel text={tr(lang, "dry.cool")} />
          </Btn>
        </div>
      )}
    </div>
  );
}
