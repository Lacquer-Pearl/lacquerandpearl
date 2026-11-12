"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MotifSilhouette } from "@/components/Artwork";
import MotifIcon from "@/components/MotifIcon";
import { Btn, Meter } from "@/components/ui";
import { PEARLS, motifCutRoutes, motifLocalBox, motifOutline, type MotifId, type PearlId } from "@/lib/data";
import { polygonsFromPaths } from "@/lib/cutFragments";
import { newPiece, piecePearl, turnPiece, type Design, type PlacedPiece } from "@/lib/game";
import { pearlName, t } from "@/lib/i18n";
import { sfx } from "@/lib/sound";
import { useSave } from "@/lib/store";
import {
  autoNest,
  commitNest,
  freeRatio,
  makeSheet,
  placementFits,
  poseKeys,
  type NestPiece,
  type ShellLedger,
  type ShellPlacement,
  type ShellPlan,
  type ShellSheet,
} from "@/lib/shellNest";
import { StepHeader } from "./common";

const polys = new Map<string, { x: number; y: number }[][]>();

export function motifPolygons(id: string) {
  const hit = polys.get(id);
  if (hit) return hit;
  const motif = id as MotifId;
  const routes = motifCutRoutes(motif);
  const parsed = routes?.length ? polygonsFromPaths(routes.map((route) => route.d)) : [];
  const shape = parsed.length
    ? parsed
    : (() => {
        const box = motifLocalBox(motif);
        return [
          [
            { x: box.x, y: box.y },
            { x: box.x + box.w, y: box.y },
            { x: box.x + box.w, y: box.y + box.h },
            { x: box.x, y: box.h + box.y },
          ],
        ];
      })();
  polys.set(id, shape);
  return shape;
}

function toNest(piece: PlacedPiece, design: Design, locked?: boolean): NestPiece {
  return {
    id: piece.id,
    motifId: piece.motif,
    pearl: piecePearl(piece, design),
    s: piece.s,
    polygons: motifPolygons(piece.motif),
    locked,
  };
}

function loadEditor(design: Design, ledger: ShellLedger, initial?: ShellPlan) {
  const pearls = new Set(design.pieces.map((piece) => piecePearl(piece, design)));
  const mine = new Set(design.pieces.map((piece) => piece.id));
  const fromLedger = ledger.sheets.filter((sheet) => pearls.has(sheet.pearl));
  const extra = (initial?.sheets ?? []).filter((sheet) => pearls.has(sheet.pearl) && !fromLedger.some((item) => item.id === sheet.id));
  const cut = new Set(fromLedger.flatMap((sheet) => sheet.cutPieceIds));
  const sheets = [
    ...fromLedger.map((sheet) => ({
      ...sheet,
      placements: sheet.placements.filter((item) => cut.has(item.pieceId) || !mine.has(item.pieceId)),
    })),
    ...extra.map((sheet) => ({ ...sheet, placements: [] as ShellPlacement[] })),
  ];
  const placements = (initial?.placements ?? []).filter((item) => mine.has(item.pieceId) && !cut.has(item.pieceId));
  return { sheets, placements };
}

