"use client";

import { useId } from "react";
import { MotifMasks, NacreDefs, NacrePiece, SheenGradient, motifMask } from "./Artwork";
import { MOTIFS, type MotifId, type PearlId } from "@/lib/data";

export default function MotifIcon({
  motif,
  pearl = "white",
  className,
}: {
  motif: MotifId;
  pearl?: PearlId;
  className?: string;
}) {
  const id = `mi${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="-32 -32 64 64" className={className}>
      <defs>
        <NacreDefs id={id} pearl={pearl} />
        <MotifMasks id={`${id}-c`} motifs={[motif]} />
        <radialGradient id={`${id}-bg`} cx="0.38" cy="0.32" r="0.8">
          <stop offset="0" stopColor="#3a2c2a" />
          <stop offset="1" stopColor="#120b0a" />
        </radialGradient>
      </defs>
      <circle r="31.5" fill={`url(#${id}-bg)`} />
      <g
        transform={`scale(${
          MOTIFS[motif].stamp
            ? Math.min(54 / MOTIFS[motif].stamp.w, 52 / MOTIFS[motif].stamp.h)
            : MOTIFS[motif].kind === "pattern"
              ? 1.15
              : 0.9
        })`}
      >
        <NacrePiece motif={motif} fill={`url(#${id})`} mask={motifMask(`${id}-c`, motif)} light={0.12} />
      </g>
    </svg>
  );
}

/** 판자개 원판 견본 (자개 종류 선택·상점용) */
export function NacreSwatch({ pearl, className, round = true }: { pearl: PearlId; className?: string; round?: boolean }) {
  const id = `ns${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <defs>
        <NacreDefs id={id} pearl={pearl} scale={0.85} />
        <SheenGradient id={`${id}-sh`} size={48} />
        <clipPath id={`${id}-c`}>
          {round ? <circle cx="24" cy="24" r="24" /> : <rect width="48" height="48" rx="7" />}
        </clipPath>
      </defs>
      <g clipPath={`url(#${id}-c)`}>
        <rect width="48" height="48" fill={`url(#${id})`} />
        <rect width="48" height="48" fill={`url(#${id}-sh)`} />
      </g>
    </svg>
  );
}
