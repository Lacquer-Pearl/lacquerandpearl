"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MotifMasks, NacreDefs, NacrePiece, SheenGradient, motifMask } from "@/components/Artwork";
import { TOOL_TIP, ToolGraphic } from "@/components/Tools";
import { Btn, Meter } from "@/components/ui";
import { MOTIFS, PEARLS, motifCutFit, motifCutRoutes, type CuttingMethod, type MotifId, type PearlId } from "@/lib/data";
import { cutJobs, type Design } from "@/lib/game";
import { motifName, pearlName, t, tNode } from "@/lib/i18n";
import { loopLevel, sfx, startLoop, stopLoop } from "@/lib/sound";
import { useSave } from "@/lib/store";
import MotifIcon from "@/components/MotifIcon";
import UiIcon from "@/components/UiIcon";
import { StepHeader } from "./common";

type Method = "jul" | "kkeun" | "auto";
type Choice = Method | "each";

export default function CutStep({ design, onDone }: { design: Design; onDone: (score: number) => void }) {
  const lang = useSave((s) => s.lang);
  const jobs = useMemo(() => cutJobs(design), [design]);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [jobIdx, setJobIdx] = useState(0);
  const scores = useRef<number[]>([]);
  const job = jobs[Math.min(jobIdx, jobs.length - 1)];

  const finishJob = useCallback(
    (score: number) => {
      scores.current.push(score);
      if (scores.current.length < jobs.length) {
        setJobIdx(scores.current.length);
        return;
      }
      const avg = scores.current.reduce((a, b) => a + b, 0) / scores.current.length;
      onDone(Math.round(avg));
    },
    [jobs.length, onDone],
  );

  const prefs = [...new Set(jobs.map((item) => MOTIFS[item.motif].cutting.preferredMethod))];
  const known = prefs.filter((item): item is CuttingMethod => item != null);
  const allKnown = jobs.every((item) => MOTIFS[item.motif].cutting.preferredMethod);
  const recommended = allKnown && known.length === 1 ? known[0] : null;
  const openNames = [
    ...new Set(jobs.filter((item) => !MOTIFS[item.motif].cutting.preferredMethod).map((item) => motifName(lang, item.motif))),
  ];

  if (!choice)
    return (
      <div className="flex flex-col gap-3">
        <StepHeader title={t(lang, "cut.title")} icon="fretsaw">
          {tNode(lang, "cut.tip", { b: <b>{t(lang, "cut.tipB")}</b> })}
        </StepHeader>
        {jobs.length > 1 && (
          <div className="panel py-2 text-center text-sm text-[var(--brown)]">
            {t(lang, "cut.round", {
              n: 1,
              max: jobs.length,
              motif: motifName(lang, jobs[0].motif),
              pearl: pearlName(lang, jobs[0].pearl),
            })}
          </div>
        )}
        {recommended && (
          <p className="panel py-2 text-center text-sm text-[var(--brown)]">
            {t(lang, "cut.recommendOne", { method: t(lang, recommended === "jul" ? "cut.jul" : "cut.kkeun") })}
          </p>
        )}
        {allKnown && known.length > 1 && (
          <p className="panel py-2 text-center text-sm text-[var(--brown)]">{t(lang, "cut.recommendMixed")}</p>
        )}
        {openNames.length > 0 && (
          <p className="panel py-2 text-center text-sm text-[var(--brown)]">{t(lang, "cut.recommendOpen", { names: openNames.join(", ") })}</p>
        )}
        {allKnown && (
          <Btn
            variant="pink"
            onClick={() => {
              sfx.click();
              setChoice(recommended ?? "each");
            }}
          >
            {t(lang, "cut.recommendStart")}
          </Btn>
        )}
        {(["jul", "kkeun", "auto"] as Method[])
          .sort((a, b) => Number(b === recommended) - Number(a === recommended))
          .map((id) => (
            <button key={id} className={`method-card ${id === recommended ? "outline outline-2 outline-[var(--gold)]" : ""}`} onClick={() => (sfx.click(), setChoice(id))}>
              <UiIcon id={id === "jul" ? "fretsaw" : id === "kkeun" ? "knife" : "cutter"} />
              <span className="flex flex-col text-left">
                <b className="text-lg">
                  {t(lang, id === "jul" ? "cut.jul" : id === "kkeun" ? "cut.kkeun" : "cut.auto")}
                  {id === recommended && <span className="ml-2 text-sm text-[var(--gold)]">{t(lang, "cut.recommend")}</span>}
                </b>
                <span className="text-sm opacity-80">
                  {t(lang, id === "jul" ? "cut.julDesc" : id === "kkeun" ? "cut.kkeunDesc" : "cut.autoDesc")}
                </span>
              </span>
            </button>
          ))}
      </div>
    );

  const method: Method | null =
    choice === "each" ? (MOTIFS[job.motif].cutting.preferredMethod ?? null) : choice;

  const roundBanner =
    jobs.length > 1 ? (
      <div className="panel py-2 text-center text-sm text-[var(--brown)]">
        {t(lang, "cut.round", {
          n: jobIdx + 1,
          max: jobs.length,
          motif: motifName(lang, job.motif),
          pearl: pearlName(lang, job.pearl),
        })}
      </div>
    ) : null;

  if (method === "jul")
    return (
      <div className="flex flex-col gap-3">
        {roundBanner}
        <JulStep
          key={`${jobIdx}-jul`}
          motif={job.motif}
          pearl={job.pearl}
          onDone={finishJob}
          onAbort={() => setChoice(null)}
        />
      </div>
    );
  if (method === "kkeun")
    return (
      <div className="flex flex-col gap-3">
        {roundBanner}
        <KkeunStep key={`${jobIdx}-kkeun`} motif={job.motif} pearl={job.pearl} onDone={finishJob} />
      </div>
    );
  if (method !== "auto") return null;
  return (
    <div className="flex flex-col gap-3">
      {roundBanner}
      <AutoStep key={`${jobIdx}-auto`} onDone={finishJob} />
    </div>
  );
}

