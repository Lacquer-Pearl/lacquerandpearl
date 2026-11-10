"use client";

import { useEffect, useRef, useState } from "react";
import Artwork from "@/components/Artwork";
import { Btn, Coin } from "@/components/ui";
import MotifIcon, { NacreSwatch } from "@/components/MotifIcon";
import {
  LACQUERS,
  LACQUER_LIST,
  MATERIALS,
  MOTIFS,
  PATTERN_MOTIFS,
  PEARL_LIST,
  SHAPE_LIST,
  SHAPE_MOTIFS,
  motifLocalBox,
  type MaterialId,
  type MotifId,
} from "@/lib/data";
import {
  countMotifs,
  newPiece,
  nextPatternSlot,
  pearlShare,
  piecePearl,
  snapToPattern,
  uid,
  type Commission,
  type Design,
  type PlacedPiece,
} from "@/lib/game";
import {
  lacquerName,
  materialName,
  motifMeaning,
  motifName,
  pearlName,
  shapeName,
  t,
} from "@/lib/i18n";
import { sfx } from "@/lib/sound";
import { costFor, useSave } from "@/lib/store";
import { StepHeader } from "./common";

const MAX_PIECES = 32;
const MIN_S = 0.5;
const MAX_S = 2.5;

type DragState =
  | { kind: "move"; sx: number; sy: number; origins: { id: string; x: number; y: number }[] }
  | { kind: "scale"; id: string; startDist: number; startS: number }
  | { kind: "rotate"; id: string; startAngle: number; startR: number }
  | { kind: "marquee"; x0: number; y0: number; x1: number; y1: number; add: boolean; base: string[] };

function marqueeRect(d: { x0: number; y0: number; x1: number; y1: number }) {
  return {
    x: Math.min(d.x0, d.x1),
    y: Math.min(d.y0, d.y1),
    w: Math.abs(d.x1 - d.x0),
    h: Math.abs(d.y1 - d.y0),
  };
}

