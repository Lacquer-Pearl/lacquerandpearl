"use client";

import { useEffect, useRef, useState } from "react";
import Artwork, {
  MotifMasks,
  MotifSilhouette,
  NacreDefs,
  NacrePiece,
  motifMask,
  nacreFill,
  pieceLight,
  pieceTransform,
} from "@/components/Artwork";
import { Btn, Meter } from "@/components/ui";
import { piecePearl, type Design, type PlacedPiece } from "@/lib/game";
import { motifName, t, tNode } from "@/lib/i18n";
import { sfx } from "@/lib/sound";
import { useSave } from "@/lib/store";
import { StepHeader } from "./common";

const SNAP = 30;
const GLUE_MS = 7000;

export default function AttachStep({
  design,
  onDone,
}: {
  design: Design;
  onDone: (score: number, placed: PlacedPiece[]) => void;
}) {
  const lang = useSave((s) => s.lang);
  const [placed, setPlaced] = useState<PlacedPiece[]>([]);
  const [current, setCurrent] = useState(0);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [glue, setGlue] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const glueStart = useRef(0);
  const scores = useRef<number[]>([]);
  const regluePenalty = useRef(0);
  const done = useRef(false);
  const total = design.pieces.length;
  const piece = design.pieces[current];

  useEffect(() => {
    glueStart.current = performance.now();
    const id = setInterval(() => {
      const g = Math.max(0, 1 - (performance.now() - glueStart.current) / GLUE_MS);
      setGlue(g);
    }, 80);
    return () => clearInterval(id);
  }, []);

  const toLocal = (e: { clientX: number; clientY: number }) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 300, y: ((e.clientY - r.top) / r.width) * 300 };
  };

  const drop = (p: { x: number; y: number }) => {
    if (!piece) return;
    const d = Math.hypot(p.x - piece.x, p.y - piece.y);
    if (d > SNAP) {
      setMsg(t(lang, "attach.near"));
      sfx.fail();
      setTimeout(() => setMsg(null), 900);
      return;
    }
    if (glue <= 0) {
      setMsg(t(lang, "attach.dry"));
      sfx.fail();
      setTimeout(() => setMsg(null), 1200);
      return;
    }
    const acc = 1 - d / SNAP;
    const s = acc * 75 + Math.min(1, glue * 1.4) * 25;
    scores.current.push(s);
    sfx.place();
    setMsg(d < 6 ? t(lang, "attach.perfect") : d < 15 ? t(lang, "attach.ok") : t(lang, "attach.skew"));
    setTimeout(() => setMsg(null), 700);
    const next = [...placed, { ...piece, x: p.x, y: p.y }];
    setPlaced(next);
    if (current + 1 >= total) {
      if (done.current) return;
      done.current = true;
      const avg = scores.current.reduce((a, b) => a + b, 0) / scores.current.length;
      setTimeout(() => onDone(Math.round(Math.max(5, avg - regluePenalty.current)), next), 400);
    } else {
      setCurrent(current + 1);
      glueStart.current = performance.now();
      setGlue(1);
    }
  };

  return (
    <div className="flex flex-col gap-3 select-none">
      <StepHeader title={t(lang, "attach.title")} emoji="🍯">
        {tNode(lang, "attach.tip", { b: <b>{t(lang, "attach.tipB")}</b> })}
      </StepHeader>
      <div
        className="workbench relative"
        style={{ touchAction: "none" }}
        onPointerMove={(e) => drag && setDrag(toLocal(e))}
        onPointerUp={(e) => {
          if (!drag) return;
          drop(toLocal(e));
          setDrag(null);
        }}
        onPointerCancel={() => setDrag(null)}
      >
        <div ref={wrapRef} className="relative aspect-square w-full">
          <Artwork
            design={design}
            pieces={placed}
            ghosts={design.pieces.slice(placed.length)}
            className="pointer-events-none absolute inset-0 h-full w-full"
            gloss={0.3}
          />
          {piece && !drag && (
            <svg viewBox="0 0 300 300" className="pointer-events-none absolute inset-0 h-full w-full">
              <circle cx={piece.x} cy={piece.y} r={8} fill="#d9b25f" opacity="0.8" className="pulse" />
            </svg>
          )}
          {drag && piece && (
            <svg
              viewBox="0 0 300 300"
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            >
              <defs>
                <NacreDefs id="drag-nacre" pearl={piecePearl(piece, design)} />
                <MotifMasks id="drag-cut" motifs={[piece.motif]} />
              </defs>
              <g
                transform={pieceTransform({ ...piece, x: drag.x + 2, y: drag.y + 5 })}
                mask={motifMask("drag-cut", piece.motif)}
                opacity="0.35"
              >
                <MotifSilhouette motif={piece.motif} color="#000" />
              </g>
              <g transform={pieceTransform({ ...piece, x: drag.x, y: drag.y })}>
                <NacrePiece
                  motif={piece.motif}
                  fill={nacreFill("drag-nacre", piece.id)}
                  mask={motifMask("drag-cut", piece.motif)}
                  light={pieceLight(piece)}
                  s={piece.s}
                />
              </g>
            </svg>
          )}
        </div>
        {msg && <div className="event-toast pop-in">{msg}</div>}
        <div className="mt-2 flex items-center gap-3 rounded-2xl bg-[#efe5d4] p-2">
          <div
            className={`tray-piece ${glue > 0 ? "glued" : ""}`}
            onPointerDown={(e) => {
              if (!piece) return;
              e.currentTarget.parentElement?.parentElement?.setPointerCapture(e.pointerId);
              sfx.pop();
              setDrag(toLocal(e));
            }}
          >
            {piece && (
              <svg viewBox="-30 -30 60 60" className="h-full w-full">
                <defs>
                  <NacreDefs id="tray-nacre" pearl={piecePearl(piece, design)} />
                  <MotifMasks id="tray-cut" motifs={[piece.motif]} />
                </defs>
                <g transform={`rotate(${piece.r})`}>
                  <NacrePiece
                    motif={piece.motif}
                    fill={nacreFill("tray-nacre", piece.id)}
                    mask={motifMask("tray-cut", piece.motif)}
                    light={pieceLight(piece)}
                  />
                </g>
              </svg>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <div className="text-sm text-[var(--brown)]">
              {piece
                ? t(lang, "attach.piece", { name: motifName(lang, piece.motif), n: current + 1, max: total })
                : t(lang, "attach.all")}
            </div>
            <Meter value={glue} color={glue > 0.4 ? "var(--gold)" : "var(--red)"} />
          </div>
          <Btn
            variant="gold"
            size="sm"
            disabled={glue > 0.5 || !piece}
            onClick={() => {
              regluePenalty.current += 3;
              glueStart.current = performance.now();
              setGlue(1);
              sfx.bubble();
            }}
          >
            {t(lang, "attach.reglue")}
          </Btn>
        </div>
      </div>
    </div>
  );
}
