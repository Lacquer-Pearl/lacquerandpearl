"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Artwork, {
  MotifMasks,
  MotifSilhouette,
  NacreDefs,
  NacrePiece,
  PieceGraphics,
  motifMask,
  nacreFill,
  pieceLight,
  pieceTransform,
} from "@/components/Artwork";
import { Btn, Meter } from "@/components/ui";
import { breakStateFrom, dropToPose, fragmentTarget, scoreSeamJoin, type FragmentPose, type PieceCutResult } from "@/lib/cutFragments";
import { piecePearl, turnPiece, type Design, type PlacedPiece } from "@/lib/game";
import { motifName, t, tNode } from "@/lib/i18n";
import { sfx } from "@/lib/sound";
import { useSave } from "@/lib/store";
import AttachBreakGuide from "./AttachBreakGuide";
import { StepHeader } from "./common";

const SNAP = 30;
const GLUE_MS = 7000;

type Task =
  | { kind: "whole"; piece: PlacedPiece }
  | { kind: "fragment"; piece: PlacedPiece; cut: PieceCutResult; frag: FragmentPose; part: number; parts: number }
  | { kind: "scrap"; piece: PlacedPiece; cut: PieceCutResult };

function tasksFor(design: Design, cuts: PieceCutResult[]): Task[] {
  const tasks: Task[] = [];
  for (const piece of design.pieces) {
    const cut = cuts.find((item) => item.pieceId === piece.id);
    if (!cut || cut.condition === "intact") {
      tasks.push({ kind: "whole", piece });
      continue;
    }
    if (cut.condition !== "reusable-broken" || cut.fragments.length < 2 || cut.clips.length !== cut.fragments.length) {
      tasks.push({ kind: "scrap", piece, cut });
      continue;
    }
    cut.fragments.forEach((frag, index) => {
      tasks.push({ kind: "fragment", piece, cut, frag, part: index + 1, parts: cut.fragments.length });
    });
  }
  return tasks;
}

function loneFragment(piece: PlacedPiece, cut: PieceCutResult, frag: FragmentPose): PlacedPiece {
  const index = Math.max(0, cut.fragments.findIndex((item) => item.id === frag.id));
  return {
    ...piece,
    breakState: {
      ...breakStateFrom(cut, [frag]),
      clips: [cut.clips[index] ?? cut.clips[0]],
    },
  };
}

