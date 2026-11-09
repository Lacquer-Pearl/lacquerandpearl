"use client";

import { useId } from "react";
import { NacreDefs } from "./Artwork";
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
    <svg viewBox="-30 -30 60 60" className={className}>
      <defs>
        <NacreDefs id={id} pearl={pearl} shimmer={false} />
      </defs>
      <circle r="29" fill="#2b2124" />
      <path d={MOTIFS[motif].path} fill={`url(#${id})`} transform="scale(0.95)" />
    </svg>
  );
}
