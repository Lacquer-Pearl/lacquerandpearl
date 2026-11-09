"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Artwork from "@/components/Artwork";
import { Btn, Modal, TopBar } from "@/components/ui";
import { LACQUERS, SHAPES } from "@/lib/data";
import {
  artworkValue,
  GRADE_INFO,
  gradeOf,
  scoreCraft,
  scoreDesign,
  STEP_INFO,
  titleFor,
  uid,
  type Artwork as ArtworkT,
  type Design,
  type PlacedPiece,
  type StepId,
  type StepScores,
} from "@/lib/game";
import { sfx } from "@/lib/sound";
import { useSave, useUI } from "@/lib/store";
import AttachStep from "./AttachStep";
import CutStep from "./CutStep";
import DesignStep from "./DesignStep";
import DryStep from "./DryStep";
import PaintStep, { type PaintStepDef } from "./PaintStep";
import type { PaintStats } from "./PaintCanvas";
import PeelStep from "./PeelStep";

const STEPS: ("design" | StepId)[] = ["design", "cloth", "lacquer", "dry", "cut", "attach", "iron", "peel", "fill", "sand"];

function paintDefs(design: Design): Record<"cloth" | "lacquer" | "iron" | "fill" | "sand", PaintStepDef> {
  const lac = LACQUERS[design.lacquer];
  return {
    cloth: {
      title: "백골에 삼베 바르기",
      emoji: "🧵",
      tip: (
        <>
          나무 틀(백골)에 생칠을 먹이고 <b>삼베</b>를 붙이면 나무가 뒤틀리거나 갈라지지 않는단다. 빈틈없이
          골고루 덮어 보렴.
        </>
      ),
      config: {
        brushRadius: 28,
        passAmount: 1,
        range: [0.45, 99],
        over: 99,
        opaqueAt: 0.6,
        mode: "pattern",
        color: "#ead9b9",
        overColor: "#000",
        overStyle: "spot",
        sound: "brush",
        tool: "spatula",
      },
      goodLabel: "삼베로 덮은 면적",
      minTouched: 0.35,
      score: (s) => s.inRange * 108,
    },
    lacquer: {
      title: `${lac.name} 하기`,
      emoji: "🖌️",
      tip: (
        <>
          옻칠은 <b>얇고 고르게</b>가 생명이란다. 두 번쯤 겹쳐 칠하면 딱 좋지만, 한곳만 너무 칠하면{" "}
          <b>흘러내려</b> 자국이 남는단다.
        </>
      ),
      config: {
        brushRadius: 22,
        passAmount: 0.6,
        range: [0.8, 1.9],
        over: 2.5,
        opaqueAt: 0.9,
        mode: "paint",
        color: lac.color,
        overColor: "#120c0d",
        overStyle: "drip",
        sound: "brush",
        tool: "brush",
      },
      goodLabel: "고르게 칠한 면적",
      overLabel: "흘러내린 곳",
      minTouched: 0.4,
      score: (s) => s.inRange * 112 - s.over * 160,
    },
    iron: {
      title: "유산지 대고 다림질",
      emoji: "♨️",
      tip: (
        <>
          자개 위에 유산지를 덮고 인두로 <b>골고루</b> 눌러 주렴. 그래야 자개가 바닥에 착 달라붙는단다. 한곳에
          오래 대면 <b>눌어붙어</b> 버린단다!
        </>
      ),
      config: {
        brushRadius: 24,
        passAmount: 0.6,
        range: [0.8, 2.1],
        over: 2.8,
        opaqueAt: 1.4,
        mode: "paint",
        color: "#cdb68a",
        initialFill: "rgba(246,238,220,0.72)",
        overColor: "#6e3f1c",
        overStyle: "spot",
        sound: "iron",
        tool: "iron",
      },
      goodLabel: "고르게 다린 면적",
      overLabel: "눌은 자국",
      minTouched: 0.4,
      score: (s) => s.inRange * 110 - s.over * 150,
    },
    fill: {
      title: "메움칠",
      emoji: "🫙",
      tip: (
        <>
          붙인 자개 위까지 옻칠을 <b>한 번 더 덮어</b> 틈을 메우는 거란다. 자개가 안 보여도 걱정 말렴, 나중에
          갈아내면 다시 나타난단다.
        </>
      ),
      config: {
        brushRadius: 22,
        passAmount: 0.65,
        range: [0.7, 2.2],
        over: 2.9,
        opaqueAt: 0.75,
        mode: "paint",
        color: lac.color,
        overColor: "#120c0d",
        overStyle: "drip",
        sound: "brush",
        tool: "brush",
      },
      goodLabel: "메운 면적",
      overLabel: "뭉친 곳",
      minTouched: 0.4,
      score: (s) => s.inRange * 108 - s.over * 90,
    },
    sand: {
      title: "갈아내기 (연마)",
      emoji: "✨",
      tip: (
        <>
          숫돌로 살살 갈아내면 덮였던 자개가 <b>영롱하게</b> 드러난단다. 하지만 <b>너무 많이 갈면</b> 자개 광택이
          죽어 버리니 적당히 멈추렴!
        </>
      ),
      config: {
        brushRadius: 20,
        passAmount: 0.5,
        range: [0.55, 1.5],
        over: 2,
        opaqueAt: 0.7,
        mode: "erase",
        color: lac.color,
        initialFill: lac.color,
        overColor: "#d8d0c8",
        overStyle: "haze",
        sound: "sand",
        tool: "stone",
      },
      goodLabel: "알맞게 갈아낸 면적",
      overLabel: "너무 갈아낸 곳",
      minTouched: 0.4,
      score: (s) => s.inRange * 112 - s.over * 170,
    },
  };
}