function localToWorld(p: Pick<PlacedPiece, "x" | "y" | "r" | "s">, lx: number, ly: number) {
  const rad = (p.r * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const x = lx * p.s;
  const y = ly * p.s;
  return { x: p.x + x * cos - y * sin, y: p.y + x * sin + y * cos };
}

function angleAt(cx: number, cy: number, x: number, y: number) {
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
}

export default function DesignStep({
  design,
  setDesign,
  commission,
  onStart,
}: {
  design: Design;
  setDesign: (d: Design) => void;
  commission?: Commission;
  onStart: () => void;
}) {
  const [selected, setSelectedIds] = useState<string[]>([]);
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<DragState | null>(null);
  const piecesRef = useRef(design.pieces);
  useEffect(() => {
    piecesRef.current = design.pieces;
  }, [design.pieces]);
  const lang = useSave((s) => s.lang);
  const inventory = useSave((s) => s.inventory);
  const money = useSave((s) => s.money);
  const buy = useSave((s) => s.buy);
  const missingFor = useSave((s) => s.missingFor);

  const counts = countMotifs(design.pieces);
  const missing = missingFor(design);
  const selPieces = design.pieces.filter((p) => selected.includes(p.id));
  const sel = selPieces.length === 1 ? selPieces[0] : undefined;
  const cost = costFor(design);
  const setSelected = (id?: string) => setSelectedIds(id ? [id] : []);

  const update = (pieces: PlacedPiece[]) => {
    piecesRef.current = pieces;
    setDesign({ ...design, pieces });
  };
  const patch = (id: string, f: (p: PlacedPiece) => PlacedPiece) =>
    update(design.pieces.map((p) => (p.id === id ? f(p) : p)));

  const addMotif = (m: MotifId) => {
    if (design.pieces.length >= MAX_PIECES) return;
    sfx.pop();
    let p = newPiece(m, design.pearl);
    const origin =
      sel && sel.motif === m && MOTIFS[m].tile
        ? sel
        : [...design.pieces].reverse().find((x) => x.motif === m && MOTIFS[m].tile);
    if (origin) {
      const slot = nextPatternSlot(origin, design.pieces);
      if (slot) p = { ...p, ...slot, r: origin.r, s: origin.s, pearl: origin.pearl ?? design.pearl };
    }
    update([...design.pieces, p]);
    setSelected(p.id);
  };

  const toLocal = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 300, y: ((e.clientY - r.top) / r.height) * 300 };
  };

  const endDrag = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === "marquee") {
      setMarquee(null);
      const r = marqueeRect(d);
      if (r.w < 3 && r.h < 3) {
        if (!d.add) setSelectedIds([]);
        return;
      }
      const hit = piecesRef.current
        .filter((p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h)
        .map((p) => p.id);
      setSelectedIds([...new Set([...d.base, ...hit])]);
      if (hit.length) sfx.tick();
      return;
    }
    if (d.kind !== "move" || d.origins.length !== 1) return;
    const id = d.origins[0].id;
    const pieces = piecesRef.current;
    update(pieces.map((p) => (p.id === id ? snapToPattern(p, pieces) : p)));
  };

  const removeSelected = () => {
    update(design.pieces.filter((p) => !selected.includes(p.id)));
    setSelectedIds([]);
  };

  const duplicateSelected = () => {
    if (design.pieces.length + selPieces.length > MAX_PIECES) return;
    const copies = selPieces.map((p) => ({
      ...p,
      id: uid(),
      x: Math.min(285, p.x + 22),
      y: Math.min(285, p.y + 14),
    }));
    update([...design.pieces, ...copies]);
    setSelectedIds(copies.map((c) => c.id));
  };

  const capture = (e: React.PointerEvent) => {
    e.stopPropagation();
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  return (
    <div className="flex flex-col gap-3">
      <StepHeader title={t(lang, "design.title")} emoji="✏️">
        {commission ? <>{t(lang, "design.tipCommission")}</> : <>{t(lang, "design.tipFree")}</>}
      </StepHeader>

      {commission && (
        <div className="panel flex flex-wrap items-center gap-2 py-2 text-sm">
          <b className="text-[var(--brown)]">{t(lang, "design.order")}</b>
          <span className="chip">{shapeName(lang, commission.shape)}</span>
          <span className={`chip ${design.lacquer === commission.lacquer ? "chip-ok" : ""}`}>
            <span className="swatch" style={{ background: LACQUERS[commission.lacquer].color }} />
            {lacquerName(lang, commission.lacquer)}
          </span>
          {commission.pearl && (
            <span className={`chip ${pearlShare(design, commission.pearl) >= 0.5 ? "chip-ok" : ""}`}>
              <NacreSwatch pearl={commission.pearl} className="swatch" /> {pearlName(lang, commission.pearl)}
            </span>
          )}
          {(Object.entries(commission.motifs) as [MotifId, number][]).map(([m, n]) => (
            <span key={m} className={`chip ${(counts[m] ?? 0) === n ? "chip-ok" : ""}`}>
              <MotifIcon motif={m} className="h-5 w-5" /> {motifName(lang, m)} {counts[m] ?? 0}/{n}
            </span>
          ))}
        </div>
      )}

      <div className="workbench sketch-paper">
        <svg
          ref={svgRef}
          viewBox="0 0 300 300"
          className="aspect-square w-full"
          style={{ touchAction: "none" }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d) return;
            const p = toLocal(e);
            if (d.kind === "marquee") {
              d.x1 = Math.max(0, Math.min(300, p.x));
              d.y1 = Math.max(0, Math.min(300, p.y));
              setMarquee(marqueeRect(d));
              return;
            }
            if (d.kind === "move") {
              let dx = p.x - d.sx;
              let dy = p.y - d.sy;
              for (const o of d.origins) {
                dx = Math.max(10 - o.x, Math.min(290 - o.x, dx));
                dy = Math.max(10 - o.y, Math.min(290 - o.y, dy));
              }
              const at = new Map(d.origins.map((o) => [o.id, o]));
              update(
                piecesRef.current.map((pc) => {
                  const o = at.get(pc.id);
                  return o ? { ...pc, x: o.x + dx, y: o.y + dy } : pc;
                }),
              );
              return;
            }
            const piece = piecesRef.current.find((pc) => pc.id === d.id);
            if (!piece) return;
            if (d.kind === "scale") {
              const dist = Math.hypot(p.x - piece.x, p.y - piece.y);
              if (d.startDist < 1) return;
              const next = Math.max(MIN_S, Math.min(MAX_S, +((d.startS * dist) / d.startDist).toFixed(3)));
              patch(d.id, (pc) => ({ ...pc, s: next }));
              return;
            }
            const ang = angleAt(piece.x, piece.y, p.x, p.y);
            let r = d.startR + (ang - d.startAngle);
            r = ((r % 360) + 360) % 360;
            patch(d.id, (pc) => ({ ...pc, r: +r.toFixed(1) }));
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const l = toLocal(e);
            const add = e.shiftKey || e.metaKey || e.ctrlKey;
            drag.current = { kind: "marquee", x0: l.x, y0: l.y, x1: l.x, y1: l.y, add, base: add ? selected : [] };
          }}
        >
          <Artwork
            design={design}
            selectedIds={selected}
            onPiecePointerDown={(e, p) => {
              capture(e);
              const l = toLocal(e);
              let ids = selected;
              if (e.shiftKey || e.metaKey || e.ctrlKey) {
                ids = selected.includes(p.id) ? selected.filter((x) => x !== p.id) : [...selected, p.id];
                setSelectedIds(ids);
                if (!ids.includes(p.id)) return;
              } else if (!selected.includes(p.id)) {
                ids = [p.id];
                setSelectedIds(ids);
              }
              drag.current = {
                kind: "move",
                sx: l.x,
                sy: l.y,
                origins: piecesRef.current.filter((pc) => ids.includes(pc.id)).map((pc) => ({ id: pc.id, x: pc.x, y: pc.y })),
              };
              sfx.tick();
            }}
          />
          {marquee && (
            <rect
              x={marquee.x}
              y={marquee.y}
              width={marquee.w}
              height={marquee.h}
              fill="rgba(226,194,122,0.14)"
              stroke="#c4a05a"
              strokeWidth="1.2"
              strokeDasharray="4 3"
              className="pointer-events-none"
            />
          )}
          {sel && (
            <PieceEditChrome
              piece={sel}
              onScaleStart={(e) => {
                capture(e);
                const l = toLocal(e);
                const dist = Math.hypot(l.x - sel.x, l.y - sel.y);
                drag.current = { kind: "scale", id: sel.id, startDist: Math.max(1, dist), startS: sel.s };
                sfx.tick();
              }}
              onRotateStart={(e) => {
                capture(e);
                const l = toLocal(e);
                drag.current = {
                  kind: "rotate",
                  id: sel.id,
                  startAngle: angleAt(sel.x, sel.y, l.x, l.y),
                  startR: sel.r,
                };
                sfx.tick();
              }}
            />
          )}
        </svg>
      </div>

      {sel ? (
        <div className="panel flex flex-col gap-2 py-2">
          <div className="flex items-center justify-between gap-1">
            <span className="flex items-center gap-1 text-sm text-[var(--brown)]">
              <MotifIcon motif={sel.motif} pearl={piecePearl(sel, design)} className="h-6 w-6" />
              {motifName(lang, sel.motif)}
            </span>
            <div className="flex gap-1">
              <Btn
                size="sm"
                variant="lavender"
                disabled={design.pieces.length >= MAX_PIECES}
                onClick={() => {
                  let c: PlacedPiece = {
                    ...sel,
                    id: uid(),
                    x: Math.min(285, sel.x + 22),
                    y: Math.min(285, sel.y + 14),
                  };
                  if (MOTIFS[sel.motif].tile) {
                    const slot = nextPatternSlot(sel, design.pieces);
                    if (slot) c = { ...c, ...slot };
                  }
                  update([...design.pieces, c]);
                  setSelected(c.id);
                }}
              >
                {MOTIFS[sel.motif].tile ? t(lang, "design.chain") : t(lang, "design.dup")}
              </Btn>
              <Btn
                size="sm"
                variant="pink"
                onClick={() => {
                  update(design.pieces.filter((p) => p.id !== sel.id));
                  setSelected(undefined);
                }}
              >
                🗑
              </Btn>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--brown-light)]">{t(lang, "design.pieceShell")}</span>
            {PEARL_LIST.map((p) => (
              <button
                key={p.id}
                className={`pearl-pick ${piecePearl(sel, design) === p.id ? "on" : ""}`}
                title={pearlName(lang, p.id)}
                onClick={() => {
                  sfx.click();
                  patch(sel.id, (pc) => ({ ...pc, pearl: p.id }));
                }}
              >
                <NacreSwatch pearl={p.id} className="swatch" />
              </button>
            ))}
          </div>
        </div>
      ) : selPieces.length > 1 ? (
        <div className="panel flex flex-col gap-2 py-2">
          <div className="flex items-center justify-between gap-1">
            <span className="text-sm text-[var(--brown)]">{t(lang, "design.multi", { n: selPieces.length })}</span>
            <div className="flex gap-1">
              <Btn
                size="sm"
                variant="lavender"
                disabled={design.pieces.length + selPieces.length > MAX_PIECES}
                onClick={duplicateSelected}
              >
                {t(lang, "design.dup")}
              </Btn>
              <Btn size="sm" variant="pink" onClick={removeSelected}>
                🗑
              </Btn>
              <Btn size="sm" variant="cream" onClick={() => setSelectedIds([])}>
                ✕
              </Btn>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-[var(--brown-light)]">{t(lang, "design.pieceShell")}</span>
            {PEARL_LIST.map((p) => (
              <button
                key={p.id}
                className={`pearl-pick ${selPieces.every((pc) => piecePearl(pc, design) === p.id) ? "on" : ""}`}
                title={pearlName(lang, p.id)}
                onClick={() => {
                  sfx.click();
                  update(design.pieces.map((pc) => (selected.includes(pc.id) ? { ...pc, pearl: p.id } : pc)));
                }}
              >
                <NacreSwatch pearl={p.id} className="swatch" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center text-xs text-[var(--brown-light)]">{t(lang, "design.selectHint")}</div>
      )}

      <div className="panel flex flex-col gap-3 py-3">
        <div>
          <div className="label">{t(lang, "design.motifs", { n: design.pieces.length, max: MAX_PIECES })}</div>
          <div className="grid grid-cols-4 gap-2">
            {SHAPE_MOTIFS.map((m) => (
              <button key={m.id} className="motif-btn" onClick={() => addMotif(m.id)} title={motifMeaning(lang, m.id)}>
                <MotifIcon motif={m.id} pearl={design.pearl} className="h-9 w-9" />
                <span>{motifName(lang, m.id)}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="label">{t(lang, "design.patternMotifs")}</div>
          <div className="grid grid-cols-4 gap-2">
            {PATTERN_MOTIFS.map((m) => (
              <button key={m.id} className="motif-btn" onClick={() => addMotif(m.id)} title={motifMeaning(lang, m.id)}>
                <MotifIcon motif={m.id} pearl={design.pearl} className="h-9 w-9" />
                <span>{motifName(lang, m.id)}</span>
              </button>
            ))}
          </div>
        </div>

        {!commission && (
          <div>
            <div className="label">{t(lang, "design.shape")}</div>
            <div className="grid grid-cols-4 gap-2">
              {SHAPE_LIST.map((s) => (
                <button
                  key={s.id}
                  className={`opt-btn ${design.shape === s.id ? "on" : ""}`}
                  onClick={() => {
                    sfx.click();
                    setDesign({ ...design, shape: s.id });
                  }}
                >
                  <svg viewBox="0 0 300 300" className="h-8 w-8">
                    <path d={s.path} fill="#a77c52" />
                  </svg>
                  <span>{shapeName(lang, s.id)}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="label">{t(lang, "design.lacquer")}</div>
          <div className="grid grid-cols-4 gap-2">
            {LACQUER_LIST.map((l) => (
              <button
                key={l.id}
                className={`opt-btn ${design.lacquer === l.id ? "on" : ""}`}
                onClick={() => {
                  sfx.click();
                  setDesign({ ...design, lacquer: l.id });
                }}
              >
                <span className="swatch lg" style={{ background: `radial-gradient(circle at 35% 30%, ${l.light}, ${l.color})` }} />
                <span>{lacquerName(lang, l.id)}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="label">{t(lang, "design.newPearl")}</div>
          <div className="grid grid-cols-2 gap-2">
            {PEARL_LIST.map((p) => (
              <button
                key={p.id}
                className={`opt-btn row ${design.pearl === p.id ? "on" : ""}`}
                onClick={() => {
                  sfx.click();
                  setDesign({ ...design, pearl: p.id });
                }}
              >
                <NacreSwatch pearl={p.id} className="swatch lg shrink-0" />
                <span className="text-left">
                  {pearlName(lang, p.id)}
                  <br />
                  <small>{t(lang, "design.owned", { n: inventory[p.material] })}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel py-3">
        <div className="label">{t(lang, "design.materials")}</div>
        <div className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2">
          {(Object.entries(cost) as [MaterialId, number][]).map(([k, n]) => (
            <div key={k} className={`mat flex items-center justify-between gap-2 ${inventory[k] < n ? "lack" : ""}`}>
              <span className="min-w-0 truncate">
                {MATERIALS[k].emoji} {lang === "ko" ? materialName(lang, k).split(" ")[0] : materialName(lang, k)} {inventory[k]}/{n}
              </span>
              <button
                className="mat-buy"
                disabled={money < MATERIALS[k].price}
                title={t(lang, "design.buyPack", { n: MATERIALS[k].pack })}
                onClick={() => {
                  if (buy(k)) sfx.coin();
                  else sfx.fail();
                }}
              >
                <Coin /> {MATERIALS[k].price}
              </button>
            </div>
          ))}
        </div>
        {missing.length > 0 && <div className="mt-2 text-sm text-[var(--red)]">{t(lang, "design.lack")}</div>}
      </div>

      <Btn
        variant="pink"
        size="lg"
        disabled={design.pieces.length === 0 || missing.length > 0}
        onClick={onStart}
      >
        {design.pieces.length === 0 ? t(lang, "design.needMotif") : t(lang, "design.start")}
      </Btn>
    </div>
  );
}

const CORNER_CURSORS = ["nwse-resize", "nesw-resize", "nwse-resize", "nesw-resize"] as const;

function PieceEditChrome({
  piece,
  onScaleStart,
  onRotateStart,
}: {
  piece: PlacedPiece;
  onScaleStart: (e: React.PointerEvent) => void;
  onRotateStart: (e: React.PointerEvent) => void;
}) {
  const box = motifLocalBox(piece.motif);
  const corners = [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x + box.w, box.y + box.h],
    [box.x, box.y + box.h],
  ].map(([lx, ly]) => localToWorld(piece, lx, ly));
  const topMid = localToWorld(piece, box.x + box.w / 2, box.y);
  const rot = localToWorld(piece, box.x + box.w / 2, box.y - 20 / Math.max(piece.s, 0.6));
  const hs = 5.5;

  return (
    <g className="piece-edit-chrome" style={{ pointerEvents: "auto" }}>
      <polygon
        points={corners.map((c) => `${c.x},${c.y}`).join(" ")}
        fill="none"
        stroke="#e2c27a"
        strokeWidth="1.4"
        strokeDasharray="4 3"
        className="pointer-events-none"
      />
      <line
        x1={topMid.x}
        y1={topMid.y}
        x2={rot.x}
        y2={rot.y}
        stroke="#e2c27a"
        strokeWidth="1.4"
        className="pointer-events-none"
      />
      <circle
        cx={rot.x}
        cy={rot.y}
        r="7"
        fill="#fffdf8"
        stroke="#c4a05a"
        strokeWidth="1.6"
        style={{ cursor: "grab" }}
        onPointerDown={onRotateStart}
      />
      <path
        d="M0 -3.4 A3.4 3.4 0 1 1 -3.4 0 M-5.1 0.4 L-3.4 -1.4 L-1.7 0.4"
        transform={`translate(${rot.x} ${rot.y}) rotate(${piece.r})`}
        fill="none"
        stroke="#8a6a3a"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none"
      />
      {corners.map((c, i) => (
        <rect
          key={i}
          x={c.x - hs}
          y={c.y - hs}
          width={hs * 2}
          height={hs * 2}
          rx="1.5"
          fill="#fffdf8"
          stroke="#c4a05a"
          strokeWidth="1.5"
          style={{ cursor: CORNER_CURSORS[i] }}
          onPointerDown={onScaleStart}
        />
      ))}
    </g>
  );
}
