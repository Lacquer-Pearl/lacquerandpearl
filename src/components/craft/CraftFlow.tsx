"use client";

import WorkshopNav, { type WorkshopExit } from "@/components/WorkshopNav";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Artwork from "@/components/Artwork";
import UiIcon, { STEP_ICONS } from "@/components/UiIcon";
import { Btn, Modal, TopBar } from "@/components/ui";
import { LACQUERS } from "@/lib/data";
import {
  artworkValue,
  GRADE_INFO,
  gradeOf,
  reputationGain,
  scoreCraft,
  scoreDesign,
  topMotif,
  uid,
  type Artwork as ArtworkT,
  type Design,
  type PlacedPiece,
  type StepId,
  type StepScores,
} from "@/lib/game";
import { artworkTitle, lacquerName, stepName, t, tNode, type Locale } from "@/lib/i18n";
import { sfx } from "@/lib/sound";
import { clearCraftBoot, pearlStock, setCraftBoot, takeCraftBoot, useSave, useUI, type CraftProgress } from "@/lib/store";
import { clearDevProgress, devProgress, writeDevProgress } from "@/lib/devCraft";
import type { PieceCutResult, RecutSession } from "@/lib/cutFragments";
import type { ShellPlan } from "@/lib/shellNest";
import AttachStep from "./AttachStep";
import NestStep, { motifPolygons } from "./NestStep";
import ClothStep from "./ClothStep";
import CutStep from "./CutStep";
import DesignStep, { type DesignCheckpoint } from "./DesignStep";
import { TutorialStage } from "./common";
import DryStep from "./DryStep";
import PaintStep, { type PaintStepDef } from "./PaintStep";
import type { PaintStats } from "./PaintCanvas";
import PeelStep from "./PeelStep";
import { piecesAt, piecesRegion } from "./pieceRegion";

/** 다림질은 붙인 자개와 이 둘레(작품 좌표)까지만 센다 */
const IRON_MARGIN = 6;

const STEPS: ("design" | StepId)[] = ["design", "cloth", "lacquer", "dry", "cut", "attach", "iron", "peel", "fill", "sand"];

