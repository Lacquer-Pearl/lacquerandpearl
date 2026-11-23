"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Artwork from "@/components/Artwork";
import Avatar, { type Mood } from "@/components/Avatar";
import UiIcon, { STEP_ICONS } from "@/components/UiIcon";
import { Btn, Coin, Meter, TopBar } from "@/components/ui";
import { rankProgress } from "@/lib/data";
import { GRADE_INFO, reputationGain, topMotif, type StepId } from "@/lib/game";
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
import LessonGate, { GiftLessons } from "@/components/craft/LessonGate";
import { ACHIEVEMENTS, achievementHint, GIFT_ID, VISITOR_ID } from "@/lib/workshopStory";

const SURVEY_URL = {
  ko: "https://forms.gle/s8UeDQ21n7m3Ug6V8",
  en: "https://forms.gle/RU2RqV5x2B5sc5nM7",
} as const;

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
  const storyComplete = useSave(s => s.story.chapter === "ending");
  const rep = useSave((s) => s.reputation);
  const surveyClaimed = useSave((s) => s.surveyClaimed);
  const claimSurveyReward = useSave((s) => s.claimSurveyReward);
  const svgRef = useRef<SVGSVGElement>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [surveyFlash, setSurveyFlash] = useState<string | null>(null);
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

  const openSurvey = () => {
    if (claimSurveyReward()) {
      sfx.coin();
      setSurveyFlash(t(lang, "result.surveyThanks", { n: 100 }));
      setTimeout(() => setSurveyFlash(null), 1800);
    }
  };

  const repGain = art ? reputationGain(art.grade, !!art.commissionId)
    + (art.achievements ?? []).reduce((sum, id) => sum + ACHIEVEMENTS[id].rep, 0) : 0;
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
  const ko = lang === "ko";
  const gift = art.commissionId === GIFT_ID;
  const visitor = art.commissionId === VISITOR_ID;

  return (
    <GiftLessons.Provider value={gift}><LessonGate lesson="finish">
    <div className="screen">
      <TopBar title={t(lang, "result.title")} />
      <div className="screen-body">
        <div className="display-silk demo-display relative overflow-hidden">

          <Artwork svgRef={svgRef} design={art.design} showcase gloss={art.gloss} dull={art.dull} className="reveal aspect-square w-full" />
          <div className="grade-seal stamp-in" style={{ background: g.color }}>
            <div className="text-4xl leading-none">{art.grade}</div>
            <div className="text-xs">{label}</div>
          </div>
        </div>
        <h2 className="step-title text-center">{title}</h2>

        <p className="demo-caption">{new Intl.DateTimeFormat(lang === "ko" ? "ko-KR" : "en", {dateStyle:"long"}).format(art.createdAt)} · {lang === "ko" ? "공방 제작 기록" : "Workshop collection"}</p>
        <div className="grid grid-cols-2 gap-2">
          <Btn
            variant="lavender"
            onClick={async () => {
              if (!svgRef.current) return;
              try {
                await saveArtworkImage(svgRef.current, title, `${art.grade} ${label} · ${art.total}${pts}`, false);
                setSaved(t(lang, "gallery.saved"));
              } catch {
                setSaved(lang === "ko" ? "저장 실패 · 다시 시도" : "Retry saving");
              }
              setTimeout(() => setSaved(null), 1800);
            }}
          >
            <UiIcon id="frame" className="ui-icon-sm" /> {saved ?? t(lang, "result.save")}
          </Btn>
          <Btn variant="gold" onClick={() => go("gallery")}>
            <UiIcon id="cabinet" className="ui-icon-sm" /> {t(lang, "result.toWorkshop")}
          </Btn>
        </div>
      <section className="demo-epilogue">
        {gift || visitor ? <Btn variant="gold" onClick={() => go("board")}>{gift
          ? (ko ? "친구에게 선물 건네기" : "Give your friend the gift")
          : (ko ? "손님에게 작품 건네기" : "Present the finished piece")}</Btn> : storyComplete && <>
          <h3>{ko ? "왕실에서 온 서신" : "A letter from the palace"}</h3>
          <p>{ko ? "작품을 내려놓자 문틈으로 봉인된 서신 한 통이 들어온다. “다음 달 궁에 들일 나전함을 맡아 주시겠습니까?”" : "A sealed letter rests on your bench. “Would you make a lacquer box for the palace?”"}</p>
        </>}
        <a href={SURVEY_URL[lang]} target="_blank" rel="noopener noreferrer" onClick={openSurvey}>
          {surveyClaimed ? (lang === "ko" ? "설문 다시 열기" : "Reopen survey") : t(lang, "result.surveyCta")}
        </a>
      </section>
        {!!art.achievements?.length && <section className="panel">
          <h3>{ko ? "새로 받은 낙관" : "New maker’s seals"}</h3>
          {art.achievements.map(id => <p key={id}><b>{ACHIEVEMENTS[id][lang]}</b> · {achievementHint(id, lang)} · <Coin /> +{ACHIEVEMENTS[id].coins}</p>)}
        </section>}
        {gift || visitor ? null : client ? (
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
                  <UiIcon id="pencil" className="ui-icon-sm" />{" "}
                  {t(lang, art.commissionId ? "result.match" : "result.design")}
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
                <span>
                  <UiIcon id="whetstone" className="ui-icon-sm" /> {t(lang, "result.craft")}
                </span>
                <span>{art.craftScore}</span>
              </>
            }
          />
          <div className="mt-1 grid grid-cols-3 gap-1.5 text-xs">
            {(Object.entries(art.scores) as [StepId, number][]).map(([k, v]) => (
              <div key={k} className="mat">
                <UiIcon id={STEP_ICONS[k]} className="ui-icon-sm" /> {stepName(lang, k)} <b>{v}</b>
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
          {art.commissionId && !gift && !visitor && (
            <Btn variant="pink" onClick={() => go("board")} className="col-span-2" size="lg">
              <UiIcon id="scroll" className="ui-icon-sm" /> {t(lang, "result.next")}
            </Btn>
          )}
          <Btn
            variant={art.commissionId ? "cream" : "pink"}
            onClick={() => go("title")}
            className="col-span-2"
            size="lg"
          >
            <UiIcon id="cabinet" className="ui-icon-sm" /> {t(lang, "result.home")}
          </Btn>
        </div>
      </div>

      {surveyFlash && (
        <div className="score-toast-wrap pointer-events-none">
          <div className="event-toast static pop-in">{surveyFlash}</div>
        </div>
      )}

    </div>
    </LessonGate></GiftLessons.Provider>
  );
}