/** 갓 칠한 옻의 젖은 광택 */
function WetSheen({ shape }: { shape: Design["shape"] }) {
  return (
    <svg viewBox="0 0 300 300" className="h-full w-full">
      <defs>
        <clipPath id="wet-clip">
          <path d={SHAPES[shape].path} />
        </clipPath>
        <filter id="wet-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      <g clipPath="url(#wet-clip)">
        <ellipse cx="100" cy="75" rx="100" ry="30" transform="rotate(-28 100 75)" fill="#fff" opacity="0.13" filter="url(#wet-blur)" />
        <path d="M60 95 Q115 50 175 40" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.14" />
      </g>
    </svg>
  );
}

function cheer(score: number) {
  if (score >= 90) return "완벽해요! 🌟";
  if (score >= 75) return "훌륭해요! ✨";
  if (score >= 55) return "좋아요! 👍";
  return "다음엔 더 잘할 수 있어요 💪";
}

export default function CraftFlow() {
  const commission = useUI((s) => s.commission);
  const draft = useUI((s) => s.draft);
  const setDraft = useUI((s) => s.setDraft);
  const go = useUI((s) => s.go);
  const showResult = useUI((s) => s.showResult);
  const consumeFor = useSave((s) => s.consumeFor);
  const finishArtwork = useSave((s) => s.finishArtwork);

  const design: Design = useMemo(
    () =>
      draft ?? {
        shape: commission?.shape ?? "box",
        lacquer: commission?.lacquer ?? "black",
        pearl: commission?.pearl ?? "white",
        pieces: [],
      },
    [draft, commission],
  );

  const [stepIdx, setStepIdx] = useState(0);
  const [placed, setPlaced] = useState<PlacedPiece[]>([]);
  const [toast, setToast] = useState<{ score: number; label: string } | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const scores = useRef<StepScores>({});
  const sandStats = useRef<PaintStats | null>(null);
  const placedRef = useRef<PlacedPiece[]>([]);

  const step = STEPS[stepIdx];
  const built: Design = { ...design, pieces: placed };
  const defs = paintDefs(design);

  const complete = useCallback(() => {
    const d: Design = { ...design, pieces: placedRef.current };
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
      earned: commission ? Math.round(commission.reward * GRADE_INFO[grade].mult) : 0,
      value: artworkValue(d, total),
      sold: !!commission,
      title: titleFor(d),
      gloss: 0.25 + (sand / 100) * 0.6,
      dull: Math.min(0.7, (sandStats.current?.over ?? 0) * 2.5),
    };
    finishArtwork(art, Math.round(GRADE_INFO[grade].rep * (commission ? 1 : 0.5)));
    showResult(art);
  }, [design, commission, finishArtwork, showResult]);

  const stepRef = useRef(step);
  const completeRef = useRef(complete);
  useEffect(() => {
    stepRef.current = step;
    completeRef.current = complete;
  });

  const onStepDone = useCallback((score: number) => {
    const id = stepRef.current as StepId;
    scores.current[id] = score;
    setToast({ score, label: cheer(score) });
    if (score >= 75) sfx.success();
    else sfx.pop();
    setTimeout(() => {
      setToast(null);
      if (id === "sand") completeRef.current();
      else setStepIdx((i) => i + 1);
    }, 1500);
  }, []);

  const onAttachDone = useCallback(
    (score: number, p: PlacedPiece[]) => {
      placedRef.current = p;
      setPlaced(p);
      onStepDone(score);
    },
    [onStepDone],
  );

  const onPaintDone = useCallback(
    (score: number, stats: PaintStats) => {
      if (stepRef.current === "sand") sandStats.current = stats;
      onStepDone(score);
    },
    [onStepDone],
  );

  return (
    <div className="screen">
      <TopBar
        title={commission ? "의뢰 제작" : "자유 디자인"}
        onBack={() => {
          if (stepIdx === 0) {
            setDraft(undefined);
            go(commission ? "board" : "title");
          } else setConfirmExit(true);
        }}
      />
      <div className="steps-bar">
        {STEPS.map((s, i) => (
          <div key={s} className={`step-dot ${i < stepIdx ? "done" : i === stepIdx ? "now" : ""}`} title={s === "design" ? "디자인" : STEP_INFO[s].name}>
            {s === "design" ? "✏️" : STEP_INFO[s].emoji}
          </div>
        ))}
      </div>

      <div className="screen-body" key={step}>
        {step === "design" && (
          <DesignStep
            design={design}
            setDesign={setDraft}
            commission={commission}
            onStart={() => {
              if (!consumeFor(design)) return;
              sfx.success();
              setDraft(design);
              setStepIdx(1);
            }}
          />
        )}
        {step === "cloth" && (
          <PaintStep
            def={defs.cloth}
            shape={design.shape}
            background={<Artwork design={design} surface="wood" showPieces={false} className="h-full w-full" />}
            onDone={onPaintDone}
          />
        )}
        {step === "lacquer" && (
          <PaintStep
            def={defs.lacquer}
            shape={design.shape}
            background={<Artwork design={design} surface="hemp" showPieces={false} className="h-full w-full" />}
            foreground={<WetSheen shape={design.shape} />}
            onDone={onPaintDone}
          />
        )}
        {step === "dry" && <DryStep design={design} onDone={onStepDone} />}
        {step === "cut" && <CutStep design={design} onDone={onStepDone} />}
        {step === "attach" && <AttachStep design={design} onDone={onAttachDone} />}
        {step === "iron" && (
          <PaintStep
            def={defs.iron}
            shape={design.shape}
            background={<Artwork design={built} className="h-full w-full" gloss={0.1} />}
            onDone={onPaintDone}
          />
        )}
        {step === "peel" && <PeelStep design={built} onDone={onStepDone} />}
        {step === "fill" && (
          <PaintStep
            def={defs.fill}
            shape={design.shape}
            background={<Artwork design={built} className="h-full w-full" gloss={0.1} />}
            foreground={<WetSheen shape={design.shape} />}
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
      </div>

      {toast && (
        <div className="score-toast-wrap">
          <div className="score-toast pop-in">
            <div className="text-5xl">{toast.score}</div>
            <div className="text-lg">{toast.label}</div>
          </div>
        </div>
      )}

      {confirmExit && (
        <Modal onClose={() => setConfirmExit(false)}>
          <div className="flex flex-col gap-3 text-center">
            <div className="text-5xl">😢</div>
            <p className="text-lg text-[var(--brown)]">
              작업을 그만둘까요?
              <br />
              <small>이미 사용한 재료는 돌려받을 수 없어요.</small>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="cream" onClick={() => setConfirmExit(false)}>
                계속하기
              </Btn>
              <Btn
                variant="pink"
                onClick={() => {
                  setDraft(undefined);
                  go("title");
                }}
              >
                그만두기
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