function paintDefs(design: Design, lang: Locale): Record<"lacquer" | "iron" | "fill" | "sand", PaintStepDef> {
  const lac = LACQUERS[design.lacquer];
  return {
    lacquer: {
      title: t(lang, "lacquer.title", { name: lacquerName(lang, design.lacquer) }),
      icon: STEP_ICONS.lacquer,
      tip: (
        <>
          {tNode(lang, "lacquer.tip", {
            b1: <b>{t(lang, "lacquer.tipB1")}</b>,
            b2: <b>{t(lang, "lacquer.tipB2")}</b>,
          })}
        </>
      ),
      config: {
        brushRadius: 22,
        // 한 획을 더 진하게. opaqueAt≈range[0] → 삼베가 안 비칠 때부터 '고르게'
        passAmount: 0.82,
        range: [0.52, 3.1],
        // 알맞음과 흘러내림이 겹치지 않게 과다 기준을 충분히 올림
        over: 3.7,
        opaqueAt: 0.52,
        mode: "paint",
        color: lac.color,
        overColor: lac.deep,
        overStyle: "drip",
        sound: "brush",
        tool: "brush",
        // 한 번 적신 붓이 마를 때까지의 총량. 0.9887 ≈ √0.9775 → 이전 대비 약 2배
        inkDecay: 0.9887,
      },
      thinLabel: t(lang, "lacquer.thin"),
      goodLabel: t(lang, "lacquer.good"),
      overLabel: t(lang, "lacquer.over"),
      minTouched: 0.75,
      score: (s) => s.inRange * 112 - s.over * 160,
    },
    iron: {
      title: t(lang, "iron.title"),
      icon: STEP_ICONS.iron,
      tip: (
        <>
          {tNode(lang, "iron.tip", {
            b1: <b>{t(lang, "iron.tipB1")}</b>,
            b2: <b>{t(lang, "iron.tipB2")}</b>,
          })}
        </>
      ),
      config: {
        brushRadius: 30,
        passAmount: 0.6,
        range: [0.8, 2.1],
        over: 2.8,
        opaqueAt: 1.4,
        mode: "stamp",
        color: "#cdb68a",
        initialFill: "rgba(246,238,220,0.72)",
        overColor: "#6e3f1c",
        overStyle: "none",
        sound: "iron",
        tool: "iron",
        stampRate: 1.1,
        stampLabels: [t(lang, "iron.stageLoose"), t(lang, "iron.stageGood"), t(lang, "iron.stageBurnt")],
        lift: true,
      },
      thinLabel: t(lang, "iron.thin"),
      goodLabel: t(lang, "iron.good"),
      overLabel: t(lang, "iron.over"),
      minTouched: 0.75,
      score: (s) => s.inRange * 110 - s.over * 150,
    },
    fill: {
      title: t(lang, "fill.title"),
      icon: STEP_ICONS.fill,
      tip: <>{tNode(lang, "fill.tip", { b: <b>{t(lang, "fill.tipB")}</b> })}</>,
      config: {
        brushRadius: 22,
        passAmount: 0.8,
        range: [0.5, 3.3],
        over: 4.1,
        inkDecay: 0.994,
        opaqueAt: 0.5,
        mode: "paint",
        color: lac.color,
        overColor: lac.deep,
        overStyle: "drip",
        sound: "brush",
        tool: "brush",
      },
      thinLabel: t(lang, "fill.thin"),
      goodLabel: t(lang, "fill.good"),
      overLabel: t(lang, "fill.over"),
      minTouched: 0.75,
      score: (s) => s.inRange * 108 - s.over * 90,
    },
    sand: {
      title: t(lang, "sand.title"),
      icon: STEP_ICONS.sand,
      tip: (
        <>
          {tNode(lang, "sand.tip", {
            b1: <b>{t(lang, "sand.tipB1")}</b>,
            b2: <b>{t(lang, "sand.tipB2")}</b>,
          })}
        </>
      ),
      config: {
        brushRadius: 20,
        // 한 획이 덜 깎이게 해서, 알맞게 드러나기까지 갈아내는 횟수를 늘린다
        passAmount: 0.34,
        range: [0.55, 2.7],
        // 알맞음과 과함이 겹치지 않게, 옻칠과 같은 비율로 과다 기준을 올림
        over: 3.4,
        opaqueAt: 0.7,
        mode: "erase",
        color: lac.color,
        initialFill: lac.color,
        overColor: "#d8d0c8",
        overStyle: "haze",
        sound: "sand",
        tool: "stone",
      },
      thinLabel: t(lang, "sand.thin"),
      goodLabel: t(lang, "sand.good"),
      overLabel: t(lang, "sand.over"),
      minTouched: 0.75,
      score: (s) => s.inRange * 112 - s.over * 170,
    },
  };
}

function cheer(lang: Locale, score: number) {
  if (score >= 90) return t(lang, "craft.cheer90");
  if (score >= 75) return t(lang, "craft.cheer75");
  if (score >= 55) return t(lang, "craft.cheer55");
  return t(lang, "craft.cheerLow");
}

