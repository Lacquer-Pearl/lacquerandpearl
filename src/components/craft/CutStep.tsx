"use client";

import { useContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MotifMasks, NacreDefs, NacrePiece, PieceGraphics, SheenGradient, motifMask } from "@/components/Artwork";
import { TOOL_TIP, ToolGraphic, WorkPoint } from "@/components/Tools";
import { Btn, Meter } from "@/components/ui";
import {
  breakStateFrom,
  evaluateBreak,
  hashSeed,
  intactResult,
  nextCutAttempt,
  pathToPolygons,
  screenToMotif,
  shellThickness,
  type PieceCutResult,
  type RecutSession,
} from "@/lib/cutFragments";
import { MOTIFS, motifCutFit, motifCutRoutes, motifLocalBox, type CuttingMethod, type MotifId, type PearlId } from "@/lib/data";
import { cutJobs, type Design } from "@/lib/game";
import type { ShellLedger, ShellPlacement, ShellPlan, ShellStock } from "@/lib/shellNest";
import RecutPanel from "./RecutPanel";
import { motifName, pearlName, t, tNode } from "@/lib/i18n";
import { loopLevel, sfx, startLoop, stopLoop } from "@/lib/sound";
import { MACHINE_CUT_COST, useSave } from "@/lib/store";
import MotifIcon from "@/components/MotifIcon";
import UiIcon from "@/components/UiIcon";
import LessonGate, { LessonPaused } from "./LessonGate";
import BenchLayout from "./BenchLayout";
import { StepHeader, TutorialStage } from "./common";
import { claimCraftPointer, releaseCraftPointer, useBlockCraftScroll } from "./craftTouch";

type SawPoint = { x: number; y: number };
type SawCursor = SawPoint & { contact?: SawPoint; loupeX?: number };
type SawPhase = "ready" | "saw";

function gripBelow(point: SawPoint) {
  return { x: point.x, y: Math.min(point.y + 38, 284) };
}

type Method = "jul" | "kkeun" | "auto";
type Choice = Method | "each";

