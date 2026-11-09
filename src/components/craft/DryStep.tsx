"use client";

import { useEffect, useRef, useState } from "react";
import Artwork from "@/components/Artwork";
import { Btn, Meter } from "@/components/ui";
import type { Design } from "@/lib/game";
import { sfx } from "@/lib/sound";
import { StepHeader } from "./common";

const H_ZONE: [number, number] = [70, 85];
const T_ZONE: [number, number] = [20, 30];
const TICK = 100;

export default function DryStep({ design, onDone }: { design: Design; onDone: (score: number) => void }) {
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
          setEvent("🌬️ 바람이 들어와 습도가 떨어졌어요!");
        } else {
          s.t += 5;
          setEvent("☀️ 햇볕이 들어 온도가 올라갔어요!");
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
  }, [running, onDone]);

  const nudge = (dh: number, dt: number) => {
    live.current.h = Math.max(20, Math.min(100, live.current.h + dh));
    live.current.t = Math.max(5, Math.min(40, live.current.t + dt));
    setH(live.current.h);
    setT(live.current.t);
    sfx.bubble();
  };

  const inH = h >= H_ZONE[0] && h <= H_ZONE[1];
  const inT = t >= T_ZONE[0] && t <= T_ZONE[1];

  return (
    <div className="flex flex-col gap-3">
      <StepHeader title="옻장에서 건조하기" emoji="🌡️">
        옻칠은 신기하게도 <b>습하고 따뜻한 곳</b>에서 굳는단다. 습도 <b>70~85%</b>, 온도 <b>20~30℃</b>를
        유지하면 빨리, 단단하게 마른단다.
      </StepHeader>
      <div className="workbench relative">
        <div className="cabinet">
          <div className="cabinet-inner">
            <Artwork design={design} showPieces={false} className="h-full w-full" shadow={false} gloss={0.2} />
            {inH && running && <div className="steam">💨</div>}
          </div>
          <div className="cabinet-doors" />
        </div>
        {event && <div className="event-toast pop-in">{event}</div>}
      </div>
      <div className="panel flex flex-col gap-3 py-3">
        <Meter
          value={(h - 20) / 80}
          zone={[(H_ZONE[0] - 20) / 80, (H_ZONE[1] - 20) / 80]}
          color={inH ? "var(--mint-deep)" : "var(--blue)"}
          label={
            <>
              <span>💧 습도</span>
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
              <span>🌡️ 온도</span>
              <span>{t.toFixed(1)}℃</span>
            </>
          }
        />
        <Meter
          value={progress / 100}
          color="var(--gold)"
          label={
            <>
              <span>건조 진행</span>
              <span>{Math.min(100, Math.round(progress))}%</span>
            </>
          }
        />
      </div>
      {!running && progress === 0 ? (
        <Btn variant="mint" size="lg" onClick={() => setRunning(true)}>
          옻장 문 닫고 건조 시작!
        </Btn>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          <Btn size="sm" variant="lavender" sound={false} onClick={() => nudge(6, 0)} disabled={!running}>
            💧<br />
            <small>가습</small>
          </Btn>
          <Btn size="sm" variant="cream" sound={false} onClick={() => nudge(-6, 0)} disabled={!running}>
            🌬️<br />
            <small>환기</small>
          </Btn>
          <Btn size="sm" variant="pink" sound={false} onClick={() => nudge(0, 2)} disabled={!running}>
            🔥<br />
            <small>불 지피기</small>
          </Btn>
          <Btn size="sm" variant="mint" sound={false} onClick={() => nudge(0, -2)} disabled={!running}>
            ❄️<br />
            <small>식히기</small>
          </Btn>
        </div>
      )}
    </div>
  );
}
