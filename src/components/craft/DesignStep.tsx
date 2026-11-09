"use client";

import { useRef, useState } from "react";
import Artwork from "@/components/Artwork";
import { Btn } from "@/components/ui";
import MotifIcon from "@/components/MotifIcon";
import {
  CRAFT_COST,
  LACQUERS,
  LACQUER_LIST,
  MATERIALS,
  MOTIFS,
  MOTIF_LIST,
  PEARLS,
  SHAPE_LIST,
  type MaterialId,
  type MotifId,
} from "@/lib/data";
import { countMotifs, newPiece, uid, type Commission, type Design, type PlacedPiece } from "@/lib/game";
import { sfx } from "@/lib/sound";
import { useSave, useUI } from "@/lib/store";
import { StepHeader } from "./common";

const MAX_PIECES = 16;

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
  const inventory = useSave((s) => s.inventory);
  const missingFor = useSave((s) => s.missingFor);
  const go = useUI((s) => s.go);

  const counts = countMotifs(design.pieces);
  const missing = missingFor(design);
  const pearlMat = PEARLS[design.pearl].material;
  const sel = design.pieces.find((p) => p.id === selected);

  const update = (pieces: PlacedPiece[]) => setDesign({ ...design, pieces });
  const patch = (id: string, f: (p: PlacedPiece) => PlacedPiece) =>
    update(design.pieces.map((p) => (p.id === id ? f(p) : p)));

  const addMotif = (m: MotifId) => {
    if (design.pieces.length >= MAX_PIECES) return;
    sfx.pop();
    const p = newPiece(m);
    update([...design.pieces, p]);
    setSelected(p.id);
  };

  const toLocal = (e: { clientX: number; clientY: number }) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * 300, y: ((e.clientY - r.top) / r.height) * 300 };
  };

  const cost: Partial<Record<MaterialId, number>> = { ...CRAFT_COST, [pearlMat]: design.pieces.length };

  return (
    <div className="flex flex-col gap-3">
      <StepHeader title="디자인하기" emoji="✏️">
        {commission ? (
          <>손님의 주문서를 잘 보고 문양을 배치해 보렴. 요구한 문양과 개수를 맞추면 손님이 기뻐하실 게다.</>
        ) : (
          <>마음 가는 대로 꾸며 보렴. 문양을 눌러 추가하고, 끌어서 옮길 수 있단다.</>
        )}
      </StepHeader>

      {commission && (
        <div className="panel flex flex-wrap items-center gap-2 py-2 text-sm">
          <b className="text-[var(--brown)]">📜 주문서</b>
          <span className="chip">{SHAPE_LIST.find((s) => s.id === commission.shape)!.name}</span>
          <span className={`chip ${design.lacquer === commission.lacquer ? "chip-ok" : ""}`}>
            <span className="swatch" style={{ background: LACQUERS[commission.lacquer].color }} />
            {LACQUERS[commission.lacquer].name}
          </span>
          {commission.pearl && (
            <span className={`chip ${design.pearl === commission.pearl ? "chip-ok" : ""}`}>
              🌈 {PEARLS[commission.pearl].name}
            </span>
          )}
          {(Object.entries(commission.motifs) as [MotifId, number][]).map(([m, n]) => (
            <span key={m} className={`chip ${(counts[m] ?? 0) === n ? "chip-ok" : ""}`}>
              <MotifIcon motif={m} className="h-5 w-5" /> {MOTIFS[m].name} {counts[m] ?? 0}/{n}
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
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
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
        <div className="panel flex items-center justify-between gap-1 py-2">
          <span className="flex items-center gap-1 text-sm text-[var(--brown)]">
            <MotifIcon motif={sel.motif} className="h-6 w-6" />
            {MOTIFS[sel.motif].name}
          </span>
          <div className="flex gap-1">
            <Btn size="sm" variant="cream" onClick={() => patch(sel.id, (p) => ({ ...p, r: p.r - 15 }))}>
              ↺
            </Btn>
            <Btn size="sm" variant="cream" onClick={() => patch(sel.id, (p) => ({ ...p, r: p.r + 15 }))}>
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
                const c = { ...sel, id: uid(), x: Math.min(285, sel.x + 22), y: Math.min(285, sel.y + 14) };
                update([...design.pieces, c]);
                setSelected(c.id);
              }}
            >
              복제
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
      ) : null}

      <div className="panel flex flex-col gap-3 py-3">
        <div>
          <div className="label">자개 문양 ({design.pieces.length}/{MAX_PIECES})</div>
          <div className="grid grid-cols-4 gap-2">
            {MOTIF_LIST.map((m) => (
              <button key={m.id} className="motif-btn" onClick={() => addMotif(m.id)} title={m.meaning}>
                <MotifIcon motif={m.id} pearl={design.pearl} className="h-9 w-9" />
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        </div>

        {!commission && (
          <div>
            <div className="label">백골 모양</div>
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
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="label">옻칠 색</div>
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
                <span>{l.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="label">자개 종류</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(PEARLS).map((p) => (
              <button
                key={p.id}
                className={`opt-btn row ${design.pearl === p.id ? "on" : ""}`}
                onClick={() => {
                  sfx.click();
                  setDesign({ ...design, pearl: p.id });
                }}
              >
                <span className="swatch lg" style={{ background: `linear-gradient(135deg, ${p.stops.join(",")})` }} />
                <span className="text-left">
                  {p.name}
                  <br />
                  <small>보유 {inventory[p.material]}조각</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="panel py-3">
        <div className="label">필요한 재료</div>
        <div className="grid grid-cols-3 gap-1.5 text-sm">
          {(Object.entries(cost) as [MaterialId, number][]).map(([k, n]) => (
            <div key={k} className={`mat ${inventory[k] < n ? "lack" : ""}`}>
              {MATERIALS[k].emoji} {MATERIALS[k].name.split(" ")[0]} {inventory[k]}/{n}
            </div>
          ))}
        </div>
        {missing.length > 0 && (
          <div className="mt-2 flex items-center justify-between gap-2 text-sm text-[var(--red)]">
            재료가 부족해요!
            <Btn size="sm" variant="gold" onClick={() => go("shop")}>
              🛒 상점 가기
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
        {design.pieces.length === 0 ? "자개 문양을 하나 이상 배치해 주세요" : "디자인 완성! 제작 시작 🔨"}
      </Btn>
    </div>
  );
}