export default function CutStep({
  design,
  onDone,
  saved,
  onPiece,
  placements = [],
  onPieceCut,
  ledger = { sheets: [] },
  stock = {},
  session = null,
  onSession,
  onSeal,
  onCommitPlan,
  onShop,
  onPause,
}: {
  design: Design;
  onDone: (score: number, results: PieceCutResult[]) => void;
  saved?: PieceCutResult[];
  onPiece?: (results: PieceCutResult[]) => void;
  placements?: ShellPlacement[];
  onPieceCut?: (pieceId: string) => void;
  ledger?: ShellLedger;
  stock?: ShellStock;
  session?: RecutSession | null;
  onSession?: (session: RecutSession | null) => void;
  onSeal?: (pieceId: string) => void;
  onCommitPlan?: (plan: ShellPlan, pieceId: string) => { ok: true } | { ok: false; missing: PearlId };
  onShop?: () => void;
  onPause?: () => void;
}) {
  const lang = useSave((s) => s.lang);
  const jobs = useMemo(() => cutJobs(design, placements), [design, placements]);
  const prior = useMemo(
    () =>
      jobs.flatMap((job) => {
        const found = saved?.find((item) => item.pieceId === job.pieceId);
        return found ? [found] : [];
      }),
    [jobs, saved],
  );
  const firstUncut = jobs.findIndex(job => !prior.some(cut => cut.pieceId === job.pieceId));
  const [boot] = useState<RecutSession | null>(() => {
    if (!session || prior.length >= jobs.length) return null;
    const id = jobs[firstUncut]?.pieceId;
    return session.pieceId === id ? session : null;
  });
  const [choice, setChoice] = useState<Choice | null>(null);
  const [jobIdx, setJobIdx] = useState(Math.max(0, firstUncut));
  const [hold, setHold] = useState<PieceCutResult | null>(boot?.pending ?? null);
  const [phase, setPhase] = useState<"saw" | "choose" | "nest">(() => {
    if (!boot) return "saw";
    if (boot.mode === "saw" || boot.mode === "choose") return boot.mode;
    return "nest";
  });
  const [nestMode, setNestMode] = useState<"manual" | "auto" | "fresh">(
    boot?.mode === "auto" || boot?.mode === "fresh" || boot?.mode === "manual" ? boot.mode : "manual",
  );
  const [draft, setDraft] = useState<ShellPlan | undefined>(boot?.draft);
  const [attempt, setAttempt] = useState(0);
  const results = useRef<PieceCutResult[]>([...prior]);
  const sent = useRef(false);
  const holdRef = useRef<PieceCutResult | null>(boot?.pending ?? null);
  const extraRef = useRef(boot?.openSheets ?? 0);
  const sealedRef = useRef(!!boot?.sealed);
  const nestModeRef = useRef(nestMode);
  holdRef.current = hold;
  nestModeRef.current = nestMode;
  const job = jobs[Math.min(jobIdx, Math.max(0, jobs.length - 1))];

  useEffect(() => {
    if (!jobs.length || prior.length < jobs.length || sent.current) return;
    sent.current = true;
    const avg = prior.reduce((sum, item) => sum + item.cutScore, 0) / prior.length;
    onDone(Math.round(avg), prior);
  }, [jobs.length, onDone, prior]);

  const finishJob = useCallback(
    (score: number, result?: PieceCutResult) => {
      if (!job || sent.current || results.current.some(cut => cut.pieceId === job.pieceId)) return;
      // Only the fretsaw supplies a cut result. Strip cutting and paid machining stay per piece.
      const completedIds = new Set(results.current.map(cut => cut.pieceId));
      const batch = result ? jobs.filter(item => item.motif === job.motif) : [job];
      for (const item of batch) {
        if (completedIds.has(item.pieceId)) continue;
        const cut = item.pieceId === job.pieceId && result
          ? result
          : intactResult(item.pieceId, item.motif, score);
        results.current.push({ ...cut, cutScore: score });
        completedIds.add(item.pieceId);
        if (item.pieceId !== "fallback") onPieceCut?.(item.pieceId);
      }
      onPiece?.([...results.current]);
      sealedRef.current = false;
      const next = jobs.findIndex(item => !completedIds.has(item.pieceId));
      if (next >= 0) {
        setJobIdx(next);
        return;
      }
      sent.current = true;
      const avg = results.current.reduce((sum, cut) => sum + cut.cutScore, 0) / results.current.length;
      onDone(Math.round(avg), results.current);
    },
    [job, jobs, onDone, onPiece, onPieceCut],
  );

  const publish = useCallback(
    (next: RecutSession | null) => {
      onSession?.(next);
    },
    [onSession],
  );

  const reviewCut = useCallback(
    (score: number, result: PieceCutResult) => {
      const stamped = { ...result, cutScore: score, breaks: result.breaks ?? 0 };
      const prev = holdRef.current;
      if (stamped.condition === "intact" && !prev) return false;
      const combined = prev
        ? nextCutAttempt(prev, stamped, extraRef.current)
        : { ...stamped, firstCutScore: score, recuts: 0, extraSheets: 0 };
      extraRef.current = 0;
      if (stamped.condition === "intact") {
        finishJob(combined.cutScore, combined);
        holdRef.current = null;
        setHold(null);
        setPhase("saw");
        publish(null);
        return true;
      }
      if (stamped.condition === "scrapped") {
        onSeal?.(stamped.pieceId);
        sealedRef.current = true;
      }
      holdRef.current = combined;
      setHold(combined);
      setPhase("choose");
      publish({
        pieceId: stamped.pieceId,
        pending: combined,
        mode: "choose",
        sealed: sealedRef.current,
        openSheets: 0,
      });
      return true;
    },
    [finishJob, onSeal, publish],
  );

  const commitRecut = useCallback(
    (plan: ShellPlan) => {
      const pieceId = holdRef.current?.pieceId;
      if (!pieceId || !holdRef.current) return { ok: false as const, missing: design.pearl };
      const known = new Set(ledger.sheets.map((sheet) => sheet.id));
      const fresh = plan.sheets.filter((sheet) => !known.has(sheet.id)).length;
      const result = onCommitPlan?.(plan, pieceId) ?? { ok: true as const };
      if (!result.ok) return result;
      extraRef.current += fresh;
      setDraft(plan);
      setPhase("saw");
      setAttempt((value) => value + 1);
      publish({
        pieceId,
        pending: holdRef.current,
        mode: "saw",
        sealed: true,
        draft: plan,
        openSheets: extraRef.current,
      });
      return { ok: true as const };
    },
    [design.pearl, ledger.sheets, onCommitPlan, publish],
  );

  const prefs = [...new Set(jobs.map((item) => MOTIFS[item.motif].cutting.preferredMethod))];
  const known = prefs.filter((item): item is CuttingMethod => item != null);
  const allKnown = jobs.every((item) => MOTIFS[item.motif].cutting.preferredMethod);
  const recommended = allKnown && known.length === 1 ? known[0] : null;
  const openNames = [
    ...new Set(jobs.filter((item) => !MOTIFS[item.motif].cutting.preferredMethod).map((item) => motifName(lang, item.motif))),
  ];

  if (jobs.length > 0 && prior.length >= jobs.length) return null;

  const recutPiece = hold ? design.pieces.find((item) => item.id === hold.pieceId) : undefined;
  if (hold && phase !== "saw" && recutPiece) {
    return (
      <RecutPanel
        design={design}
        piece={recutPiece}
        pending={hold}
        ledger={ledger}
        stock={stock}
        mode={phase === "nest" ? nestMode : "choose"}
        draft={draft}
        onMode={(next) => {
          if (next !== "manual" && next !== "auto" && next !== "fresh") {
            setPhase("choose");
            publish({
              pieceId: recutPiece.id,
              pending: hold,
              mode: "choose",
              sealed: sealedRef.current,
              draft,
              openSheets: extraRef.current,
            });
            return;
          }
          if (!sealedRef.current) {
            onSeal?.(recutPiece.id);
            sealedRef.current = true;
          }
          setNestMode(next);
          setDraft(undefined);
          setPhase("nest");
          publish({
            pieceId: recutPiece.id,
            pending: hold,
            mode: next,
            sealed: true,
            openSheets: extraRef.current,
          });
        }}
        onDraft={(plan) => {
          setDraft(plan);
          publish({
            pieceId: recutPiece.id,
            pending: hold,
            mode: nestModeRef.current,
            sealed: sealedRef.current,
            draft: plan,
            openSheets: extraRef.current,
          });
        }}
        onJoin={
          hold.condition === "reusable-broken"
            ? () => {
                finishJob(hold.cutScore, hold);
                holdRef.current = null;
                setHold(null);
                setPhase("saw");
                publish(null);
              }
            : undefined
        }
        onCommit={commitRecut}
        onShop={onShop}
        onPause={onPause}
      />
    );
  }

  const recutSaw = !!hold && phase === "saw";
  if (!choice && !recutSaw)
    return (
      <LessonGate lesson="cut" untilComplete><BenchLayout
        tools={<>
          <StepHeader title={t(lang, "cut.title")} icon="fretsaw">
          {tNode(lang, "cut.tip", { b: <b>{t(lang, "cut.tipB")}</b> })}
        </StepHeader>
          {(["jul", "kkeun", "auto"] as Method[])
          .sort((a, b) => Number(b === recommended) - Number(a === recommended))
          .map((id) => (
            <button key={id} data-lesson={id === "jul" ? "cut" : undefined} className={`method-card ${id === recommended ? "outline outline-2 outline-[var(--gold)]" : ""}`} onClick={() => (sfx.click(), setChoice(id))}>
              <UiIcon id={id === "jul" ? "fretsaw" : id === "kkeun" ? "knife" : "cutter"} />
              <span className="flex flex-col text-left">
                <b className="text-lg">
                  {t(lang, id === "jul" ? "cut.jul" : id === "kkeun" ? "cut.kkeun" : "cut.auto")}
                  {id === recommended && <span className="ml-2 text-sm text-[var(--gold)]">{t(lang, "cut.recommend")}</span>}
                </b>
                <span className="text-sm opacity-80">
                  {t(lang, id === "jul" ? "cut.julDesc" : id === "kkeun" ? "cut.kkeunDesc" : "cut.autoDesc", { n: MACHINE_CUT_COST })}
                </span>
              </span>
            </button>
          ))}
        </>}
        progress={<>
          {jobs.some((job) => job.placement) && <p className="panel py-2 text-sm text-[var(--brown)]">{t(lang, "cut.fromSheet")}</p>}
          {jobs.length > 1 && (
          <div className="panel py-2 text-center text-sm text-[var(--brown)]">
            {t(lang, "cut.round", {
              n: prior.length + 1,
              max: jobs.length,
              motif: motifName(lang, job.motif),
              pearl: pearlName(lang, job.pearl),
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
        </>}
        next={allKnown && (
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
      >
        <div className="workbench cut-preview"><MotifIcon motif={job.motif} pearl={job.pearl} className="w-4/5" /></div>
      </BenchLayout></LessonGate>
    );

  const method: Method | null = recutSaw
    ? "jul"
    : choice === "each"
      ? (MOTIFS[job.motif].cutting.preferredMethod ?? null)
      : choice;

  const roundBanner =
    jobs.length > 1 ? (
      <div className="panel py-2 text-center text-sm text-[var(--brown)]">
        {method === "jul" ? t(lang, "cut.sawBatch", {
          motif: motifName(lang, job.motif),
          n: jobs.filter(item => item.motif === job.motif && !prior.some(cut => cut.pieceId === item.pieceId)).length,
        }) : t(lang, "cut.round", {
          n: prior.length + 1,
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
          key={`${job.pieceId}-${attempt}`}
          motif={job.motif}
          pearl={job.pearl}
          pieceId={job.pieceId}
          onDone={finishJob}
          onReview={reviewCut}
          onAbort={() => setChoice(null)}
        />
      </div>
    );
  if (method === "kkeun")
    return (
      <div className="flex flex-col gap-3">
        {roundBanner}
        <LessonGate lesson="kkeun"><KkeunStep key={`${jobIdx}-kkeun`} motif={job.motif} pearl={job.pearl} onDone={finishJob} /></LessonGate>
      </div>
    );
  if (method !== "auto") return null;
  return (
    <div className="flex flex-col gap-3">
      {roundBanner}
      <LessonGate lesson="auto"><AutoStep key={`${jobIdx}-auto`} onDone={finishJob} onAbort={() => setChoice(null)} /></LessonGate>
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
  pieceId,
  onDone,
  onReview,
  onAbort,
}: {
  motif: MotifId;
  pearl: PearlId;
  pieceId: string;
  onDone: (score: number, result: PieceCutResult) => void;
  onReview?: (score: number, result: PieceCutResult) => boolean;
  onAbort: () => void;
}) {
  const lang = useSave((s) => s.lang);
  const inWorkshop = useContext(TutorialStage) === "cut";
  const learnedStart = useSave(s => s.learned.includes("jul-start"));
  const [started, setStarted] = useState(false);
  const [resumeAfterBreak, setResumeAfterBreak] = useState(false);
  const showStartHelp = !started && !learnedStart;
  const fit = useMemo(() => motifCutFit(motif), [motif]);
  const bounds = useMemo(() => motifLocalBox(motif), [motif]);
  const polygons = useMemo(() => motifCutRoutes(motif).flatMap((cut) => pathToPolygons(cut.d)), [motif]);
  const thickness = MOTIFS[motif].kind === "pattern" ? shellThickness("pattern", false) : shellThickness(MOTIFS[motif].kind, !!MOTIFS[motif].stamp);
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
  const [phase, setPhase] = useState<SawPhase>("ready");
  const [debug, setDebug] = useState(false);
  const [idx, setIdx] = useState(0);
  const [stress, setStress] = useState(0);
  const [breaks, setBreaks] = useState(0);
  const [saw, setSaw] = useState<SawCursor | null>(null);
  const [warn, setWarn] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [breakFx, setBreakFx] = useState<null | { result: PieceCutResult; gap: number }>(null);
  /** 심각한 실수·부러짐으로 남은 톱질 잔상 */
  const [scars, setScars] = useState<{ points: { x: number; y: number }[]; kind: "skew" | "crack" }[]>([]);
  const [skewLive, setSkewLive] = useState<{ x: number; y: number }[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<number | null>(null);
  useBlockCraftScroll(svgRef);
  const st = useRef({
    route: 0,
    idx: 0,
    phase: "ready" as SawPhase,
    touchOffset: null as null | SawPoint,
    loupeX: 6,
    stress: 0,
    err: 0,
    errN: 0,
    off: 0,
    lastT: 0,
    last: null as null | { x: number; y: number },
    down: false,
    done: false,
    breaks: 0,
    breaking: false,
    waste: 0,
    lastErr: 0,
  });
  const pending = useRef<PieceCutResult | null>(null);
  const timers = useRef<number[]>([]);
  const scarsRef = useRef(scars);
  const skewTrail = useRef<{ x: number; y: number }[]>([]);
  const motifXf = `translate(150 150) scale(${fit.scale}) translate(${-fit.ox} ${-fit.oy})`;

  useEffect(() => {
    const pendingTimers = timers.current;
    return () => {
      for (const id of pendingTimers) window.clearTimeout(id);
    };
  }, []);

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
    s.breaking = false;
    loopLevel(0);
    const avgErr = s.errN ? s.err / s.errN : 0;
    const score = Math.round(Math.max(10, Math.min(100, 100 - avgErr * 3.2 - s.breaks * 18 - Math.min(20, s.off * 0.15))));
    if (pending.current?.condition === "scrapped") sfx.fail();
    else sfx.success();
    const result = pending.current
      ? { ...pending.current, cutScore: score, shellWaste: s.waste, breaks: s.breaks }
      : { ...intactResult(pieceId, motif, score, s.waste), breaks: s.breaks };
    if (onReview?.(score, result)) return;
    onDone(score, result);
  };

  // A completed contour disarms both pointer and wheel. Only a fresh press can start another.
  const parkSaw = () => {
    const s = st.current;
    s.phase = "ready";
    s.down = false;
    s.last = null;
    s.touchOffset = null;
    s.stress = 0;
    s.lastErr = 0;
    setPhase("ready");
    setStress(0);
    setSaw(null);
    setWarn(null);
    loopLevel(0);
  };

  const crack = () => {
    const s = st.current;
    if (s.done || s.breaking) return;
    // 재고는 여기서 깎지 않는다. 이어 붙일 수 있으면 자개패를 더 쓰지 않고, 못 쓰는 파손만 재절단한다.
    for (let i = 0; i < s.route; i++) commitScar(routes[i]?.pts ?? [], "crack");
    commitScar((routes[s.route]?.pts ?? []).slice(0, s.idx + 1), "crack");
    flushSkewTrail();

    s.breaking = true;
    s.breaks++;
    s.waste++;
    setBreaks(s.breaks);
    const pts = routes[s.route]?.pts ?? [];
    const at = pts[Math.min(pts.length - 1, Math.max(0, s.idx))] ?? { x: 150, y: 150 };
    const prev = pts[Math.max(0, s.idx - 4)] ?? at;
    const origin = screenToMotif(at, fit);
    const before = screenToMotif(prev, fit);
    const result = evaluateBreak({
      pieceId,
      motifId: motif,
      polygons,
      bounds,
      origin,
      direction: { x: origin.x - before.x, y: origin.y - before.y },
      stress: s.stress,
      error: s.lastErr,
      thickness,
      seed: hashSeed(`${pieceId}:${s.route}:${s.idx}:${Math.round(origin.x * 10)}:${Math.round(origin.y * 10)}`),
      cutScore: 0,
      shellWaste: s.waste,
    });
    sfx.crack();
    loopLevel(0);
    setShake(true);
    timers.current.push(window.setTimeout(() => setShake(false), 400));

    const reusable = result.condition === "reusable-broken";
    const broken = reusable && pending.current ? pending.current : result;
    pending.current = broken;
    setBreakFx({ result: broken, gap: reusable ? 2.6 : 1.45 });
    setWarn(t(lang, reusable ? "cut.reusable" : "cut.scrapped"));
    timers.current.push(window.setTimeout(() => setBreakFx({ result: broken, gap: 1 }), 420));
    timers.current.push(window.setTimeout(() => {
      if (!reusable) {
        finish();
        return;
      }
      s.breaking = false;
      parkSaw();
      setBreakFx(null);
      setResumeAfterBreak(true);
    }, 780));
  };

  const advance = (to: number, err: number, speed: number) => {
    const s = st.current;
    if (s.done || s.breaking || s.phase !== "saw") return;
    s.err += err;
    s.errN++;
    s.lastErr = err;
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
        parkSaw();
        setRouteIdx(s.route);
        setIdx(0);
      }
    }
  };

  const toLocal = (e: React.PointerEvent<SVGSVGElement>): SawPoint => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left) * 300 / r.width, y: (e.clientY - r.top) * 300 / r.height };
  };

  const startStroke = (e: React.PointerEvent<SVGSVGElement>) => {
    const s = st.current;
    if (s.done || s.breaking || !e.isPrimary || e.button !== 0 || gesture.current !== null) return;
    const pts = routes[s.route]?.pts;
    if (!pts?.length) return;
    const target = pts[Math.min(pts.length - 1, s.phase === "ready" ? s.idx : s.idx + 1)];
    const contact = toLocal(e);
    const touch = e.pointerType === "touch";
    const grip = gripBelow(target);
    const near = (point: SawPoint) => Math.hypot(contact.x - point.x, contact.y - point.y);
    const radius = touch ? Math.max(16, 22 * 300 / e.currentTarget.getBoundingClientRect().width) : 16;
    if (near(target) > radius && !(touch && near(grip) <= radius)) return;
    if (!claimCraftPointer(e, gesture)) return;
    if (!started) {
      setStarted(true);
      if (inWorkshop && !learnedStart) useSave.getState().learn("jul-start");
    }
    setResumeAfterBreak(false);
    // Anchor where the player actually grabbed. A direct tap and the offset handle both start on the guide.
    s.touchOffset = touch ? { x: target.x - contact.x, y: target.y - contact.y } : null;
    s.loupeX = target.x < 150 ? 236 : 6;
    s.last = touch ? target : contact;
    s.lastT = performance.now();
    s.down = true;
    s.phase = "saw";
    setPhase("saw");
    setWarn(null);
    setSaw(touch ? { ...target, contact, loupeX: s.loupeX } : contact);
  };

  const endStroke = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!releaseCraftPointer(e, gesture)) return;
    const s = st.current;
    if ((e.pointerType === "touch" || e.type === "pointercancel") && !s.done && !s.breaking) {
      s.phase = "ready";
      setPhase("ready");
    }
    s.down = false;
    s.last = null;
    s.touchOffset = null;
    setSaw(null);
    flushSkewTrail();
    loopLevel(0);
  };

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const s = st.current;
    if (gesture.current !== e.pointerId || !s.down || s.phase !== "saw" || s.breaking || s.done) return;
    const contact = toLocal(e);
    const p = s.touchOffset ? { x: contact.x + s.touchOffset.x, y: contact.y + s.touchOffset.y } : contact;
    const moved = s.last ? Math.hypot(p.x - s.last.x, p.y - s.last.y) : 0;
    if (moved < 0.8) return;
    const pts = routes[s.route].pts;
    if (s.touchOffset && p.y < 80 && Math.abs(p.x - (s.loupeX + 29)) < 50) {
      s.loupeX = s.loupeX === 6 ? 236 : 6;
    }
    setSaw(s.touchOffset ? { ...p, contact, loupeX: s.loupeX } : p);
    const now = performance.now();
    const dt = Math.max(1, now - s.lastT);
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

    s.lastErr = bestD;
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
    if (s.done || s.breaking || s.touchOffset || s.phase !== "saw" || e.ctrlKey || !e.deltaY || pts.length === 0) return;
    const now = performance.now();
    const dt = Math.max(8, now - s.lastT);
    s.lastT = now;
    const amount = Math.min(4, Math.abs(e.deltaY) / 40);
    const speed = (amount * 3) / dt;
    advance(Math.min(pts.length - 1, s.idx + Math.max(1, Math.round(amount))), 2.2, speed * 0.6);
    if (s.phase === "saw" && !s.done && !s.breaking) setSaw(pts[s.idx]);
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
    active.pts.slice(0, idx + 1),
  ].filter((part) => part.length > 1);
  const next = phase === "ready" ? active.pts[idx] : active.pts[Math.min(active.pts.length - 1, idx + 1)];
  const ahead = active.pts[Math.min(active.pts.length - 1, idx + 5)];
  const arrowTransform = `translate(${ahead.x} ${ahead.y}) rotate(${Math.atan2(ahead.y - next.y, ahead.x - next.x) * 180 / Math.PI})`;
  const total = routes.reduce((sum, route) => sum + Math.max(1, route.pts.length - 1), 0);
  const done =
    routes.slice(0, routeIdx).reduce((sum, route) => sum + Math.max(1, route.pts.length - 1), 0) +
    idx;

  return (
    <LessonGate untilComplete showOutsideTutorial={resumeAfterBreak}
      lesson={resumeAfterBreak ? "resumeCut" : showStartHelp && phase === "ready" ? "jul" : undefined}>
    <BenchLayout
      tools={<>
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
        <div className="craft-status-line saw-instruction" aria-live="polite">
          <strong>{t(lang, "cut.piece", { n: routeIdx + 1, max: routes.length })}</strong>
          <div className="saw-cues">
            <span aria-hidden={!showStartHelp || phase !== "ready"}>
              <span className="saw-mouse-copy">{t(lang, "cut.pressStart")}</span>
              <span className="saw-touch-copy">{t(lang, "cut.gripStart")}</span>
            </span>
            <span aria-hidden={phase === "ready"}>
              <span className="saw-mouse-copy">{t(lang, "cut.trace")}</span>
              <span className="saw-touch-copy">{t(lang, "cut.liftHint")}</span>
            </span>
          </div>
        </div>
      </>}
      progress={<>
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
                <span>{t(lang, "cut.breaks", { n: breaks })}</span>
              </>
            }
          />
        </div>
      </>}
    >
      <div className={`workbench relative ${shake ? "shake" : ""}`}>
        <svg
          ref={svgRef}
          viewBox="0 0 300 300"
          className="craft-touch-area saw-board aspect-square w-full"
          data-phase={phase}
          onPointerDown={startStroke}
          onPointerMove={onMove}
          onPointerUp={endStroke}
          onPointerCancel={endStroke}
          onLostPointerCapture={endStroke}
          onWheel={onWheel}
        >
          <ShellSheet pearl={pearl} />
          <defs>
            <NacreDefs id="cut-piece-nacre" pearl={pearl} scale={1.4} />
            <MotifMasks id="cut-piece-mask" motifs={[motif]} />
          </defs>
          <g transform={motifXf} opacity="0.95">
            {breakFx ? (
              <PieceGraphics
                piece={{
                  id: pieceId,
                  motif,
                  x: 0,
                  y: 0,
                  s: 1,
                  r: 0,
                  pearl,
                  breakState: {
                    ...breakStateFrom(breakFx.result),
                    fragments: breakFx.result.fragments.map((frag) => ({
                      ...frag,
                      dx: frag.dx * breakFx.gap,
                      dy: frag.dy * breakFx.gap,
                    })),
                  },
                }}
                fill="url(#cut-piece-nacre)"
                mask={motifMask("cut-piece-mask", motif)}
                light={0.15}
                clipPrefix={`cut-break-${pieceId}`}
              />
            ) : (
              <NacrePiece motif={motif} fill="url(#cut-piece-nacre)" mask={motifMask("cut-piece-mask", motif)} light={0.15} />
            )}
            {!breakFx && routes.map((route, i) => (
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
          {!breakFx && (
            <g pointerEvents="none">
              {!saw && <SawGrip tip={next} contact={gripBelow(next)} />}
              <path d="M-4 -3 L1 0 L-4 3" transform={arrowTransform}
                stroke="#30271e" strokeWidth="4" fill="none" strokeLinejoin="round" />
              <path d="M-4 -3 L1 0 L-4 3" transform={arrowTransform}
                stroke="#fff3ce" strokeWidth="1.6" fill="none" strokeLinejoin="round" />
              <circle cx={next.x} cy={next.y} r={phase === "ready" ? 14 : 5} fill="none" stroke="#242019" strokeWidth="4" />
              <circle cx={next.x} cy={next.y} r={phase === "ready" ? 14 : 5} fill={phase === "ready" ? "#183e3799" : "#edbd59"}
                stroke={phase === "ready" ? "#abe9cd" : "#fff4d5"} strokeWidth="2" className="pulse" />
              {phase === "ready" && <circle cx={next.x} cy={next.y} r="3" fill="#fff7dd" />}
              {saw && (
                <>
                  {saw.contact && <SawGrip tip={saw} contact={saw.contact} active />}
                  <g transform={`translate(${saw.x - TOOL_TIP.saw[0] * 0.75} ${saw.y - TOOL_TIP.saw[1] * 0.75}) scale(.75)`}>
                    <ToolGraphic tool="saw" />
                  </g>
                  <WorkPoint x={saw.x} y={saw.y} />
                  {saw.loupeX !== undefined && (
                    <g transform={`translate(${saw.loupeX} 6)`} aria-hidden="true" data-saw-loupe="">
                      <rect width="58" height="58" rx="8" fill="#28221c" stroke="#eddbb5" strokeWidth="1.5" />
                      <svg x="3" y="3" width="52" height="52" viewBox={`${saw.x - 15} ${saw.y - 15} 30 30`} overflow="hidden">
                        <path d={active.d} transform={motifXf} fill="none" stroke="#e4c98a" strokeWidth={1.2 / fit.scale} />
                        <circle cx={next.x} cy={next.y} r="1.9" fill="#f4c866" />
                        <WorkPoint x={saw.x} y={saw.y} r={3.5} />
                      </svg>
                    </g>
                  )}
                </>
              )}
            </g>
          )}
        </svg>
        {warn && <div role="status" className="event-toast pop-in">{warn}</div>}
      </div>
    </BenchLayout>
    </LessonGate>
  );
}

/** The fingertip and saw tip share the same coordinate mapping as the gesture. */
function SawGrip({ tip, contact, active = false }: { tip: SawPoint; contact: SawPoint; active?: boolean }) {
  return (
    <g className={active ? undefined : "touch-grip"} aria-hidden="true">
      <line x1={tip.x} y1={tip.y} x2={contact.x} y2={contact.y} stroke="#30261b" strokeWidth="3" />
      <line x1={tip.x} y1={tip.y} x2={contact.x} y2={contact.y} stroke="#f9e6bf" strokeWidth="1.4" strokeDasharray="3 2" />
      <g transform={`translate(${contact.x} ${contact.y})`}>
        <circle r="12" fill="#2e261dec" stroke="#f6dfb4" strokeWidth="1.5" />
        <path d="M-3 1 V-6 Q-2 -9 0 -6 V-1 Q2 -4 4 -1 Q6 -3 7 0 Q10 -1 10 3 V6 Q10 10 7 11 H1 L-7 4 Q-9 0 -6 0 Z"
          fill="#ffebc5" stroke="#4b3626" strokeWidth="1.1" strokeLinejoin="round" />
      </g>
    </g>
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
  const paused = useContext(LessonPaused);
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
    if (paused) return;
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
  }, [marks, onDone, lang, paused]);

  const tap = () => {
    if (paused) return;
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
    <BenchLayout
      tools={<>
        <StepHeader title={t(lang, "cut.kkeunTitle")} icon="knife">
          {tNode(lang, "cut.kkeunTip", { b: <b>{t(lang, "cut.kkeunTipB")}</b> })}
        </StepHeader>
        <div className="strip-length panel flex items-center gap-3 py-2">
          <MotifIcon motif={motif} pearl={pearl} className="h-14 w-14 shrink-0" />
          <p className="text-sm text-[var(--brown)]">
            {t(lang, "cut.kkeunLen", { name: motifName(lang, motif), n: layout.count, len: Math.round(layout.piece) })}
          </p>
        </div>
      </>}
      progress={<>
        <div className="panel py-3 text-center text-[var(--brown)]">
          {t(lang, "cut.pieces", { n: results.filter((r) => r != null).length, max: layout.count })}
        </div>
      </>}
      next={<>
        <Btn variant="pink" size="lg" data-lesson="kkeun" sound={false} onClick={tap}>
          {t(lang, "cut.cutBtn")}
        </Btn>
      </>}
    >
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
    </BenchLayout>
  );
}

function AutoStep({ onDone, onAbort }: { onDone: (s: number) => void; onAbort: () => void }) {
  const lang = useSave((s) => s.lang);
  const money = useSave((s) => s.money);
  const payCoins = useSave((s) => s.payCoins);
  const [paid, setPaid] = useState(false);
  if (!paid)
    return (
      <BenchLayout
        tools={<>
          <StepHeader title={t(lang, "cut.autoTitle")} icon="gear">
          {t(lang, "cut.autoTip")}
        </StepHeader>
          <Btn variant="cream" onClick={onAbort}>
          {t(lang, "cut.autoBack")}
        </Btn>
        </>}
        progress={<div className="panel flex flex-col items-center gap-2 py-4 text-center text-[var(--brown)]">
          <p className="text-sm">{t(lang, "cut.autoPay", { n: MACHINE_CUT_COST, money })}</p>
          {money < MACHINE_CUT_COST && <p className="text-sm text-[var(--red)]">{t(lang, "cut.autoPoor")}</p>}
        </div>}
        next={<Btn
          variant="pink"
          size="lg"
          data-lesson="auto" disabled={money < MACHINE_CUT_COST}
          onClick={() => {
            if (!payCoins(MACHINE_CUT_COST)) {
              sfx.fail();
              return;
            }
            sfx.coin();
            setPaid(true);
          }}
        >
          {t(lang, "cut.autoPayBtn", { n: MACHINE_CUT_COST })}
        </Btn>}
      >
        <div className="workbench cut-preview"><UiIcon id="gear" className="ui-icon-2xl" /></div>
      </BenchLayout>
    );
  return <AutoRun onDone={onDone} />;
}

function AutoRun({ onDone }: { onDone: (s: number) => void }) {
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
    <BenchLayout
      tools={<>
        <StepHeader title={t(lang, "cut.autoTitle")} icon="gear">
          {t(lang, "cut.autoTip")}
        </StepHeader>
      </>}
      progress={<>
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
      </>}
    >
      <div className="workbench flex aspect-square items-center justify-center text-7xl">
        <UiIcon id="gear" className="spin ui-icon-2xl" />
      </div>
    </BenchLayout>
  );
}