/** 얇게 켠 조각을 이어 붙인 판자개 원판 */
function ShellSheet({ pearl }: { pearl: PearlId }) {
  const outline = "M18 26 H282 Q288 26 288 32 V268 Q288 274 282 274 H18 Q12 274 12 268 V32 Q12 26 18 26 Z";
  return (
    <g>
      <defs>
        <NacreDefs id="shell-nacre" pearl={pearl} scale={3.1} />
        <SheenGradient id="shell-sheen" />
        <filter id="shell-shadow" x="-20%" y="-20%" width="140%" height="150%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <radialGradient id="shell-vignette" cx="0.42" cy="0.36" r="0.75">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#1a100a" stopOpacity="0.35" />
        </radialGradient>
      </defs>
      <path d={outline} transform="translate(3 8)" fill="#0a0503" opacity="0.6" filter="url(#shell-shadow)" />
      <path d={outline} transform="translate(0 2.5)" fill="#5c5249" />
      <path d={outline} fill="url(#shell-nacre)" />
      <path d={outline} fill="url(#shell-sheen)" />
      <path d={outline} fill="url(#shell-vignette)" />
      <path d={outline} fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="1" />
    </g>
  );
}

function samplePath(d: string, scale: number, cx: number, cy: number, ox: number, oy: number, step = 3) {
  if (typeof document === "undefined") return [];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.style.position = "absolute";
  svg.style.visibility = "hidden";
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", d);
  svg.appendChild(p);
  document.body.appendChild(svg);
  const len = p.getTotalLength();
  const pts: { x: number; y: number }[] = [];
  if (len <= 0) {
    svg.remove();
    return pts;
  }
  const n = Math.max(20, Math.round((len * scale) / step));
  for (let i = 0; i <= n; i++) {
    const pt = p.getPointAtLength((i / n) * len);
    pts.push({ x: cx + (pt.x - ox) * scale, y: cy + (pt.y - oy) * scale });
  }
  svg.remove();
  return pts;
}

type CutRoute = { id: string; d: string; pts: { x: number; y: number }[] };

