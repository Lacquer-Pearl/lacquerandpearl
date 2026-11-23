"use client";

import { useSave, useUI } from "@/lib/store";
import { GIFT_ID } from "@/lib/workshopStory";
import Avatar from "@/components/Avatar";
import { Meter } from "@/components/ui";
import UiIcon, { type UiIconId } from "@/components/UiIcon";
import type { CustomerDef } from "@/lib/data";
import { createContext, useContext } from "react";
import { t } from "@/lib/i18n";

export const TutorialStage = createContext("");

export const MASTER: CustomerDef = {
  name: "옻골 스승님",
  title: "나전칠기 명장",
  skin: "#ffe0c4",
  hair: "#e9e4df",
  outfit: "#b8d8c4",
  hat: "none",
  lines: [],
};

const MASTER_PORTRAIT = "/npc/portraits/npc_r01c01.png";

export function MasterTip({ children }: { children: React.ReactNode }) {
  const lang = useSave(s => s.lang);
  return (
    <div className="flex items-start gap-2">
      <Avatar c={MASTER} mood="happy" portrait={MASTER_PORTRAIT} className="master h-12 w-12 shrink-0" />
      <div className="bubble flex-1 text-[15px] leading-snug"><b className="master-name">{t(lang, "master.name")}</b>{children}</div>
    </div>
  );
}

export function WorkProgress({ value, target, color, label }: {
  value: number; target: number; color: string; label: string;
}) {
  const lang = useSave(s => s.lang);
  const stage = useContext(TutorialStage);
  const ready = value >= target;
  return (
    <div>
      <Meter value={value} target={target} color={color} label={<>
        <span>{label}</span>
        <span>{ready
          ? t(lang, "paint.goalReached", { n: Math.floor(value * 100) })
          : t(lang, "paint.toGoal", { n: Math.ceil((target - value) * 100) })}
        </span>
      </>} />
      <div role="status" aria-atomic="true">
        {ready && <p className="mt-2 text-sm leading-relaxed text-[var(--brown)]">
          <b className="master-name">{t(lang, "master.name")}</b>
          {t(lang, "craft.finishWhenReady")} {t(lang, `craft.finishingTip.${stage}`)}
        </p>}
      </div>
    </div>
  );
}

export interface StepProps {
  onDone: (score: number) => void;
}

export function StepHeader({
  title,
  icon,
  children,
  trailing,
}: {
  title: string;
  icon: UiIconId;
  children?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  const lang = useSave(s => s.lang);
  const stage = useContext(TutorialStage);
  const gift = useUI(s => s.commission?.id === GIFT_ID);
  const firstWork = useSave(s => s.gallery.length === 0);
  const guided = !gift && firstWork;
  const learned = useSave(s => s.learned.includes(stage));
  return (
    <div className="bench-step-header flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="step-title min-w-0 flex-1">
          <UiIcon id={icon} />
          {title}
        </h2>
        {trailing}
      </div>
      {children && (guided ? <div className="master-lesson">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/npc/story/master.webp" alt="" />
        <p><b className="master-name">{t(lang, "master.name")}</b>{children}</p>
      </div> : <details open={!gift && !learned && !(["hemp","fretsaw","whetstone","brush","torch"].includes(icon))} className="demo-help">
        <summary>{lang === "ko" ? "조작 도움말" : "How to play"}</summary>
        <MasterTip>{children}</MasterTip>
      </details>)}
    </div>
  );
}
