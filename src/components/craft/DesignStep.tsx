"use client";

import { useEffect, useRef, useState } from "react";
import Artwork from "@/components/Artwork";
import { Btn } from "@/components/ui";
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
  turnPiece,
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
import { costFor, useSave, useUI } from "@/lib/store";
import { StepHeader } from "./common";

const MAX_PIECES = 32;

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
  const [selected, setSelected] = useState<string | undefined>();
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const piecesRef = useRef(design.pieces);
  useEffect(() => {
    piecesRef.current = design.pieces;
  }, [design.pieces]);
  const lang = useSave((s) => s.lang);
  const inventory = useSave((s) => s.inventory);
  const missingFor = useSave((s) => s.missingFor);
  const go = useUI((s) => s.go);

  const counts = countMotifs(design.pieces);
  const missing = missingFor(design);
  const sel = design.pieces.find((p) => p.id === selected);
  const cost = costFor(design);

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
    const pieces = piecesRef.current;
    const next = pieces.map((p) => (p.id === d.id ? snapToPattern(p, pieces) : p));
    update(next);
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
            patch(d.id, (pc) => ({
              ...pc,
              x: Math.max(10, Math.min(290, p.x - d.dx)),
              y: Math.max(10, Math.min(290, p.y - d.dy)),
            }));
          }}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerDown={() => setSelected(undefined)}
        >
          <Artwork
            design={design}
            selectedId={selected}
            onPiecePointerDown={(e, p) => {
              e.stopPropagation();
              svgRef.current!.setPointerCapture(e.pointerId);
              const l = toLocal(e);
              drag.current = { id: p.id, dx: l.x - p.x, dy: l.y - p.y };
              setSelected(p.id);
              sfx.tick();
            }}
          />
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
              <Btn size="sm" variant="cream" onClick={() => patch(sel.id, (p) => ({ ...p, r: turnPiece(p.r, -1) }))}>
                ↺
              </Btn>
              <Btn size="sm" variant="cream" onClick={() => patch(sel.id, (p) => ({ ...p, r: turnPiece(p.r, 1) }))}>
                ↻
              </Btn>
              <Btn size="sm" variant="cream" onClick={() => patch(sel.id, (p) => ({ ...p, s: Math.max(0.5, +(p.s - 0.15).toFixed(2)) }))}>
                －
              </Btn>
              <Btn size="sm" variant="cream" onClick={() => patch(sel.id, (p) => ({ ...p, s: Math.min(2, +(p.s + 0.15).toFixed(2)) }))}>
                ＋
              </Btn>
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
      ) : null}

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
        <div className="grid grid-cols-3 gap-1.5 text-sm">
          {(Object.entries(cost) as [MaterialId, number][]).map(([k, n]) => (
            <div key={k} className={`mat ${inventory[k] < n ? "lack" : ""}`}>
              {MATERIALS[k].emoji} {lang === "ko" ? materialName(lang, k).split(" ")[0] : materialName(lang, k)} {inventory[k]}/{n}
            </div>
          ))}
        </div>
        {missing.length > 0 && (
          <div className="mt-2 flex items-center justify-between gap-2 text-sm text-[var(--red)]">
            {t(lang, "design.lack")}
            <Btn size="sm" variant="gold" onClick={() => go("shop")}>
              {t(lang, "design.goShop")}
            </Btn>
          </div>
        )}
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