export default function NestStep({
  design,
  ledger,
  stock,
  legacyPrepaid = false,
  initial,
  onChange,
  onConfirm,
  embedded = false,
  confirmLabel,
}: {
  design: Design;
  ledger: ShellLedger;
  stock: Partial<Record<PearlId, number>>;
  legacyPrepaid?: boolean;
  initial?: ShellPlan;
  onChange: (plan: ShellPlan) => void;
  onConfirm: (plan: ShellPlan) => { ok: true } | { ok: false; missing: PearlId };
  /** 디자인 단계 안에 넣을 때 제목은 바깥에서 보여 준다. */
  embedded?: boolean;
  confirmLabel?: string;
}) {
  const lang = useSave((s) => s.lang);
  const boot = useMemo(() => loadEditor(design, ledger, initial), [design, initial, ledger]);
  const [sheets, setSheets] = useState<ShellSheet[]>(boot.sheets);
  const [placements, setPlacements] = useState<ShellPlacement[]>(boot.placements);
  const [pearl, setPearl] = useState<PearlId>(piecePearl(design.pieces[0], design));
  const [activeId, setActiveId] = useState<string | null>(boot.sheets.find((sheet) => sheet.pearl === piecePearl(design.pieces[0], design))?.id ?? null);
  const [selected, setSelected] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [msg, setMsg] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; dx: number; dy: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const history = useRef<{ sheets: ShellSheet[]; placements: ShellPlacement[] }[]>([]);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const ledgerIds = useMemo(() => new Set(ledger.sheets.map((sheet) => sheet.id)), [ledger.sheets]);
  const cutIds = useMemo(() => new Set(sheets.flatMap((sheet) => sheet.cutPieceIds)), [sheets]);
  const pearls = [...new Set(design.pieces.map((piece) => piecePearl(piece, design)))];
  const visible = sheets.filter((sheet) => sheet.pearl === pearl);
  const active = visible.find((sheet) => sheet.id === activeId) ?? visible[0];

  useEffect(() => {
    const used = new Set(placements.map((item) => item.sheetId));
    onChangeRef.current({
      sheets: sheets.filter((sheet) => used.has(sheet.id) && !ledgerIds.has(sheet.id)),
      placements,
    });
  }, [ledgerIds, placements, sheets]);

  const remember = () => {
    history.current.push(JSON.parse(JSON.stringify({ sheets, placements })));
    if (history.current.length > 30) history.current.shift();
  };

  const placedIds = new Set([
    ...placements.map((item) => item.pieceId),
    ...[...cutIds].filter((id) => design.pieces.some((piece) => piece.id === id)),
  ]);
  const unplaced = design.pieces.filter((piece) => !placedIds.has(piece.id) && !cutIds.has(piece.id));
  const waiting = unplaced.filter((piece) => piecePearl(piece, design) === pearl);
  const mineOnSheet = placements.filter((item) => item.sheetId === active?.id);
  const selectedPlacement = placements.find((item) => item.pieceId === selected);
  const drafts = sheets.filter((sheet) => sheet.pearl === pearl && !ledgerIds.has(sheet.id)).length;
  const room = legacyPrepaid ? 6 : Math.max(0, (stock[pearl] ?? 0) - drafts);
  const fresh = sheets.filter((sheet) => !ledgerIds.has(sheet.id) && placements.some((item) => item.sheetId === sheet.id)).length;
  const activeCount = ledger.sheets.filter((sheet) => sheet.pearl === pearl && sheet.status === "active").length;
  const polyOf = (placement: ShellPlacement) => motifPolygons(placement.motifId);

  const say = (key: "nest.outside" | "nest.overlap" | "nest.fit" | "nest.cutLocked") => {
    sfx.fail();
    setMsg(t(lang, key));
  };

  const blockers = (sheet: ShellSheet, except?: string) => [
    ...sheet.placements.filter((item) => item.pieceId !== except),
    ...placements.filter((item) => item.sheetId === sheet.id && item.pieceId !== except),
  ];

  const occupied = (sheet: ShellSheet, except?: string) => {
    const keys = new Set<string>();
    for (const item of blockers(sheet, except)) {
      for (const cell of poseKeys(motifPolygons(item.motifId), item.s, item.r, item.x, item.y)) keys.add(cell.key);
    }
    return keys;
  };

  const pointOf = (e: { clientX: number; clientY: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || !active) return null;
    return { x: ((e.clientX - rect.left) / rect.width) * active.width, y: ((e.clientY - rect.top) / rect.height) * active.height };
  };

  const placeWaiting = (id: string) => {
    if (!active) {
      say("nest.fit");
      return;
    }
    const source = design.pieces.find((piece) => piece.id === id);
    if (!source || piecePearl(source, design) !== active.pearl) return;
    const packed = autoNest([toNest(source, design)], [{ ...active, placements: blockers(active, id) }], { [active.pearl]: 0 });
    if (!packed.placements.length) {
      say("nest.fit");
      return;
    }
    remember();
    sfx.pop();
    setPlacements([...placements.filter((item) => item.pieceId !== id), packed.placements[0]]);
    setSelected(id);
    setMsg(null);
  };

  const moveTo = (id: string, x: number, y: number, r: number) => {
    if (!active) return false;
    if (cutIds.has(id)) {
      say("nest.cutLocked");
      return false;
    }
    const source = design.pieces.find((piece) => piece.id === id);
    if (!source) return false;
    const current = placements.find((item) => item.pieceId === id);
    const reason = placementFits(active, toNest(source, design), { x, y, r }, occupied(active, id));
    if (reason !== "ok") {
      say(reason === "overlap" ? "nest.overlap" : "nest.outside");
      return false;
    }
    remember();
    const next = {
      pieceId: id,
      motifId: source.motif,
      sheetId: active.id,
      x,
      y,
      r,
      s: source.s,
      locked: current?.locked,
    };
    setPlacements([...placements.filter((item) => item.pieceId !== id), next]);
    setSelected(id);
    setMsg(null);
    return true;
  };

  const runAuto = () => {
    const nestPieces = design.pieces.map((piece) =>
      toNest(piece, design, placements.find((item) => item.pieceId === piece.id)?.locked || cutIds.has(piece.id)),
    );
    const base = sheets.map((sheet) => ({
      ...sheet,
      placements: [
        ...sheet.placements,
        ...placements.filter((item) => item.sheetId === sheet.id && (item.locked || cutIds.has(item.pieceId))),
      ],
    }));
    const unopened: Partial<Record<PearlId, number>> = {};
    for (const kind of pearls) {
      const openDrafts = sheets.filter((sheet) => sheet.pearl === kind && !ledgerIds.has(sheet.id)).length;
      unopened[kind] = legacyPrepaid ? 6 : Math.max(0, (stock[kind] ?? 0) - openDrafts);
    }
    const result = autoNest(nestPieces, base, unopened, (placement) => motifPolygons(placement.motifId));
    remember();
    const editable = new Set(design.pieces.map((piece) => piece.id));
    setSheets(
      result.sheets.map((sheet) => ({
        ...sheet,
        placements: sheet.placements.filter((item) => !editable.has(item.pieceId) || sheet.cutPieceIds.includes(item.pieceId)),
      })),
    );
    setPlacements(result.placements.filter((item) => editable.has(item.pieceId) && !cutIds.has(item.pieceId)));
    sfx.pop();
    setMsg(result.unplaced.length ? t(lang, "nest.fit") : t(lang, "nest.autoNote"));
  };

  const confirm = () => {
    if (unplaced.length > 0) {
      say("nest.fit");
      return;
    }
    const used = new Set(placements.map((item) => item.sheetId));
    const plan: ShellPlan = {
      sheets: sheets.filter((sheet) => used.has(sheet.id) && !ledgerIds.has(sheet.id)),
      placements,
    };
    const result = onConfirm(plan);
    if (!result.ok) {
      sfx.fail();
      setMsg(t(lang, "nest.missing", { name: pearlName(lang, result.missing) }));
      return;
    }
    sfx.success();
  };

  const shown = active
    ? {
        ...active,
        placements: [...active.placements, ...mineOnSheet],
      }
    : null;
  const free = shown ? Math.round(freeRatio(shown, polyOf) * 100) : 0;

  return (
    <div className="flex flex-col gap-3" data-nest-step="1">
      {embedded ? (
        <p className="panel py-2 text-sm text-[var(--brown)]">{t(lang, "nest.tip")}</p>
      ) : (
        <StepHeader title={t(lang, "nest.title")} icon="cutter">
          {t(lang, "nest.tip")}
        </StepHeader>
      )}
      {legacyPrepaid && <p className="panel py-2 text-sm text-[var(--brown)]">{t(lang, "nest.legacy")}</p>}
      <div className="panel grid grid-cols-2 gap-1.5 py-2 text-sm text-[var(--brown)]">
        <span>
          {t(lang, "nest.pearl")} · {pearlName(lang, pearl)}
        </span>
        <span>{t(lang, "nest.unused", { n: stock[pearl] ?? 0 })}</span>
        <span>{t(lang, "nest.active", { n: activeCount })}</span>
        <span>{t(lang, "nest.extra", { n: legacyPrepaid ? 0 : fresh })}</span>
        <span>{t(lang, "nest.placed", { n: design.pieces.length - unplaced.length, max: design.pieces.length })}</span>
        <span>{t(lang, "nest.waiting", { n: unplaced.length })}</span>
      </div>
      {pearls.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {pearls.map((kind) => (
            <Btn key={kind} size="sm" variant={kind === pearl ? "gold" : "cream"} onClick={() => setPearl(kind)}>
              {pearlName(lang, kind)}
            </Btn>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-1">
        {visible.map((sheet, index) => (
          <Btn key={sheet.id} size="sm" variant={sheet.id === active?.id ? "gold" : "cream"} onClick={() => setActiveId(sheet.id)}>
            {t(lang, "nest.sheet", { n: index + 1 })}
          </Btn>
        ))}
        <Btn
          size="sm"
          variant="cream"
          onClick={() => {
            if (room <= 0) {
              setMsg(t(lang, "nest.missing", { name: pearlName(lang, pearl) }));
              sfx.fail();
              return;
            }
            const sheet = makeSheet(pearl);
            remember();
            setSheets([...sheets, sheet]);
            setActiveId(sheet.id);
            sfx.pop();
          }}
        >
          {t(lang, "nest.newSheet")}
        </Btn>
      </div>
      <div className="workbench overflow-auto" style={{ maxHeight: 440 }}>
        {shown ? (
          <svg
            ref={svgRef}
            viewBox={`0 0 ${shown.width} ${shown.height}`}
            style={{ width: `${Math.round(zoom * 100)}%`, height: "auto", touchAction: "none" }}
            onPointerMove={(e) => {
              if (!drag) return;
              const point = pointOf(e);
              if (point) setDrag({ ...drag, x: point.x + drag.dx, y: point.y + drag.dy });
            }}
            onPointerUp={() => {
              if (!drag) return;
              const current = placements.find((item) => item.pieceId === drag.id);
              const next = drag;
              setDrag(null);
              if (!current) return;
              moveTo(next.id, next.x, next.y, current.r);
            }}
          >
            <rect width={shown.width} height={shown.height} rx="6" fill={PEARLS[pearl].stops[0]} stroke="#5c4030" strokeWidth="1.5" />
            {shown.placements.map((item) => {
              const moving = drag?.id === item.pieceId;
              const x = moving ? drag.x : item.x;
              const y = moving ? drag.y : item.y;
              const cut = cutIds.has(item.pieceId);
              return (
                <g
                  key={item.pieceId}
                  transform={`translate(${x} ${y}) rotate(${item.r}) scale(${item.s})`}
                  opacity={cut ? 0.38 : 1}
                  onPointerDown={(e) => {
                    if (cut) return;
                    e.stopPropagation();
                    const point = pointOf(e);
                    setSelected(item.pieceId);
                    setDrag({
                      id: item.pieceId,
                      x: item.x,
                      y: item.y,
                      dx: item.x - (point?.x ?? item.x),
                      dy: item.y - (point?.y ?? item.y),
                    });
                    try {
                      svgRef.current?.setPointerCapture(e.pointerId);
                    } catch {
                      // 포인터를 붙잡지 못해도 시트 안에서는 그대로 따라간다.
                    }
                  }}
                >
                  <MotifSilhouette motif={item.motifId as MotifId} color={selected === item.pieceId ? "#8d5a32" : "#f4efe4"} />
                  <path d={motifOutline(item.motifId as MotifId)} fill="none" stroke="transparent" strokeWidth={6} />
                  <path
                    d={motifOutline(item.motifId as MotifId)}
                    fill="none"
                    stroke={selected === item.pieceId ? "#4a2c1a" : "#6b4e3a"}
                    strokeWidth={0.7}
                    pointerEvents="none"
                  />
                </g>
              );
            })}
          </svg>
        ) : (
          <p className="p-4 text-center text-sm text-[var(--brown)]">{t(lang, "nest.empty")}</p>
        )}
      </div>
      {shown && (
        <div className="text-sm text-[var(--cream)]">
          <div className="mb-1">{t(lang, "nest.free", { n: free })}</div>
          <Meter value={free / 100} color="var(--gold)" />
        </div>
      )}
      {waiting.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {waiting.map((piece) => (
            <button
              key={piece.id}
              type="button"
              className={`tray-piece shrink-0 ${selected === piece.id ? "ring-2 ring-[var(--gold-deep)]" : ""}`}
              onClick={() => setSelected(piece.id)}
            >
              <MotifIcon motif={piece.motif} className="h-10 w-10" />
            </button>
          ))}
        </div>
      )}
      {msg && <p className="panel py-2 text-center text-sm text-[var(--brown)]">{msg}</p>}
      <div className="grid grid-cols-2 gap-2">
        <Btn variant="gold" onClick={runAuto}>
          {t(lang, "nest.auto")}
        </Btn>
        <Btn variant="cream" disabled={!selected || placedIds.has(selected)} onClick={() => selected && placeWaiting(selected)}>
          {t(lang, "nest.drop")}
        </Btn>
        <Btn variant="cream" onClick={() => {
          const prev = history.current.pop();
          if (!prev) return;
          setSheets(prev.sheets);
          setPlacements(prev.placements);
          sfx.click();
        }}>
          {t(lang, "nest.undo")}
        </Btn>
        <Btn
          variant="cream"
          onClick={() => {
            remember();
            const keep = new Set(placements.filter((item) => item.locked).map((item) => item.sheetId));
            setPlacements(placements.filter((item) => item.locked));
            setSheets(sheets.filter((sheet) => ledgerIds.has(sheet.id) || keep.has(sheet.id)));
            sfx.click();
          }}
        >
          {t(lang, "nest.reset")}
        </Btn>
        <Btn
          variant="cream"
          onClick={() => {
            if (!selectedPlacement) return;
            const next = turnPiece(selectedPlacement.r, -1);
            moveTo(selectedPlacement.pieceId, selectedPlacement.x, selectedPlacement.y, next);
          }}
        >
          {t(lang, "nest.turnL")}
        </Btn>
        <Btn
          variant="cream"
          onClick={() => {
            if (!selectedPlacement) return;
            moveTo(selectedPlacement.pieceId, selectedPlacement.x, selectedPlacement.y, turnPiece(selectedPlacement.r, 1));
          }}
        >
          {t(lang, "nest.turnR")}
        </Btn>
        <Btn variant="cream" onClick={() => setZoom((value) => Math.max(0.7, Math.round((value - 0.25) * 100) / 100))}>
          {t(lang, "nest.zoomOut")}
        </Btn>
        <Btn variant="cream" onClick={() => setZoom((value) => Math.min(2.2, Math.round((value + 0.25) * 100) / 100))}>
          {t(lang, "nest.zoomIn")}
        </Btn>
        <Btn
          variant="cream"
          disabled={!selectedPlacement}
          onClick={() => {
            if (!selectedPlacement || cutIds.has(selectedPlacement.pieceId)) {
              if (selectedPlacement) say("nest.cutLocked");
              return;
            }
            remember();
            setPlacements(
              placements.map((item) => (item.pieceId === selectedPlacement.pieceId ? { ...item, locked: !item.locked } : item)),
            );
          }}
        >
          {selectedPlacement?.locked ? t(lang, "nest.unlock") : t(lang, "nest.lock")}
        </Btn>
        <Btn variant="pink" disabled={unplaced.length > 0} onClick={confirm}>
          {confirmLabel ?? t(lang, "nest.confirm")}
        </Btn>
      </div>
    </div>
  );
}

/** 개발용. 저장 재고는 건드리지 않고 구획 화면만 연다. */
export function NestLab() {
  const [note, setNote] = useState<string | null>(null);
  const ledger = useMemo<ShellLedger>(() => ({ sheets: [] }), []);
  const design = useMemo<Design>(
    () => ({
      shape: "round",
      lacquer: "black",
      pearl: "white",
      pieces: (["plum", "cloud", "vine", "bamboo", "pine"] as MotifId[]).map((motif) => newPiece(motif, "white")),
    }),
    [],
  );
  return (
    <div className="screen" data-nest-lab="1">
      <div className="screen-body flex flex-col gap-3">
        {note && <p className="panel py-2 text-sm text-[var(--brown)]">{note}</p>}
        <NestStep
          design={design}
          ledger={ledger}
          stock={{ white: 3 }}
          onChange={() => undefined}
          onConfirm={(plan) => {
            const result = commitNest({
              stock: { white: 3 },
              ledger: { sheets: [] },
              plan,
              polygonsFor: (placement) => motifPolygons(placement.motifId),
            });
            if (!result.ok) return result;
            setNote(`문양 ${design.pieces.length}개를 자개패 ${result.charged.white ?? 0}장에 올렸어요.`);
            return { ok: true };
          }}
        />
      </div>
    </div>
  );
}
