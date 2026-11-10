"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Artwork from "@/components/Artwork";
import Avatar, { type Mood } from "@/components/Avatar";
import { Btn, Coin, Meter, Sparkles, TopBar } from "@/components/ui";
import { rankProgress } from "@/lib/data";
import { GRADE_INFO, STEP_INFO, reputationGain, topMotif, type StepId } from "@/lib/game";
import {
  artworkTitle,
  clientLabel,
  gradeLabel,
  rankTitle,
  reactionText,
  stepName,
  t,
} from "@/lib/i18n";
import { saveArtworkImage } from "@/lib/exportImage";
import { sfx } from "@/lib/sound";
import { useSave, useUI } from "@/lib/store";

function useCountUp(from: number, to: number, ms = 800) {
  const [value, setValue] = useState(from);
  useEffect(() => {
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - p) ** 3;
      setValue(Math.round(from + (to - from) * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [from, to, ms]);
  return value;
}

export default function ResultScreen() {
  const art = useUI((s) => s.lastArtwork);
  const go = useUI((s) => s.go);
  const lang = useSave((s) => s.lang);
  const rep = useSave((s) => s.reputation);
  const svgRef = useRef<SVGSVGElement>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const reaction = useMemo(
    () => (art ? reactionText(lang, art.grade, !art.commissionId) : ""),
    [art, lang],
  );

  useEffect(() => {
    if (!art) return;
    if (art.grade === "S" || art.grade === "A") sfx.fanfare();
    else sfx.success();
    if (art.earned) setTimeout(sfx.coin, 900);
  }, [art]);

  const repGain = art ? reputationGain(art.grade, !!art.commissionId) : 0;
  const shownRep = useCountUp(Math.max(0, rep - repGain), rep);
  const beforeRank = rankProgress(Math.max(0, rep - repGain));
  const afterRank = rankProgress(rep);
  const promoted = beforeRank.index !== afterRank.index;

  if (!art) return null;
  const g = GRADE_INFO[art.grade];
  const shownStep = rankProgress(shownRep);
  const label = gradeLabel(lang, art.grade);
  const title = artworkTitle(lang, art.design.shape, art.design.lacquer, topMotif(art.design));
  const client = art.patron || art.customer != null ? clientLabel(lang, art) : undefined;
  const mood: Mood =
    art.grade === "S"
      ? "wow"
      : art.grade === "A" || art.grade === "B"
        ? "happy"
        : art.grade === "C"
          ? "neutral"
          : "sad";
  const pts = lang === "ko" ? "점" : " pts";

  return (
    <div className="screen">
      <TopBar title={t(lang, "result.title")} />
      <div className="screen-body">
        <div className="display-silk relative overflow-hidden">
          <Sparkles count={art.grade === "S" ? 14 : 6} />
          <Artwork svgRef={svgRef} design={art.design} gloss={art.gloss} dull={art.dull} className="reveal aspect-square w-full" />
          <div className="grade-seal stamp-in" style={{ background: g.color }}>
            <div className="text-4xl leading-none">{art.grade}</div>
            <div className="text-xs">{label}</div>
          </div>
        </div>
        <h2 className="step-title text-center">{title}</h2>

        {client ? (
          <div className="panel flex items-center gap-3">
            <Avatar c={client.customer} portrait={client.portrait} mood={mood} className="h-16 w-16 shrink-0" />
            <div className="flex-1">
              <b className="text-[var(--brown)]">{client.name}</b>
              <div className="bubble mt-1 text-sm">“{reaction}”</div>
            </div>
          </div>
        ) : (
          <div className="panel text-center text-[var(--brown)]">{reaction}</div>
        )}

        <div className="panel flex flex-col gap-2">
          <div className="flex justify-between text-lg text-[var(--brown)]">
            <span>{t(lang, "result.total")}</span>
            <b>
              {art.total}
              {pts}
            </b>
          </div>
          <Meter
            value={art.designScore / 100}
            color="var(--lavender-deep)"
            label={
              <>
                <span>
                  ✏️ {t(lang, art.commissionId ? "result.match" : "result.design")}
                </span>
                <span>{art.designScore}</span>
              </>
            }
          />
          <Meter
            value={art.craftScore / 100}
            color="var(--mint-deep)"
            label={
              <>
                <span>🔨 {t(lang, "result.craft")}</span>
                <span>{art.craftScore}</span>
              </>
            }
          />
          <div className="mt-1 grid grid-cols-3 gap-1.5 text-xs">
            {(Object.entries(art.scores) as [StepId, number][]).map(([k, v]) => (
              <div key={k} className="mat">
                {STEP_INFO[k].emoji} {stepName(lang, k)} <b>{v}</b>
              </div>
            ))}
          </div>
        </div>

        <div className="panel flex flex-col gap-2 text-[15px] text-[var(--brown)]">
          <div className="flex items-center justify-between text-lg">
            {art.commissionId ? (
              <span className="coin-pop">
                +<Coin /> {art.earned}
              </span>
            ) : (
              <span>
                {t(lang, "result.appraise")} <Coin /> {art.value}
              </span>
            )}
          </div>
          <div className="flex justify-between gap-3">
            <span>{t(lang, "result.gradeLabel")}</span>
            <b>
              {art.grade} {label}
            </b>
          </div>
          <div className="flex justify-between gap-3">
            <span>{t(lang, "result.repGain")}</span>
            <b>+{repGain}</b>
          </div>
          <div className="flex justify-between gap-3">
            <span>{t(lang, "result.repNow")}</span>
            <b className="rep-count">{shownRep}</b>
          </div>
          {shownStep.maxed ? (
            <p className="text-center font-semibold">{t(lang, "rep.maxed")}</p>
          ) : (
            <>
              <div className="flex justify-between gap-3">
                <span>{t(lang, "result.repRemain")}</span>
                <b className="rep-count">{shownStep.remaining}</b>
              </div>
              <Meter value={shownStep.ratio} color="#8d5a32" />
            </>
          )}
          {promoted && shownRep === rep && (
            <div className="rep-promote">
              <p>{t(lang, "result.promoted")}</p>
              <b className="mt-1 block text-lg">{rankTitle(lang, rep)}</b>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Btn
            variant="lavender"
            onClick={async () => {
              if (!svgRef.current) return;
              const r = await saveArtworkImage(svgRef.current, title, `${art.grade} ${label} · ${art.total}${pts}`);
              setSaved(t(lang, r === "shared" ? "gallery.shared" : "gallery.saved"));
              setTimeout(() => setSaved(null), 1800);
            }}
          >
            📸 {saved ?? t(lang, "result.save")}
          </Btn>
          <Btn variant="gold" onClick={() => go("gallery")}>
            {t(lang, "result.toWorkshop")}
          </Btn>
          {art.commissionId && (
            <Btn variant="pink" onClick={() => go("board")} className="col-span-2" size="lg">
              {t(lang, "result.next")}
            </Btn>
          )}
          <Btn
            variant={art.commissionId ? "cream" : "pink"}
            onClick={() => go("title")}
            className="col-span-2"
            size="lg"
          >
            {t(lang, "result.home")}
          </Btn>
        </div>
      </div>
    </div>
  );
}
