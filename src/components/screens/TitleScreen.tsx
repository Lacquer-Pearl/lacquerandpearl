"use client";

import Image from "next/image";
import { useState } from "react";
import WorkshopNav from "@/components/WorkshopNav";
import ReputationModal from "@/components/ReputationModal";
import UiIcon from "@/components/UiIcon";
import { Btn, Coin, Modal, SoundToggle } from "@/components/ui";
import { MasterTip } from "@/components/craft/common";
import { rankTitle, stepName, t, tNode, type Locale } from "@/lib/i18n";
import { newPiece, type StepId } from "@/lib/game";
import { beginDevCraft, loadDevProgress } from "@/lib/devCraft";
import { sfx } from "@/lib/sound";
import { useSave, useUI } from "@/lib/store";

const CRAFT_STEPS: ("design" | StepId)[] = [
  "design",
  "cloth",
  "lacquer",
  "dry",
  "cut",
  "attach",
  "iron",
  "peel",
  "fill",
  "sand",
];

export default function TitleScreen() {
  const go = useUI((s) => s.go);
  const startCraft = useUI((s) => s.startCraft);
  const resumeCraft = useUI((s) => s.resumeCraft);
  const money = useSave((s) => s.money);
  const rep = useSave((s) => s.reputation);
  const craftProgress = useSave((s) => s.craftProgress);

  const setTutorialSeen = useSave((s) => s.setTutorialSeen);
  const resetSave = useSave((s) => s.resetSave);
  const lang = useSave((s) => s.lang);
  const setLang = useSave((s) => s.setLang);
  const [settings, setSettings] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [repOpen, setRepOpen] = useState(false);

  const canResume = !!craftProgress && craftProgress.stepIdx >= 1;

  const signSrc = lang === "en" ? "/images/ui/sign-en.webp" : "/images/ui/sign-ko.webp";
  const signSize = lang === "en" ? { width: 770, height: 346 } : { width: 528, height: 233 };

  return (
    <div className="screen title-screen">

      <header className="room-header">
        <h1 className="room-sign">
          <Image
            key={signSrc} src={signSrc}
            alt={lang === "en" ? "Lacquer & Pearl" : "나전공방"}
            width={signSize.width} height={signSize.height} priority className="h-auto w-full"
          />
        </h1>
        <div className="room-tools">
          <button type="button" className="room-tool" onClick={() => { sfx.click(); go("shop"); }}>
            <UiIcon id="market" /> {t(lang, "title.shop")}
          </button>
          <button type="button" className="room-tool" aria-label={t(lang, "title.settings")}
            onClick={() => { sfx.click(); setSettings(true); }}>
            <UiIcon id="gear" />
          </button>
          <SoundToggle />
        </div>
        <div className="room-status">
          <button type="button" aria-haspopup="dialog" onClick={() => { sfx.click(); setRepOpen(true); }}>
            <UiIcon id="medal" /> {rankTitle(lang, rep)}
          </button>
          <span><Coin /> {money.toLocaleString()}</span>
          <span><UiIcon id="star" /> {rep}</span>
        </div>
      </header>
      <div className="room-dock">
        <button type="button" className="room-primary" onClick={() => {
          sfx.click();
          if (canResume) {
            resumeCraft();
            return;
          }
          startCraft();
          useUI.getState().setDraft({
            shape: "box", lacquer: "black", lacquerChosen: true, pearl: "white",
            pieces: [{ ...newPiece("butterfly", "white"), x: 153, y: 139 }],
          });
        }}>
          <span>{canResume ? t(lang, "craft.resume") : lang === "ko" ? "첫 작품 만들기" : "Make your first piece"}</span>
          <small>{canResume && craftProgress
            ? stepName(lang, CRAFT_STEPS[Math.min(craftProgress.stepIdx, CRAFT_STEPS.length - 1)])
            : lang === "ko" ? "나비문 보석함" : "Butterfly jewel box"}</small>
        </button>
        <WorkshopNav />
        {process.env.NODE_ENV === "development" && (
          <button type="button" className="room-dev" onClick={() => beginDevCraft()}>
            {loadDevProgress() ? lang === "en" ? "Resume stage test" : "단계 시험 이어하기"
              : lang === "en" ? "Stage test" : "단계 시험"}
          </button>
        )}
      </div>

      {repOpen && <ReputationModal lang={lang} rep={rep} onClose={() => setRepOpen(false)} />}

      {settings && (
        <Modal
          onClose={() => {
            setTutorialSeen();
            setSettings(false);
          }}
        >
          <div className="flex flex-col gap-3">
            <h2 className="step-title text-center">{t(lang, "title.welcome")}</h2>
            <MasterTip>
              {tNode(lang, "title.masterTip", {
                craft: <b>{t(lang, "title.craftName")}</b>,
              })}
            </MasterTip>
            <ol className="flex flex-col gap-1.5 rounded-2xl bg-[#f8f2e8] p-3 text-[15px] text-[var(--brown)]">
              <li>
                {tNode(lang, "title.help1", {
                  b: <b>{t(lang, "title.help1b")}</b>,
                })}
              </li>
              <li>{t(lang, "title.help2")}</li>
              <li>{t(lang, "title.help3")}</li>
              <li>{t(lang, "title.help4")}</li>
            </ol>

            {settings && (
              <div className="rounded-2xl bg-[#f8f2e8] p-3">
                <div className="mb-2 text-sm font-semibold text-[var(--brown)]">{t(lang, "lang.label")}</div>
                <div className="grid grid-cols-2 gap-2">
                  {(["ko", "en"] as Locale[]).map((code) => (
                    <button
                      key={code}
                      type="button"
                      className={`rounded-2xl border-2 px-3 py-2 text-sm ${
                        lang === code
                          ? "border-[var(--pink)] bg-[#ffe8e4] text-[var(--brown)]"
                          : "border-[var(--line-deep)] bg-[#fffdf8] text-[var(--brown)]"
                      }`}
                      onClick={() => setLang(code)}
                    >
                      {t(lang, `lang.${code}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Btn
              variant="pink"
              size="lg"
              onClick={() => {
                setTutorialSeen();
                setSettings(false);
              }}
            >
              {t(lang, "common.start")}
            </Btn>
            {settings && (
              <button className="text-sm text-[var(--red)] underline" onClick={() => setConfirmReset(true)}>
                {t(lang, "common.reset")}
              </button>
            )}
          </div>
        </Modal>
      )}
      {confirmReset && (
        <Modal onClose={() => setConfirmReset(false)}>
          <div className="flex flex-col gap-3 text-center text-[var(--brown)]">
            <p className="text-lg">
              {t(lang, "title.resetAsk")}
              <br />
              <small>{t(lang, "title.resetWarn")}</small>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Btn variant="cream" onClick={() => setConfirmReset(false)}>
                {t(lang, "common.cancel")}
              </Btn>
              <Btn
                variant="pink"
                onClick={() => {
                  resetSave();
                  setConfirmReset(false);
                  setSettings(false);
                }}
              >
                {t(lang, "common.reset")}
              </Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
