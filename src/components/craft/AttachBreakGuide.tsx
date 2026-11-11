"use client";

import { useMemo, useState } from "react";
import Artwork from "@/components/Artwork";
import { Modal } from "@/components/ui";
import { breakStateFrom, evaluateBreak, polygonsFromPaths, scoreSeamJoin, type PieceCutResult } from "@/lib/cutFragments";
import { motifCutRoutes, motifLocalBox, type MotifId } from "@/lib/data";
import type { PlacedPiece } from "@/lib/game";
import { motifName, t } from "@/lib/i18n";
import { sfx } from "@/lib/sound";
import { useSave } from "@/lib/store";

function sample(id: MotifId, seed: number): PieceCutResult {
  const bounds = motifLocalBox(id);
  return evaluateBreak({
    pieceId: id,
    motifId: id,
    polygons: polygonsFromPaths(motifCutRoutes(id).map((route) => route.d)),
    bounds,
    origin: { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 },
    direction: { x: 0, y: 1 },
    stress: 1.02,
    error: 6,
    thickness: 0.9,
    seed,
    cutScore: 74,
    shellWaste: 1,
  });
}

function placed(id: string, motif: MotifId, result: PieceCutResult | null, fragments = result?.fragments ?? []): PlacedPiece {
  return {
    id,
    motif,
    x: 150,
    y: 150,
    s: 1.7,
    r: 0,
    pearl: "white",
    breakState: result && result.clips.length ? breakStateFrom(result, fragments) : undefined,
  };
}

function shareOf(result: PieceCutResult) {
  return result.sideShare.map((share) => `${Math.round(share * 100)}%`).join(" / ");
}

/** 디버그 화면에서 파손된 거북이를 바로 붙여 볼 때 쓰는 절단 결과. */
export function practiceTurtleCut() {
  return sample("turtle", 3);
}

export default function AttachBreakGuide() {
  const lang = useSave((s) => s.lang);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const slides = useMemo(() => {
    const turtle = sample("turtle", 3);
    const lotus = sample("lotus", 6);
    const turtleAskew = turtle.fragments.map((frag, i) => (i === 1 ? { ...frag, dx: frag.dx + 7, dy: frag.dy + 2, r: 16 } : frag));
    const turtleWide = turtle.fragments.map((frag) => ({ ...frag, dx: frag.dx * 2.6, dy: frag.dy * 2.6 }));
    const lotusWide = lotus.fragments.map((frag) => ({ ...frag, dx: frag.dx * 2.6, dy: frag.dy * 2.6 }));
    const scrapBounds = motifLocalBox("turtle");
    const scrap = evaluateBreak({
      pieceId: "turtle-scrap",
      motifId: "turtle",
      polygons: polygonsFromPaths(motifCutRoutes("turtle").map((route) => route.d)),
      bounds: scrapBounds,
      origin: { x: scrapBounds.x + scrapBounds.w / 2, y: scrapBounds.y + scrapBounds.h / 2 },
      direction: { x: 0, y: 1 },
      stress: 1.8,
      error: 36,
      thickness: 0.9,
      seed: 1,
      cutScore: 28,
      shellWaste: 2,
    });
    const perfect = Math.round(scoreSeamJoin(turtle.seam, turtle.fragments, turtle.fragments).score);
    const askew = Math.round(scoreSeamJoin(turtle.seam, turtle.fragments, turtleAskew).score);
    const name = (id: MotifId) => motifName(lang, id);
    return [
      {
        key: "turtle-whole",
        title: t(lang, "attach.guideWholeTitle", { name: name("turtle") }),
        detail: t(lang, "attach.guideWhole"),
        piece: placed("turtle-whole", "turtle", null),
      },
      {
        key: "turtle-open",
        title: t(lang, "attach.guideOpenTitle", { name: name("turtle") }),
        detail: t(lang, "attach.guideOpen", { share: shareOf(turtle) }),
        piece: placed("turtle-open", "turtle", turtle, turtleWide),
      },
      {
        key: "turtle-join",
        title: t(lang, "attach.guideJoinTitle", { name: name("turtle") }),
        detail: t(lang, "attach.guideJoin", { score: perfect }),
        piece: placed("turtle-join", "turtle", turtle),
      },
      {
        key: "turtle-askew",
        title: t(lang, "attach.guideAskewTitle", { name: name("turtle") }),
        detail: t(lang, "attach.guideAskew", { score: askew }),
        piece: placed("turtle-askew", "turtle", turtle, turtleAskew),
      },
      {
        key: "turtle-scrap",
        title: t(lang, "attach.guideScrapTitle", { name: name("turtle") }),
        detail: t(lang, "attach.guideScrap"),
        piece: placed("turtle-scrap", "turtle", scrap.clips.length ? scrap : null),
      },
      {
        key: "lotus-whole",
        title: t(lang, "attach.guideWholeTitle", { name: name("lotus") }),
        detail: t(lang, "attach.guideWhole"),
        piece: placed("lotus-whole", "lotus", null),
      },
      {
        key: "lotus-open",
        title: t(lang, "attach.guideOpenTitle", { name: name("lotus") }),
        detail: t(lang, "attach.guideOpen", { share: shareOf(lotus) }),
        piece: placed("lotus-open", "lotus", lotus, lotusWide),
      },
      {
        key: "lotus-join",
        title: t(lang, "attach.guideJoinTitle", { name: name("lotus") }),
        detail: t(lang, "attach.guideGrain"),
        piece: placed("lotus-join", "lotus", lotus),
      },
    ];
  }, [lang]);
  const slide = slides[index];

  const move = (dir: -1 | 1) => {
    const next = index + dir;
    if (next < 0 || next >= slides.length) return;
    sfx.click();
    setIndex(next);
  };

  return (
    <>
      <button
        type="button"
        className="help-dot"
        data-attach-help="1"
        aria-label={t(lang, "attach.help")}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          sfx.click();
          setIndex(0);
          setOpen(true);
        }}
      >
        ?
      </button>
      {open && slide && (
        <Modal onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-3 text-[var(--brown)]" role="dialog" aria-labelledby="attach-help-title">
            <div className="flex items-center justify-between gap-2">
              <h2 id="attach-help-title" className="step-title">
                {t(lang, "attach.help")}
              </h2>
              <button
                type="button"
                className="help-dot"
                aria-label={t(lang, "common.close")}
                onClick={() => {
                  sfx.click();
                  setOpen(false);
                }}
              >
                ×
              </button>
            </div>
            <div className="relative">
              <Artwork
                key={slide.key}
                design={{ shape: "round", lacquer: "black", pearl: "white", pieces: [slide.piece] }}
                pieces={[slide.piece]}
                className="mx-auto aspect-square w-full max-w-[280px]"
                gloss={0.45}
                shimmer={false}
              />
              <button
                type="button"
                className="help-dot absolute top-1/2 left-1 z-10 -translate-y-1/2"
                aria-label={t(lang, "attach.helpPrev")}
                disabled={index === 0}
                onClick={() => move(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="help-dot absolute top-1/2 right-1 z-10 -translate-y-1/2"
                aria-label={t(lang, "attach.helpNext")}
                disabled={index === slides.length - 1}
                onClick={() => move(1)}
              >
                ›
              </button>
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold">{slide.title}</p>
              <p className="mt-1 text-sm leading-snug">{slide.detail}</p>
              <p className="mt-2 text-xs tracking-wide">
                {index + 1} / {slides.length}
              </p>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