export default function AttachStep({
  design,
  cuts = [],
  onDone,
}: {
  design: Design;
  cuts?: PieceCutResult[];
  onDone: (score: number, placed: PlacedPiece[]) => void;
}) {
  const lang = useSave((s) => s.lang);
  const tasks = useMemo(() => tasksFor(design, cuts), [design, cuts]);
  const [placed, setPlaced] = useState<PlacedPiece[]>([]);
  const [current, setCurrent] = useState(0);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [glue, setGlue] = useState(1);
  const [spin, setSpin] = useState(0);
  const [heldPose, setHeldPose] = useState<FragmentPose | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const glueStart = useRef(0);
  const scores = useRef<number[]>([]);
  const regluePenalty = useRef(0);
  const done = useRef(false);
  const placedRef = useRef<PlacedPiece[]>([]);
  const indexRef = useRef(0);
  const tasksRef = useRef(tasks);
  const held = useRef<FragmentPose | null>(null);
  const finishedPieces = useRef(new Set<string>());
  tasksRef.current = tasks;
  const task = tasks[current];
  const piece = task?.piece;

  useEffect(() => {
    glueStart.current = performance.now();
    const id = setInterval(() => {
      const left = Math.max(0, 1 - (performance.now() - glueStart.current) / GLUE_MS);
      setGlue(left);
    }, 80);
    return () => clearInterval(id);
  }, []);

  const pushPlaced = (score: number, nextPiece: PlacedPiece, note: string) => {
    scores.current.push(score);
    const next = [...placedRef.current, nextPiece];
    placedRef.current = next;
    setPlaced(next);
    sfx.place();
    setMsg(note);
    setTimeout(() => setMsg(null), 700);
    const index = indexRef.current;
    if (index + 1 >= tasksRef.current.length) {
      if (done.current) return;
      done.current = true;
      const avg = scores.current.reduce((a, b) => a + b, 0) / scores.current.length;
      setTimeout(() => onDone(Math.round(Math.max(5, avg - regluePenalty.current)), next), 400);
      return;
    }
    indexRef.current = index + 1;
    setCurrent(index + 1);
    setSpin(0);
    glueStart.current = performance.now();
    setGlue(1);
  };

  useEffect(() => {
    const active = tasks[current];
    if (!active || active.kind !== "scrap") return;
    if (finishedPieces.current.has(active.piece.id)) return;
    setMsg(t(lang, "attach.scrapSkip"));
    const id = window.setTimeout(() => {
      if (finishedPieces.current.has(active.piece.id)) return;
      finishedPieces.current.add(active.piece.id);
      pushPlaced(20, { ...active.piece, breakState: breakStateFrom(active.cut) }, t(lang, "attach.scrapSkip"));
    }, 700);
    return () => window.clearTimeout(id);
    // pushPlaced is recreated each render and only the current scrap task should arm the timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, lang, tasks]);

  const toLocal = (e: { clientX: number; clientY: number }) => {
    const r = wrapRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 300, y: ((e.clientY - r.top) / r.width) * 300 };
  };

  const reject = (key: "attach.near" | "attach.dry", hold: number) => {
    setMsg(t(lang, key));
    sfx.fail();
    setTimeout(() => setMsg(null), hold);
  };

  const drop = (p: { x: number; y: number }) => {
    if (!task || task.kind === "scrap" || !piece) return;
    if (glue <= 0) {
      reject("attach.dry", 1200);
      return;
    }
    if (task.kind === "whole") {
      const dist = Math.hypot(p.x - piece.x, p.y - piece.y);
      if (dist > SNAP) {
        reject("attach.near", 900);
        return;
      }
      const acc = 1 - dist / SNAP;
      const score = acc * 75 + Math.min(1, glue * 1.4) * 25;
      pushPlaced(
        score,
        { ...piece, x: p.x, y: p.y },
        dist < 6 ? t(lang, "attach.perfect") : dist < 15 ? t(lang, "attach.ok") : t(lang, "attach.skew"),
      );
      return;
    }
    const target = fragmentTarget(piece, task.frag);
    const dist = Math.hypot(p.x - target.x, p.y - target.y);
    if (dist > SNAP) {
      reject("attach.near", 900);
      return;
    }
    const pose = dropToPose(piece, p, spin, task.frag);
    if (!held.current) {
      held.current = pose;
      setHeldPose(pose);
      sfx.place();
      setMsg(t(lang, "attach.ok"));
      setTimeout(() => setMsg(null), 700);
      indexRef.current += 1;
      setCurrent(indexRef.current);
      setSpin(0);
      glueStart.current = performance.now();
      setGlue(1);
      return;
    }
    const poses = [held.current, pose];
    held.current = null;
    setHeldPose(null);
    const seam = scoreSeamJoin(task.cut.seam, task.cut.fragments, poses);
    pushPlaced(
      seam.score,
      { ...piece, breakState: breakStateFrom(task.cut, poses) },
      seam.score > 88 ? t(lang, "attach.seamGood") : seam.score > 65 ? t(lang, "attach.seamOk") : t(lang, "attach.seamBad"),
    );
  };

  const placedIds = new Set(placed.map((item) => item.id));
  const placing = !!piece && !placedIds.has(piece.id);
  const ghosts = design.pieces.filter((item) => {
    if (placedIds.has(item.id) || item.id === piece?.id) return false;
    const cut = cuts.find((entry) => entry.pieceId === item.id);
    return !cut || cut.condition === "intact";
  });
  const fragmentTask = task?.kind === "fragment" ? task : null;
  const target = fragmentTask ? fragmentTarget(fragmentTask.piece, fragmentTask.frag) : null;
  const pearl = piece ? piecePearl(piece, design) : design.pearl;

  return (
    <div className="flex flex-col gap-3 select-none">
      <StepHeader title={t(lang, "attach.title")} icon="paste" trailing={<AttachBreakGuide />}>
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
            ghosts={ghosts}
            className="pointer-events-none absolute inset-0 h-full w-full"
            gloss={0.3}
          />
          {placing && task?.kind !== "scrap" && (
            <svg viewBox="0 0 300 300" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
              <defs>
                <NacreDefs id="attach-nacre" pearl={pearl} />
                <MotifMasks id="attach-cut" motifs={[piece.motif]} />
              </defs>
              {fragmentTask && (
                <g transform={pieceTransform(piece)} opacity="0.42">
                  <PieceGraphics
                    piece={loneFragment(piece, fragmentTask.cut, fragmentTask.frag)}
                    fill={nacreFill("attach-nacre", `${piece.id}-ghost`)}
                    mask={motifMask("attach-cut", piece.motif)}
                    light={pieceLight(piece)}
                    s={piece.s}
                    clipPrefix={`attach-ghost-${piece.id}`}
                  />
                </g>
              )}
              {heldPose && fragmentTask && (
                <g transform={pieceTransform(piece)}>
                  <PieceGraphics
                    piece={loneFragment(piece, fragmentTask.cut, heldPose)}
                    fill={nacreFill("attach-nacre", `${piece.id}-held`)}
                    mask={motifMask("attach-cut", piece.motif)}
                    light={pieceLight(piece)}
                    s={piece.s}
                    clipPrefix={`attach-held-${piece.id}`}
                  />
                </g>
              )}
              {!drag && (
                <circle cx={target?.x ?? piece.x} cy={target?.y ?? piece.y} r={8} fill="#d9b25f" opacity="0.8" className="pulse" />
              )}
              {drag && fragmentTask && (
                <g transform={pieceTransform(piece)} opacity="0.96">
                  <PieceGraphics
                    piece={loneFragment(piece, fragmentTask.cut, dropToPose(piece, drag, spin, fragmentTask.frag))}
                    fill={nacreFill("attach-nacre", `${piece.id}-drag`)}
                    mask={motifMask("attach-cut", piece.motif)}
                    light={pieceLight(piece)}
                    s={piece.s}
                    clipPrefix={`attach-drag-${piece.id}`}
                  />
                </g>
              )}
              {drag && task?.kind === "whole" && (
                <>
                  <g transform={pieceTransform({ ...piece, x: drag.x + 2, y: drag.y + 5 })} mask={motifMask("attach-cut", piece.motif)} opacity="0.35">
                    <MotifSilhouette motif={piece.motif} color="#000" />
                  </g>
                  <g transform={pieceTransform({ ...piece, x: drag.x, y: drag.y })}>
                    <NacrePiece
                      motif={piece.motif}
                      fill={nacreFill("attach-nacre", piece.id)}
                      mask={motifMask("attach-cut", piece.motif)}
                      light={pieceLight(piece)}
                      s={piece.s}
                    />
                  </g>
                </>
              )}
            </svg>
          )}
        </div>
        {msg && <div className="event-toast pop-in">{msg}</div>}
        <div className="mt-2 flex items-center gap-3 rounded-2xl bg-[#efe5d4] p-2">
          <div
            className={`tray-piece ${glue > 0 ? "glued" : ""}`}
            onPointerDown={(e) => {
              if (!piece || task?.kind === "scrap") return;
              e.currentTarget.parentElement?.parentElement?.setPointerCapture(e.pointerId);
              sfx.pop();
              setDrag(toLocal(e));
            }}
          >
            {placing && task?.kind !== "scrap" && (
              <svg viewBox={fragmentTask ? "-40 -40 80 80" : "-30 -30 60 60"} className="h-full w-full">
                <defs>
                  <NacreDefs id="tray-nacre" pearl={pearl} />
                  <MotifMasks id="tray-cut" motifs={[piece.motif]} />
                </defs>
                <g transform={`rotate(${piece.r + spin})`}>
                  {fragmentTask ? (
                    <PieceGraphics
                      piece={loneFragment(piece, fragmentTask.cut, { ...fragmentTask.frag, dx: 0, dy: 0, r: 0 })}
                      fill={nacreFill("tray-nacre", piece.id)}
                      mask={motifMask("tray-cut", piece.motif)}
                      light={pieceLight(piece)}
                      clipPrefix={`tray-${piece.id}-${fragmentTask.part}`}
                    />
                  ) : (
                    <NacrePiece
                      motif={piece.motif}
                      fill={nacreFill("tray-nacre", piece.id)}
                      mask={motifMask("tray-cut", piece.motif)}
                      light={pieceLight(piece)}
                    />
                  )}
                </g>
              </svg>
            )}
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <div className="text-sm text-[var(--brown)]">
              {fragmentTask && placing
                ? t(lang, "attach.fragment", {
                    name: motifName(lang, fragmentTask.piece.motif),
                    part: fragmentTask.part,
                    parts: fragmentTask.parts,
                    n: current + 1,
                    max: tasks.length,
                  })
                : piece && placing
                  ? t(lang, "attach.piece", { name: motifName(lang, piece.motif), n: current + 1, max: tasks.length })
                  : t(lang, "attach.all")}
            </div>
            <Meter value={glue} color={glue > 0.4 ? "var(--gold)" : "var(--red)"} />
            {fragmentTask && placing && (
              <div className="mt-1 flex gap-1">
                <Btn variant="cream" size="sm" onClick={() => setSpin((value) => turnPiece(value, -1))}>
                  {t(lang, "attach.turnL")}
                </Btn>
                <Btn variant="cream" size="sm" onClick={() => setSpin((value) => turnPiece(value, 1))}>
                  {t(lang, "attach.turnR")}
                </Btn>
              </div>
            )}
          </div>
          <Btn
            variant="gold"
            size="sm"
            disabled={glue > 0.5 || !piece || task?.kind === "scrap"}
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