export default function CraftFlow() {
  const lang = useSave((s) => s.lang);
  const commission = useUI((s) => s.commission);
  const draft = useUI((s) => s.draft);
  const setDraft = useUI((s) => s.setDraft);
  const go = useUI((s) => s.go);
  const showResult = useUI((s) => s.showResult);
  const startWorkshop = useSave(s => s.startWorkshop);
  const inventory = useSave((s) => s.inventory);
  const shellLedger = useSave((s) => s.shellLedger);
  const commitShellPlan = useSave((s) => s.commitShellPlan);
  const markShellCut = useSave((s) => s.markShellCut);
  const sealShellPiece = useSave((s) => s.sealShellPiece);
  const finishArtwork = useSave((s) => s.finishArtwork);
  const saveCraftProgress = useSave((s) => s.saveCraftProgress);

  const [resumed] = useState(takeCraftBoot);
  const designCheckpoint = useRef<DesignCheckpoint | null>(null);
  const devSession = process.env.NODE_ENV === "development" && !!resumed?.dev;

  const design: Design = useMemo(
    () =>
      draft ?? {
        shape: commission?.shape ?? "box",
        lacquer: "black",
        pearl: commission?.pearl ?? "white",
        pieces: [],
        lacquerChosen: !commission,
      },
    [draft, commission],
  );

  const [stepIdx, setStepIdx] = useState(() => resumed?.stepIdx ?? 0);
  const [devNonce, setDevNonce] = useState(0);
  const [nestPending, setNestPending] = useState(() => !!resumed?.nestPending);
  const [placed, setPlaced] = useState<PlacedPiece[]>(() => resumed?.placed ?? []);
  const [toast, setToast] = useState<{ score: number; label: string } | null>(null);
  const [exitTo, setExitTo] = useState<WorkshopExit | "title" | null>(null);
  const scores = useRef<StepScores>({ ...(resumed?.scores ?? {}) });
  const sandStats = useRef<PaintStats | null>(
    resumed?.sandOver != null
      ? { touched: 0, thin: 0, inRange: 0, over: resumed.sandOver, mean: 0 }
      : null,
  );
  const placedRef = useRef<PlacedPiece[]>(resumed?.placed ?? []);
  const cutResultsRef = useRef<PieceCutResult[]>(resumed?.cutResults ?? []);
  const planRef = useRef<ShellPlan | undefined>(resumed?.shellPlan);
  const legacyPearl = useRef(!!resumed?.legacyPearlPaid);
  const recutRef = useRef<RecutSession | null>(resumed?.recutSession ?? null);
  const shellStock = pearlStock(inventory);

  const step = STEPS[stepIdx];
  const progressNow = useCallback((session: RecutSession | null): CraftProgress => ({
    design,
    commission,
    stepIdx,
    scores: { ...scores.current },
    placed: placedRef.current,
    cutResults: cutResultsRef.current,
    shellPlan: planRef.current,
    legacyPearlPaid: legacyPearl.current,
    stepModel: "design-nest",
    nestPending,
    recutSession: session ?? undefined,
    sandOver: sandStats.current?.over,
    savedAt: Date.now(),
  }), [design, commission, stepIdx, nestPending]);
  const built: Design = { ...design, pieces: placed.length ? placed : design.pieces };
  const defs = paintDefs(design, lang);

  const complete = useCallback(() => {
    const d: Design = { ...design, pieces: placedRef.current.length ? placedRef.current : design.pieces };
    const designScore = scoreDesign(d, commission);
    const craftScore = scoreCraft(scores.current);
    const total = Math.round(commission ? designScore * 0.4 + craftScore * 0.6 : designScore * 0.25 + craftScore * 0.75);
    const grade = gradeOf(total);
    const sand = scores.current.sand ?? 60;
    const art: ArtworkT = {
      id: uid(),
      createdAt: Date.now(),
      design: d,
      scores: { ...scores.current },
      designScore,
      craftScore,
      total,
      grade,
      commissionId: commission?.id,
      customer: commission?.customer,
      patron: commission?.patron,
      earned: commission ? Math.round(commission.reward * GRADE_INFO[grade].mult) : 0,
      value: artworkValue(d, total),
      sold: !!commission,
      title: artworkTitle(lang, d.shape, d.lacquer, topMotif(d)),
      gloss: 0.25 + (sand / 100) * 0.6,
      dull: Math.min(0.7, (sandStats.current?.over ?? 0) * 2.5),
    };
    if (process.env.NODE_ENV === "development" && devSession) {
      clearDevProgress();
      clearCraftBoot();
      showResult(art);
      return;
    }
    clearCraftBoot();
    showResult(finishArtwork(art, reputationGain(grade, !!commission)));
  }, [design, commission, finishArtwork, showResult, lang, devSession]);

  const stepRef = useRef(step);
  const completeRef = useRef(complete);
  useEffect(() => {
    stepRef.current = step;
    completeRef.current = complete;
  });

  const finishedStep = useRef<StepId | null>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [stepIdx, nestPending]);

  useEffect(() => {
    if (!devSession) {
      if (stepIdx > 0) saveCraftProgress(progressNow(recutRef.current));
      return;
    }
    const payload = { ...progressNow(recutRef.current), dev: true as const };
    writeDevProgress(payload);
    setCraftBoot(payload);
  }, [stepIdx, progressNow, devSession, saveCraftProgress]);

  const jumpDev = (index: number) => {
    if (process.env.NODE_ENV !== "development" || !devSession) return;
    const progress = devProgress(index, design);
    planRef.current = progress.shellPlan;
    cutResultsRef.current = progress.cutResults ?? [];
    placedRef.current = progress.placed;
    legacyPearl.current = false;
    recutRef.current = null;
    scores.current = { ...progress.scores };
    sandStats.current = null;
    finishedStep.current = null;
    setPlaced(progress.placed);
    setNestPending(false);
    setDraft(progress.design);
    setCraftBoot(writeDevProgress(progress));
    if (index === stepIdx) setDevNonce((n) => n + 1);
    else setStepIdx(index);
  };

  const onStepDone = useCallback((score: number) => {
    const id = stepRef.current as StepId;
    if (finishedStep.current === id) return;
    finishedStep.current = id;
    scores.current[id] = score;
    if (!devSession) useSave.getState().learn(id);
    setToast({ score, label: cheer(lang, score) });
    if (score >= 75) sfx.success();
    else sfx.pop();
    setTimeout(() => {
      setToast(null);
      if (id === "sand") completeRef.current();
      else setStepIdx((i) => i + 1);
    }, 1500);
  }, [lang, devSession]);

  const onCutDone = useCallback(
    (score: number, results: PieceCutResult[]) => {
      cutResultsRef.current = results;
      onStepDone(score);
    },
    [onStepDone],
  );

  const onAttachDone = useCallback(
    (score: number, p: PlacedPiece[]) => {
      placedRef.current = p;
      setPlaced(p);
      onStepDone(score);
    },
    [onStepDone],
  );

  const ironRegion = useMemo(
    () => (step === "iron" ? piecesRegion(placed.length ? placed : design.pieces) : null),
    [step, placed, design.pieces],
  );

  const onIronSlide = useCallback(
    (at: { x: number; y: number }, dx: number, dy: number) => {
      const pieces = placedRef.current.length ? placedRef.current : design.pieces;
      const top = piecesAt(pieces, at.x, at.y)[0];
      if (!top) return;
      const next = pieces.map((piece) =>
        piece.id === top.id
          ? { ...piece, x: Math.max(10, Math.min(290, piece.x + dx)), y: Math.max(10, Math.min(290, piece.y + dy)) }
          : piece,
      );
      placedRef.current = next;
      setPlaced(next);
    },
    [design.pieces],
  );

  const onPaintDone = useCallback(
    (score: number, stats: PaintStats) => {
      const stage = stepRef.current;
      if (stage === "sand") sandStats.current = stats;
      if (stage === "lacquer" || stage === "fill" || stage === "iron" || stage === "sand") {
        const finish = { ...design.finish, [stage]: stats.marks ?? [] };
        if (stage === "sand") finish.unpolished = stats.unpolished;
        setDraft({ ...design, finish });
      }
      onStepDone(score);
    },
    [onStepDone, design, setDraft],
  );

  return (
    <div className="screen craft-screen">
      <TopBar
        title={commission ? t(lang, "craft.commission") : t(lang, "craft.free")}
        onBack={() => {
          if (toast) return;
          if (stepIdx === 0) {
            if (process.env.NODE_ENV === "development" && devSession) {
              writeDevProgress({ ...progressNow(recutRef.current), dev: true });
            }
            setDraft(undefined);
            clearCraftBoot();
            go(devSession || !commission ? "title" : "board");
          } else setExitTo("title");
        }}
      />
      <WorkshopNav onLeaveCraft={target => {
        if (toast) return;
        if (stepIdx > 0) setExitTo(target);
        else {
          const checkpoint = designCheckpoint.current;
          setCraftBoot({ ...progressNow(null), shellPlan: checkpoint?.plan, designStage: checkpoint?.stage, dev: devSession });
          setDraft(design);
          go(target);
        }
      }} />
      <div className="steps-bar">
        {STEPS.map((s, i) => {
          const className = `step-dot ${i < stepIdx ? "done" : i === stepIdx ? "now" : ""}`;
          if (process.env.NODE_ENV === "development" && devSession) {
            return (
              <button
                key={s}
                type="button"
                className={className}
                title={stepName(lang, s)}
                aria-current={i === stepIdx ? "step" : undefined}
                onClick={() => jumpDev(i)}
              >
                <UiIcon id={STEP_ICONS[s]} />
              </button>
            );
          }
          return (
            <div key={s} className={className} title={stepName(lang, s)} aria-current={i === stepIdx ? "step" : undefined}>
              <UiIcon id={STEP_ICONS[s]} />
            </div>
          );
        })}
      </div>
      <div className="workshop-stage-label">{stepIdx + 1} / {STEPS.length} · {stepName(lang, step)}</div>
      {process.env.NODE_ENV === "development" && devSession && (
        <p className="dev-step-hint">
          {lang === "en" ? "Dev test · tap a stage to jump · " : "개발자 시험 · 단계를 누르면 이동합니다 · "}
          {stepName(lang, step)}
        </p>
      )}

      <TutorialStage.Provider value={step}><div className="screen-body" key={process.env.NODE_ENV === "development" && devSession ? `${step}-${devNonce}` : step}>
        {step === "design" && (
          <DesignStep
            design={design}
            setDesign={setDraft}
            commission={commission}
            ledger={shellLedger}
            stock={shellStock}
            initialPlan={planRef.current}
            initialStage={resumed?.designStage}
            checkpoint={designCheckpoint}
            onStart={(plan) => {
              if (!devSession) {
                const result = startWorkshop({ ...progressNow(null), stepIdx: 1, shellPlan: plan },
                  placement => motifPolygons(placement.motifId));
                if (!result.ok) return result;
                useSave.getState().learn("design");
              }
              sfx.success();
              clearCraftBoot();
              planRef.current = { ...plan, confirmed: true };
              legacyPearl.current = false;
              setNestPending(false);
              setDraft(design);
              setStepIdx(1);
              return { ok: true };
            }}
          />
        )}
        {step === "cloth" && <ClothStep design={design} onDone={(score, creases) => {
          setDraft({ ...design, finish: { ...design.finish, creases } });
          onStepDone(score);
        }} />}
        {step === "lacquer" && (
          <PaintStep
            def={defs.lacquer}
            shape={design.shape}
            background={<Artwork design={design} surface="hemp" showPieces={false} className="h-full w-full" />}
            onDone={onPaintDone}
          />
        )}
        {step === "dry" && <DryStep design={design} onDone={onStepDone} />}
        {step === "cut" && nestPending && (
          <NestStep
            design={design}
            ledger={shellLedger}
            stock={shellStock}
            legacyPrepaid={legacyPearl.current}
            orderPearl={commission?.pearl}
            initial={planRef.current}
            onChange={(plan) => {
              planRef.current = plan;
            }}
            onConfirm={(plan) => {
              const result = commitShellPlan(
                plan,
                (placement) => motifPolygons(placement.motifId),
                legacyPearl.current,
                design.pieces.map((piece) => piece.id),
              );
              if (!result.ok) return result;
              planRef.current = { ...plan, confirmed: true };
              setNestPending(false);
              return { ok: true };
            }}
          />
        )}
        {step === "cut" && !nestPending && (
          <CutStep
            design={design}
            placements={planRef.current?.placements}
            saved={cutResultsRef.current}
            ledger={shellLedger}
            stock={shellStock}
            session={recutRef.current}
            onPiece={(results) => {
              cutResultsRef.current = [...results];
              if (!devSession) saveCraftProgress(progressNow(null));
            }}
            onPieceCut={markShellCut}
            onSeal={(pieceId) => {
              sealShellPiece(pieceId);
              if (!planRef.current) return;
              planRef.current = {
                ...planRef.current,
                placements: planRef.current.placements.filter((item) => item.pieceId !== pieceId),
              };
            }}
            onSession={(next) => {
              recutRef.current = next;
              const payload = { ...progressNow(next), dev: devSession || undefined };
              if (process.env.NODE_ENV === "development" && devSession) writeDevProgress(payload);
              else saveCraftProgress(payload);
            }}
            onCommitPlan={(plan, pieceId) => {
              if (process.env.NODE_ENV !== "development" || !devSession) {
                const result = commitShellPlan(plan, (placement) => motifPolygons(placement.motifId), false, [pieceId]);
                if (!result.ok) return result;
              }
              const kept = (planRef.current?.placements ?? []).filter((item) => item.pieceId !== pieceId);
              const known = new Set((planRef.current?.sheets ?? []).map((sheet) => sheet.id));
              planRef.current = {
                sheets: [...(planRef.current?.sheets ?? []), ...plan.sheets.filter((sheet) => !known.has(sheet.id))],
                placements: [...kept, ...plan.placements.filter((item) => item.pieceId === pieceId)],
                confirmed: true,
              };
              return { ok: true };
            }}
            onShop={() => {
              const payload = { ...progressNow(recutRef.current), dev: devSession || undefined };
              if (process.env.NODE_ENV === "development" && devSession) {
                setCraftBoot(writeDevProgress(payload));
              } else {
                saveCraftProgress(payload);
                setCraftBoot(payload);
              }
              setDraft(design);
              go("shop");
            }}
            onPause={() => {
              const payload = { ...progressNow(recutRef.current), dev: devSession || undefined };
              if (process.env.NODE_ENV === "development" && devSession) writeDevProgress(payload);
              else saveCraftProgress(payload);
              clearCraftBoot();
              setDraft(undefined);
              go("title");
            }}
            onDone={onCutDone}
          />
        )}
        {step === "attach" && <AttachStep design={design} cuts={cutResultsRef.current} onDone={onAttachDone} />}
        {step === "iron" && (
          <PaintStep
            def={defs.iron}
            shape={design.shape}
            background={<Artwork design={built} className="h-full w-full" gloss={0.1} />}
            region={ironRegion}
            regionMargin={IRON_MARGIN}
            onSlide={onIronSlide}
            onDone={onPaintDone}
          />
        )}
        {step === "peel" && <PeelStep design={built} onDone={onStepDone} />}
        {step === "fill" && (
          <PaintStep
            def={defs.fill}
            shape={design.shape}
            background={<Artwork design={built} className="h-full w-full" gloss={0.1} />}
            onDone={onPaintDone}
          />
        )}
        {step === "sand" && (
          <PaintStep
            def={defs.sand}
            shape={design.shape}
            background={<Artwork design={built} className="h-full w-full" gloss={0.8} />}
            onDone={onPaintDone}
          />
        )}
      </div></TutorialStage.Provider>

      {toast && (
        <div className="score-toast-wrap">
          <div className="score-toast pop-in">
            <div className="text-5xl">{toast.score}</div>
            <div className="text-lg">{toast.label}</div>
          </div>
        </div>
      )}

      {exitTo && (
        <Modal onClose={() => setExitTo(null)}>
          <div className="flex flex-col gap-3 text-center">
            <div className="flex justify-center">
              <UiIcon id="chest" className="ui-icon-xl" />
            </div>
            <p className="text-lg text-[var(--brown)]">
              {t(lang, "craft.quitAsk")}
              <br />
              <small>{t(lang, "craft.quitWarn")}</small>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="cream" onClick={() => setExitTo(null)}>
                {t(lang, "craft.continue")}
              </Btn>
              <Btn
                variant="pink"
                onClick={() => {
                  const payload = { ...progressNow(recutRef.current), dev: devSession || undefined };
                  if (process.env.NODE_ENV === "development" && devSession) {
                    writeDevProgress(payload);
                  } else saveCraftProgress(payload);
                  clearCraftBoot();
                  setDraft(undefined);
                  go(exitTo);
                }}
              >
                {t(lang, "craft.quit")}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
