"use client";

import { useMemo } from "react";
import AttachStep from "@/components/craft/AttachStep";
import { practiceTurtleCut } from "@/components/craft/AttachBreakGuide";
import type { Design } from "@/lib/game";

export default function BreakLab() {
  const turtle = useMemo(() => practiceTurtleCut(), []);
  const attachDesign: Design = {
    shape: "round",
    lacquer: "black",
    pearl: "white",
    pieces: [{ id: "turtle", motif: "turtle", x: 150, y: 150, s: 1.45, r: 0, pearl: "white" }],
  };

  return (
    <div className="screen" data-break-lab="1">
      <div className="screen-body flex flex-col gap-3">
        <AttachStep design={attachDesign} cuts={[turtle]} onDone={() => undefined} />
      </div>
    </div>
  );
}
