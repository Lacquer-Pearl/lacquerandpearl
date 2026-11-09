"use client";

import Avatar from "@/components/Avatar";
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

export function MasterTip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Avatar c={MASTER} mood="happy" className="h-12 w-12 shrink-0" />
      <div className="bubble flex-1 text-[15px] leading-snug">{children}</div>
    </div>
  );
}

export interface StepProps {
  onDone: (score: number) => void;
}

export function StepHeader({
  title,
  emoji,
  children,
}: {
  title: string;
  emoji: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="step-title">
        <span className="mr-1">{emoji}</span>
        {title}
      </h2>
      {children && <MasterTip>{children}</MasterTip>}
    </div>
  );
}