export function JulStep({
  motif,
  pearl,
  onDone,
  onAbort,
}: {
  motif: MotifId;
  pearl: PearlId;
  onDone: (s: number) => void;
  onAbort: () => void;
}) {
  const lang = useSave((s) => s.lang);
  const fit = useMemo(() => motifCutFit(motif), [motif]);
  const routes = useMemo<CutRoute[]>(
    () =>
      motifCutRoutes(motif)
        .map((cut) => ({
          id: cut.id,
          d: cut.d,
          pts: samplePath(cut.d, fit.scale, 150, 150, fit.ox, fit.oy, 4),
        }))
        .filter((route) => route.pts.length >= 2),
    [motif, fit],
  );
  const [routeIdx, setRouteIdx] = useState(0);
  const [phase, setPhase] = useState<"saw" | "hop">("saw");
  const [debug, setDebug] = useState(false);
  const [idx, setIdx] = useState(0);
  const [stress, setStress] = useState(0);
  const [breaks, setBreaks] = useState(0);
  const [saw, setSaw] = useState<{ x: number; y: number } | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  /** 심각한 실수·부러짐으로 남은 톱질 잔상 */
  const [scars, setScars] = useState<{ points: { x: number; y: number }[]; kind: "skew" | "crack" }[]>([]);
  const [skewLive, setSkewLive] = useState<{ x: number; y: number }[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const st = useRef({
    route: 0,
    idx: 0,
    phase: "saw" as "saw" | "hop",
    stress: 0,
    err: 0,
    errN: 0,
    off: 0,
    lastT: 0,
    last: null as null | { x: number; y: number },
    down: false,
    done: false,
    breaks: 0,
  });
  const scarsRef = useRef(scars);
  const skewTrail = useRef<{ x: number; y: number }[]>([]);
  const inventory = useSave((s) => s.inventory);
  const pearlMat = PEARLS[pearl].material;
  const motifXf = `translate(150 150) scale(${fit.scale}) translate(${-fit.ox} ${-fit.oy})`;

  const commitScar = (points: { x: number; y: number }[], kind: "skew" | "crack") => {
    if (points.length < 2) return;
    scarsRef.current = [...scarsRef.current, { points: points.map((p) => ({ ...p })), kind }];
    setScars(scarsRef.current);
  };

  const flushSkewTrail = () => {
    if (skewTrail.current.length >= 3) commitScar(skewTrail.current, "skew");
    skewTrail.current = [];
    setSkewLive([]);
  };

  useEffect(() => {
    if (!routes.length) return;
    startLoop("saw");
    loopLevel(0);
    return () => stopLoop();
  }, [routes.length]);

  const finish = () => {
    const s = st.current;
    if (s.done) return;
    s.done = true;
    loopLevel(0);
    const avgErr = s.errN ? s.err / s.errN : 0;
    const score = 100 - avgErr * 3.2 - s.breaks * 18 - Math.min(20, s.off * 0.15);
    sfx.success();
    onDone(Math.round(Math.max(10, Math.min(100, score))));
  };

  const crack = () => {
    const s = st.current;
    // 부러지기 직전까지 오려낸 선 + 빗나간 톱질을 잔상으로 남김
    for (let i = 0; i < s.route; i++) commitScar(routes[i]?.pts ?? [], "crack");
    if (s.phase === "saw") commitScar((routes[s.route]?.pts ?? []).slice(0, s.idx + 1), "crack");
    flushSkewTrail();

    s.breaks++;
    s.route = 0;
    s.idx = 0;
    s.phase = "saw";
    s.stress = 0;
    s.off = 0;
    s.last = null;
    setBreaks(s.breaks);
    setRouteIdx(0);
    setPhase("saw");
    setIdx(0);
    setStress(0);
    sfx.crack();
    setShake(true);
    setTimeout(() => setShake(false), 400);

    // 부러질 때마다 여분 자개 1조각을 낭비(소모)
    const inv = { ...useSave.getState().inventory };
    if (inv[pearlMat] > 0) {
      inv[pearlMat] -= 1;
      useSave.setState({ inventory: inv });
      setWarn(t(lang, "cut.brokeNew", { left: inv[pearlMat] }));
    } else {
      setWarn(t(lang, "cut.brokeNeed"));
    }
    setTimeout(() => setWarn(null), 2200);
    if (s.breaks >= 3) finish();
  };

  const advance = (to: number, err: number, speed: number) => {
    const s = st.current;
    if (s.done) return;
    s.err += err;
    s.errN++;
    // 빠른 톱질 + 선에서 살짝 빗나간 오차도 힘을 키움
    s.stress = Math.max(
      0,
      s.stress * 0.96 + Math.max(0, speed - 0.35) * 0.18 + Math.max(0, err - 9) * 0.028,
    );
    setStress(s.stress);
    loopLevel(Math.min(1, speed * 1.5));
    if (s.stress > 1) {
      crack();
      return;
    }
    if (to > s.idx) {
      if (Math.floor(to / 8) > Math.floor(s.idx / 8)) sfx.cut();
      s.idx = to;
      setIdx(to);
    }
    const count = routes[s.route]?.pts.length ?? 0;
    if (count > 1 && s.idx >= count - 2) {
      if (s.route >= routes.length - 1) finish();
      else {
        s.route += 1;
        s.idx = 0;
        s.phase = "hop";
        s.last = null;
        setRouteIdx(s.route);
        setIdx(0);
        setPhase("hop");
      }
    }
  };

  const toLocal = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 300, y: ((e.clientY - r.top) / r.height) * 300 };
  };

  const enterRoute = (p: { x: number; y: number }) => {
    const s = st.current;
    const pts = routes[s.route]?.pts ?? [];
    const start = pts[0];
    if (!start || Math.hypot(start.x - p.x, start.y - p.y) >= 28) return false;
    let best = 0;
    let bestD = Infinity;
    for (let k = 0; k < Math.min(pts.length, 12); k++) {
      const dist = Math.hypot(pts[k].x - p.x, pts[k].y - p.y);
      if (dist < bestD) {
        bestD = dist;
        best = k;
      }
    }
    s.phase = "saw";
    s.idx = bestD < 28 ? best : 0;
    s.last = p;
    setPhase("saw");
    setIdx(s.idx);
    return true;
  };

  const onMove = (e: React.PointerEvent) => {
    const p = toLocal(e);
    setSaw(p);
    const s = st.current;
    const pts = routes[s.route]?.pts ?? [];
    if (!s.down || s.done || pts.length === 0) return;
    if (s.phase === "hop") {
      enterRoute(p);
      return;
    }
    const now = performance.now();
    const dt = Math.max(1, now - s.lastT);
    const moved = s.last ? Math.hypot(p.x - s.last.x, p.y - s.last.y) : 0;
    s.last = p;
    s.lastT = now;
    const speed = moved / dt;
    let best = -1;
    let bestD = Infinity;
    for (let k = s.idx; k < Math.min(pts.length, s.idx + 10); k++) {
      const d = Math.hypot(pts[k].x - p.x, pts[k].y - p.y);
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    if (bestD < 16) {
      flushSkewTrail();
      advance(best, bestD, speed);
      setWarn((w) => (w?.startsWith("✋") || w?.startsWith("⚠️") ? null : w));
      return;
    }

    // 선에서 벗어난 채 톱질 — 많이 어긋날수록 부러질 힘 급상승 + 잔상
    s.off++;
    const severe = bestD > 26;
    const wild = bestD > 36;
    const drift = Math.max(0, bestD - 14) / 28;
    const drag = Math.max(0, speed - 0.12) * (wild ? 0.55 : severe ? 0.38 : 0.22);
    s.stress = Math.max(0, s.stress * 0.97 + drift * 0.2 + drag);
    if (wild && moved > 1.5) s.stress += 0.16;
    setStress(s.stress);
    loopLevel(Math.min(1, 0.2 + s.stress));

    if (severe && moved > 0.4) {
      const trail = skewTrail.current;
      const last = trail[trail.length - 1];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 1.2) {
        trail.push(p);
        if (trail.length % 2 === 0) setSkewLive([...trail]);
      }
    }

    if (s.stress > 1) {
      crack();
      return;
    }
    if (severe) {
      if (s.off % 10 === 0) setWarn(t(lang, "cut.skewWarn"));
    } else if (s.off % 25 === 0) {
      setWarn(t(lang, "cut.follow"));
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const s = st.current;
    const pts = routes[s.route]?.pts ?? [];
    if (s.done || s.phase === "hop" || pts.length === 0) return;
    const now = performance.now();
    const dt = Math.max(8, now - s.lastT);
    s.lastT = now;
    const amount = Math.min(4, Math.abs(e.deltaY) / 40);
    const speed = (amount * 3) / dt;
    advance(Math.min(pts.length - 1, s.idx + Math.max(1, Math.round(amount))), 2.2, speed * 0.6);
    setSaw(pts[Math.min(pts.length - 1, st.current.idx)]);
  };

  if (!routes.length) {
    return (
      <div className="flex flex-col gap-3">
        <StepHeader title={t(lang, "cut.julTitle")} icon="fretsaw">
          {t(lang, "cut.guideError")}
        </StepHeader>
        <Btn variant="cream" onClick={onAbort}>
          {t(lang, "cut.guideBack")}
        </Btn>
      </div>
    );
  }

  const active = routes[Math.min(routeIdx, routes.length - 1)];
  const sawn = [
    ...routes.slice(0, routeIdx).map((route) => route.pts),
    ...(phase === "saw" ? [active.pts.slice(0, idx + 1)] : []),
  ].filter((part) => part.length > 1);
  const next = phase === "hop" ? active.pts[0] : active.pts[Math.min(active.pts.length - 1, idx + 1)];
  const total = routes.reduce((sum, route) => sum + Math.max(1, route.pts.length - 1), 0);
  const done =
    routes.slice(0, routeIdx).reduce((sum, route) => sum + Math.max(1, route.pts.length - 1), 0) +
    (phase === "saw" ? idx : 0);

  return (
    <div className="flex flex-col gap-3">
      <StepHeader title={t(lang, "cut.julTitle")} icon="fretsaw">
        {tNode(lang, "cut.julTip", {
          name: <b>{motifName(lang, motif)}</b>,
          snap: <b>{t(lang, "cut.snap")}</b>,
        })}
      </StepHeader>
      {process.env.NODE_ENV === "development" && (
        <button type="button" className="self-end text-xs text-[var(--brown)] underline" onClick={() => setDebug((on) => !on)}>
          {t(lang, "cut.debug")}
        </button>
      )}
      {phase === "hop" && (
        <p className="text-center text-sm text-[var(--brown)]">
          {t(lang, "cut.hop", { n: routeIdx + 1, max: routes.length })}
        </p>
      )}
      <div className={`workbench relative ${shake ? "shake" : ""}`}>
        <svg
          ref={svgRef}
          viewBox="0 0 300 300"
          className="aspect-square w-full"
          style={{ touchAction: "none" }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const p = toLocal(e);
            st.current.down = true;
            st.current.last = p;
            st.current.lastT = performance.now();
            if (st.current.phase === "hop") enterRoute(p);
          }}
          onPointerMove={onMove}
          onPointerUp={() => {
            st.current.down = false;
            flushSkewTrail();
            loopLevel(0);
          }}
          onPointerCancel={() => {
            st.current.down = false;
            flushSkewTrail();
          }}
          onPointerLeave={() => setSaw(null)}
          onWheel={onWheel}
        >
          <ShellSheet pearl={pearl} />
          <defs>
            <NacreDefs id="cut-piece-nacre" pearl={pearl} scale={1.4} />
            <MotifMasks id="cut-piece-mask" motifs={[motif]} />
          </defs>
          <g transform={motifXf} opacity="0.95">
            {/* 실제로 오려낼 문양 — 스탬프/패턴도 판 크기에 맞춰 보임 */}
            <NacrePiece
              motif={motif}
              fill="url(#cut-piece-nacre)"
              mask={motifMask("cut-piece-mask", motif)}
              light={0.15}
            />
            {routes.map((route, i) => (
              <path
                key={route.id}
                d={route.d}
                fill="none"
                stroke={i === routeIdx ? "#d9b25f" : "#4a3c38"}
                strokeWidth={(i === routeIdx ? 1.7 : 1.15) / fit.scale}
                strokeDasharray={`${4.5 / fit.scale} ${3 / fit.scale}`}
                opacity={i === routeIdx ? 0.95 : 0.62}
              />
            ))}
          </g>
          {debug &&
            routes.map((route, i) => {
              const start = route.pts[0];
              const end = route.pts[route.pts.length - 1];
              return (
                <g key={`dbg-${route.id}`} className="pointer-events-none">
                  <circle cx={start.x} cy={start.y} r="5" fill="#3ddc7a" stroke="#173222" strokeWidth="1" />
                  <circle cx={end.x} cy={end.y} r="4" fill="#ffb15a" stroke="#3a2412" strokeWidth="1" />
                  <text x={start.x + 7} y={start.y - 6} fontSize="10" fill="#ffe27a">
                    {i + 1} {route.id}
                  </text>
                </g>
              );
            })}
          {/* 심각한 실수·부러짐 잔상 */}
          {scars.map((scar, i) => (
            <polyline
              key={`scar-${i}`}
              points={scar.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={scar.kind === "crack" ? "#7a2e2e" : "#5c4638"}
              strokeOpacity={scar.kind === "crack" ? 0.72 : 0.5}
              strokeWidth={scar.kind === "crack" ? 2.6 : 1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={scar.kind === "skew" ? "4 3" : undefined}
            />
          ))}
          {skewLive.length > 1 && (
            <polyline
              points={skewLive.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="#8a4a3a"
              strokeOpacity="0.65"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="3 2"
            />
          )}
          {sawn.map((part, i) => (
            <polyline
              key={i}
              points={part.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="#2e2422"
              strokeOpacity="0.8"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {next && phase === "saw" && (
            <circle cx={next.x} cy={next.y} r="7" fill="#d9b25f" stroke="#fff" strokeWidth="1.5" className="pulse" />
          )}
          {phase === "hop" && next && (
            <g className="pointer-events-none">
              <circle cx={next.x} cy={next.y} r="14" fill="none" stroke="#3ddc7a" strokeWidth="2" className="pulse" />
              <circle cx={next.x} cy={next.y} r="5" fill="#3ddc7a" stroke="#fff" strokeWidth="1.5" />
              <text x={next.x + 16} y={next.y + 4} fontSize="12" fill="#e7ffe8">
                {routeIdx + 1}
              </text>
            </g>
          )}
          {saw && (
            <g
              transform={`translate(${saw.x - TOOL_TIP.saw[0] * 0.9} ${saw.y - TOOL_TIP.saw[1] * 0.9}) scale(0.9)`}
              className="pointer-events-none"
            >
              <ToolGraphic tool="saw" />
            </g>
          )}
        </svg>
        {warn && <div className="event-toast pop-in">{warn}</div>}
      </div>
      <div className="panel flex flex-col gap-2 py-3">
        <Meter
          value={total > 0 ? done / total : 0}
          color="var(--pink)"
          label={
            <>
              <span>
                {t(lang, "cut.progress")} · {t(lang, "cut.piece", { n: Math.min(routes.length, routeIdx + 1), max: routes.length })}
              </span>
              <span>{total > 0 ? Math.round((done / total) * 100) : 0}%</span>
            </>
          }
        />
        <Meter
          value={Math.min(1, stress)}
          zone={[0, 0.6]}
          color={stress > 0.7 ? "var(--red)" : stress > 0.4 ? "var(--orange)" : "var(--mint-deep)"}
          label={
            <>
              <span>{t(lang, "cut.force")}</span>
              <span>{t(lang, "cut.breaks", { n: breaks, left: inventory[pearlMat] })}</span>
            </>
          }
        />
      </div>
    </div>
  );
}

const KNIFE = 150;

/** 문양의 자개 띠 길이에 맞춘 끊음질 간격. 패턴은 육각 한 변, 띠는 중심선 길이를 토막 낸다. */
function buildKkeun(motif: MotifId) {
  const spec = MOTIFS[motif];
  let total = 0;
  if (spec.kind === "pattern" && spec.tile && spec.cutting.preferredMethod === "kkeun") {
    const side = Math.hypot(spec.tile.a[0], spec.tile.a[1]) / Math.sqrt(3);
    total = side * 6;
  } else {
    const paths = spec.strokes?.length ? spec.strokes.map((stroke) => stroke.d) : motifCutRoutes(motif).map((cut) => cut.d);
    for (const d of paths) {
      const pts = samplePath(d, 1, 0, 0, 0, 0, 2);
      for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
  }
  if (!Number.isFinite(total) || total < 1) total = 72;
  const count = spec.kind === "pattern" ? 6 : Math.max(4, Math.min(9, Math.round(total / 14)));
  const piece = total / count;
  const gap = 52 + Math.min(36, piece * 1.4);
  const marks: number[] = [];
  let x = 248;
  for (let i = 0; i < count; i++) {
    x += gap;
    marks.push(Math.round(x));
  }
  return { count, piece, marks };
}

function KkeunStep({ motif, pearl, onDone }: { motif: MotifId; pearl: PearlId; onDone: (s: number) => void }) {
  const lang = useSave((s) => s.lang);
  const layout = useMemo(() => buildKkeun(motif), [motif]);
  const marks = layout.marks;
  const [offset, setOffset] = useState(0);
  const [results, setResults] = useState<(number | null | undefined)[]>(() => Array(layout.count).fill(undefined));
  const [flash, setFlash] = useState<string | null>(null);
  const [chop, setChop] = useState(false);
  const st = useRef({
    offset: 0,
    results: Array(layout.count).fill(undefined) as (number | null | undefined)[],
    wasted: 0,
    done: false,
  });

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(50, now - last);
      last = now;
      const s = st.current;
      const doneCount = s.results.filter((r) => r !== undefined).length;
      s.offset += dt * (0.09 + doneCount * 0.012);
      for (let i = 0; i < marks.length; i++) {
        if (s.results[i] === undefined && marks[i] - s.offset < KNIFE - 22) {
          s.results[i] = null;
          setResults([...s.results]);
          setFlash(t(lang, "cut.missed"));
          sfx.fail();
          setTimeout(() => setFlash(null), 500);
        }
      }
      setOffset(s.offset);
      if (!s.done && s.results.every((r) => r !== undefined)) {
        s.done = true;
        const vals = s.results.map((r) => (r == null ? 0 : r));
        const score = vals.reduce((a, b) => a + b, 0) / marks.length - s.wasted * 4;
        setTimeout(() => {
          sfx.success();
          onDone(Math.round(Math.max(5, Math.min(100, score))));
        }, 500);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [marks, onDone, lang]);

  const tap = () => {
    const s = st.current;
    if (s.done) return;
    setChop(true);
    setTimeout(() => setChop(false), 120);
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < marks.length; i++) {
      if (s.results[i] !== undefined) continue;
      const d = Math.abs(marks[i] - s.offset - KNIFE);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0 && bestD < 22) {
      const score = Math.max(0, 100 - bestD * 5);
      s.results[best] = score;
      setResults([...s.results]);
      setFlash(bestD < 4 ? t(lang, "cut.perfect") : bestD < 10 ? t(lang, "cut.good") : t(lang, "cut.miss"));
      if (bestD < 4) sfx.shimmer();
      sfx.cut();
    } else {
      s.wasted++;
      setFlash(t(lang, "cut.waste"));
      sfx.crack();
    }
    setTimeout(() => setFlash(null), 450);
  };

  return (
    <div className="flex flex-col gap-3">
      <StepHeader title={t(lang, "cut.kkeunTitle")} icon="knife">
        {tNode(lang, "cut.kkeunTip", { b: <b>{t(lang, "cut.kkeunTipB")}</b> })}
      </StepHeader>
      <div className="panel flex items-center gap-3 py-2">
        <MotifIcon motif={motif} pearl={pearl} className="h-14 w-14 shrink-0" />
        <p className="text-sm text-[var(--brown)]">
          {t(lang, "cut.kkeunLen", { name: motifName(lang, motif), n: layout.count, len: Math.round(layout.piece) })}
        </p>
      </div>
      <div
        className="workbench relative cursor-pointer select-none"
        style={{ touchAction: "manipulation" }}
        onPointerDown={tap}
      >
        <svg viewBox="0 0 300 200" className="w-full">
          <defs>
            <NacreDefs id="kk-nacre" pearl={pearl} scale={0.8} />
          </defs>
          <rect x="0" y="118" width="300" height="62" fill="#5c3f2c" rx="6" />
          <rect x="0" y="118" width="300" height="3" fill="#8a6748" />
          <g transform={`translate(${-offset} 0)`}>
            {(() => {
              const bounds = [300, ...marks, marks[marks.length - 1] + 64];
              return bounds.slice(0, -1).map((from, i) => {
                const to = bounds[i + 1];
                const splitLeft = i > 0 && results[i - 1] !== undefined;
                const splitRight = i < marks.length && results[i] !== undefined;
                const x = from + (splitLeft ? 8 : 0);
                const width = Math.max(6, to - from - (splitLeft ? 8 : 0) - (splitRight ? 8 : 0));
                return (
                  <g key={`piece-${i}`}>
                    <rect x={x} y="101" width={width} height="18" rx="1" fill="#2a2420" />
                    <rect x={x} y="100" width={width} height="17" rx="1" fill="url(#kk-nacre)" />
                    <rect x={x} y="100" width={width} height="1.5" fill="#fff" opacity="0.5" />
                  </g>
                );
              });
            })()}
            {marks.map((mx, i) => (
              <g key={i}>
                <rect
                  x={mx - 2}
                  y="92"
                  width="4"
                  height="30"
                  rx="2"
                  fill={results[i] === undefined ? "#d9b25f" : results[i] === null ? "#a8433b" : "#5b8a74"}
                />
                {results[i] != null && (
                  <text x={mx} y="88" fontSize="11" textAnchor="middle" fill="#f3eadb">
                    {Math.round(results[i] as number)}
                  </text>
                )}
              </g>
            ))}
          </g>
          <g transform={`translate(${KNIFE} ${chop ? 22 : 0})`} style={{ transition: "transform 80ms" }}>
            <path d="M-10 20 L10 20 L6 84 L0 94 L-6 84 Z" fill="#dfe6ee" stroke="#6b7a8a" strokeWidth="2" />
            <rect x="-12" y="4" width="24" height="18" rx="5" fill="#6b4a33" />
          </g>
          <line x1={KNIFE} y1="94" x2={KNIFE} y2="124" stroke="#d9b25f" strokeDasharray="2 2" opacity="0.6" />
        </svg>
        {flash && <div className="event-toast pop-in">{flash}</div>}
      </div>
      <div className="panel py-3 text-center text-[var(--brown)]">
        {t(lang, "cut.pieces", { n: results.filter((r) => r != null).length, max: layout.count })}
      </div>
      <Btn variant="pink" size="lg" sound={false} onClick={tap}>
        {t(lang, "cut.cutBtn")}
      </Btn>
    </div>
  );
}

function AutoStep({ onDone }: { onDone: (s: number) => void }) {
  const lang = useSave((s) => s.lang);
  const [p, setP] = useState(0);
  useEffect(() => {
    startLoop("saw");
    loopLevel(0.4);
    const id = setInterval(() => {
      setP((v) => {
        const n = v + 4;
        if (n >= 100) {
          clearInterval(id);
          stopLoop();
          setTimeout(() => onDone(66), 200);
        }
        return n;
      });
    }, 60);
    return () => {
      clearInterval(id);
      stopLoop();
    };
  }, [onDone]);
  return (
    <div className="flex flex-col gap-3">
      <StepHeader title={t(lang, "cut.autoTitle")} icon="gear">
        {t(lang, "cut.autoTip")}
      </StepHeader>
      <div className="workbench flex aspect-square items-center justify-center text-7xl">
        <UiIcon id="gear" className="spin ui-icon-2xl" />
      </div>
      <div className="panel py-3">
        <Meter
          value={p / 100}
          color="var(--blue)"
          label={
            <>
              <span>{t(lang, "cut.autoProgress")}</span>
              <span>{p}%</span>
            </>
          }
        />
      </div>
    </div>
  );
}
