"use client";

import Image from "next/image";
import { useState } from "react";
import ReputationModal from "@/components/ReputationModal";
import { Btn, Coin, Modal, Sparkles, SoundToggle } from "@/components/ui";
import { MasterTip } from "@/components/craft/common";
import { rankTitle, t, tNode, type Locale } from "@/lib/i18n";
import { sfx } from "@/lib/sound";
import { useSave, useUI } from "@/lib/store";

function TitleMenuBtn({
  children,
  size = "lg",
  onClick,
  className = "",
}: {
  children: React.ReactNode;
  size?: "lg" | "md";
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`title-menu-btn title-menu-btn-${size} ${className}`}
      onClick={() => {
        sfx.click();
        onClick?.();
      }}
    >
      <span className="title-menu-btn-label">{children}</span>
    </button>
  );
}

export default function TitleScreen() {
  const go = useUI((s) => s.go);
  const startCraft = useUI((s) => s.startCraft);
  const money = useSave((s) => s.money);
  const rep = useSave((s) => s.reputation);
  const galleryCount = useSave((s) => s.gallery.length);
  const tutorialSeen = useSave((s) => s.tutorialSeen);
  const setTutorialSeen = useSave((s) => s.setTutorialSeen);
  const resetSave = useSave((s) => s.resetSave);
  const lang = useSave((s) => s.lang);
  const setLang = useSave((s) => s.setLang);
  const [settings, setSettings] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [repOpen, setRepOpen] = useState(false);

  const signSrc = lang === "en" ? "/images/ui/sign-en.png" : "/images/ui/sign-ko.png";
  const signSize = lang === "en" ? { width: 770, height: 346 } : { width: 528, height: 233 };

  return (
    <div className="screen title-screen">
      <Sparkles count={16} />
      <div className="flex justify-end p-3">
        <SoundToggle />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-5 pb-8">
        <div className="float logo-plaque w-full max-w-[440px]">
          <Image
            key={signSrc}
            src={signSrc}
            alt={lang === "en" ? "Lacquer & Pearl — Master the Korean Traditional Craft" : "나전공방 — Master the Korean Traditional Craft"}
            width={signSize.width}
            height={signSize.height}
            priority
            className="h-auto w-full"
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="chip"
            aria-haspopup="dialog"
            onClick={() => {
              sfx.click();
              setRepOpen(true);
            }}
          >
            🏅 {rankTitle(lang, rep)}
          </button>
          <span className="chip">
            <Coin /> {money.toLocaleString()}
          </span>
          <span className="chip">⭐ {rep}</span>
        </div>
        <div className="grid w-full max-w-[360px] grid-cols-1 gap-3">
          <TitleMenuBtn size="lg" onClick={() => go("board")}>
            {t(lang, "title.commission")}
          </TitleMenuBtn>
          <TitleMenuBtn size="lg" onClick={() => startCraft(undefined)}>
            {t(lang, "title.freeDesign")}
          </TitleMenuBtn>
          <div className="grid grid-cols-2 gap-3">
            <TitleMenuBtn size="md" onClick={() => go("gallery")}>
              {t(lang, "title.workshop")} {galleryCount > 0 && <small>({galleryCount})</small>}
            </TitleMenuBtn>
            <TitleMenuBtn size="md" onClick={() => go("shop")}>
              {t(lang, "title.shop")}
            </TitleMenuBtn>
          </div>
          <TitleMenuBtn size="md" className="title-menu-btn-settings" onClick={() => setSettings(true)}>
            {t(lang, "title.settings")}
          </TitleMenuBtn>
        </div>
      </div>

      {repOpen && <ReputationModal lang={lang} rep={rep} onClose={() => setRepOpen(false)} />}

      {(!tutorialSeen || settings) && (
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
