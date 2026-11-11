"use client";

import Avatar from "@/components/Avatar";
import UiIcon, { type UiIconId } from "@/components/UiIcon";
import type { CustomerDef } from "@/lib/data";

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
  return (
    <div className="flex items-start gap-2">
      <Avatar c={MASTER} mood="happy" portrait={MASTER_PORTRAIT} className="master h-12 w-12 shrink-0" />
      <div className="bubble flex-1 text-[15px] leading-snug">{children}</div>
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
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h2 className="step-title min-w-0 flex-1">
          <UiIcon id={icon} />
          {title}
        </h2>
        {trailing}
      </div>
      {children && <MasterTip>{children}</MasterTip>}
    </div>
  );
}
