"use client";

import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import { MotifSilhouette } from "@/components/Artwork";
import MotifIcon, { NacreSwatch } from "@/components/MotifIcon";
import { Btn, Coin, Meter } from "@/components/ui";
import {
  MATERIALS,
  MOTIFS,
  PEARLS,
  motifCutRoutes,
  motifLocalBox,
  motifOutline,
  type MotifId,
  type PearlId,
} from "@/lib/data";
import { polygonsFromPaths } from "@/lib/cutFragments";
import { newPiece, piecePearl, turnPiece, type Design, type PlacedPiece } from "@/lib/game";
import { motifName, pearlName, t } from "@/lib/i18n";
import { sfx } from "@/lib/sound";
import { useSave } from "@/lib/store";
import {
  AUTO_ROTATIONS,
  SHELL_SPECS,
  autoNest,
  commitNest,
  freeRatio,
  largeKey,
  makeSheet,
  maxScaleOnSheet,
  placementFits,
  poseKeys,
  sheetSize,
  type NestPiece,
  type ShellLedger,
  type ShellPlacement,
  type ShellPlan,
  type ShellSheet,
  type ShellSize,
  type ShellStock,
} from "@/lib/shellNest";
import LessonGate, { GiftLessons, type Lesson } from "./LessonGate";
import BenchLayout from "./BenchLayout";
import { StepHeader } from "./common";
import { toolLift } from "./craftTouch";

/** 디자인 화면의 하단 버튼이 구획 편집기를 움직일 때 쓰는 손잡이 */
export interface NestActions {
  auto: () => void;
  confirm: () => void;
}

export interface NestStatus {
  unplaced: number;
  total: number;
}

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

const largeCache = new Map<string, boolean>();
/** 빈 보통 자개패 한 장에 실제로 올려 보고, 안 들어가면 대형 자개패가 필요하다. */
export function needsLargeSheet(piece: Pick<PlacedPiece, "motif" | "s">, pearl: PearlId) {
  const key = `${piece.motif}:${piece.s}:${pearl}`;
  let hit = largeCache.get(key);
  if (hit === undefined) {
    const polygons = motifPolygons(piece.motif);
    hit =
      piece.s > maxScaleOnSheet(polygons, SHELL_SPECS[pearl]) &&
      autoNest([{ id: "probe", motifId: piece.motif, pearl, s: piece.s, polygons }], [], { [pearl]: 1 }).unplaced.length > 0;
    largeCache.set(key, hit);
  }
  return hit;
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

type TrayDrag = { id: string; pointerId: number; sx: number; sy: number; x: number; y: number; moving: boolean; unit: number };

type NestDrag =
  | { kind: "move"; id: string; x: number; y: number; dx: number; dy: number }
  | { kind: "rotate"; id: string; cx: number; cy: number; startAngle: number; startR: number; liveR: number };

function angleAt(cx: number, cy: number, x: number, y: number) {
  return (Math.atan2(y - cy, x - cx) * 180) / Math.PI;
}

function nestLocalToWorld(p: Pick<ShellPlacement, "x" | "y" | "r" | "s">, lx: number, ly: number) {
  const rad = (p.r * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const x = lx * p.s;
  const y = ly * p.s;
  return { x: p.x + x * cos - y * sin, y: p.y + x * sin + y * cos };
}

export default function NestStep({
  design,
  ledger,
  stock,
  legacyPrepaid = false,
  orderPearl,
  initial,
  onChange,
  onConfirm,
  embedded = false,
  toolsHeading, progressHeading, nextAction,
  confirmLabel,
  actionRef,
  onStatus,
  hideConfirm = false,
}: {
  design: Design;
  ledger: ShellLedger;
  stock: ShellStock;
  legacyPrepaid?: boolean;
  /** 의뢰에서 지정한 자개. 선택 목록에서 강조한다. */
  orderPearl?: PearlId;
  initial?: ShellPlan;
  onChange: (plan: ShellPlan) => void;
  onConfirm: (plan: ShellPlan) => { ok: true } | { ok: false; missing: PearlId; large?: boolean };
  /** 디자인 단계 안에 넣을 때 제목은 바깥에서 보여 준다. */
  embedded?: boolean;
  toolsHeading?: React.ReactNode;
  progressHeading?: React.ReactNode;
  nextAction?: React.ReactNode;
  confirmLabel?: string;
  actionRef?: RefObject<NestActions | null>;
  onStatus?: (status: NestStatus) => void;
  /** 확정 버튼을 바깥(하단 버튼 바)에서 보여 줄 때 */
  hideConfirm?: boolean;
}) {
  const lang = useSave((s) => s.lang);
  const money = useSave((s) => s.money);
  const buy = useSave((s) => s.buy);
  const firstGift = useContext(GiftLessons);
  const boot = useMemo(() => loadEditor(design, ledger, initial), [design, initial, ledger]);
  const [sheets, setSheets] = useState<ShellSheet[]>(boot.sheets);
  const [placements, setPlacements] = useState<ShellPlacement[]>(boot.placements);
  const [pearl, setPearl] = useState<PearlId>(piecePearl(design.pieces[0], design));
  const [activeId, setActiveId] = useState<string | null>(boot.sheets.find((sheet) => sheet.pearl === piecePearl(design.pieces[0], design))?.id ?? null);
  const [selected, select] = useState<string | null>(null);
  const pendingOverlap = useRef<{ id: string; previous?: ShellPlacement } | null>(null);
  const setSelected = (id: string | null) => {
    const pending = pendingOverlap.current;
    if (pending && pending.id !== id) {
      pendingOverlap.current = null;
      setPlacements(items => {
        const kept = items.filter(item => item.pieceId !== pending.id);
        return pending.previous ? [...kept, pending.previous] : kept;
      });
    }
    select(id);
  };
  const zoom = 1;
  const [drag, setDrag] = useState<NestDrag | null>(null);
  const [trayDrag, setTrayDrag] = useState<TrayDrag | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const benchRef = useRef<HTMLDivElement>(null);
  const history = useRef<{ sheets: ShellSheet[]; placements: ShellPlacement[] }[]>([]);
  const onChangeRef = useRef(onChange);
  const onStatusRef = useRef(onStatus);
  const selectedRef = useRef<string | null>(null);
  const scrollLock = useRef<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    onChangeRef.current = onChange;
    onStatusRef.current = onStatus;
  });
  useLayoutEffect(() => { selectedRef.current = selected; }, [selected]);

  const clearSelected = () => {
    if (selectedRef.current === null) return;
    scrollLock.current = { x: window.scrollX, y: window.scrollY };
    setSelected(null);
  };

  useLayoutEffect(() => {
    if (selected !== null || !scrollLock.current) return;
    const { x, y } = scrollLock.current;
    scrollLock.current = null;
    window.scrollTo(x, y);
  }, [selected]);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (selectedRef.current === null) return;
      const el = e.target;
      if (!(el instanceof Element)) return;
      if (el.closest("[data-nest-keep-select]")) return;
      clearSelected();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []);

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
  const selectedWaiting = waiting.find((piece) => piece.id === selected);
  const selectedPiece =
    selectedPlacement && !cutIds.has(selectedPlacement.pieceId)
      ? { kind: "placed" as const, placement: selectedPlacement, motif: selectedPlacement.motifId as MotifId }
      : selectedWaiting
        ? { kind: "waiting" as const, piece: selectedWaiting, motif: selectedWaiting.motif }
        : null;
  const draftsOf = (size: ShellSize) =>
    sheets.filter((sheet) => sheet.pearl === pearl && !ledgerIds.has(sheet.id) && sheetSize(sheet) === size).length;
  const reusedOf = (size: ShellSize) =>
    sheets.filter((sheet) => sheet.pearl === pearl && ledgerIds.has(sheet.id) && sheetSize(sheet) === size).length;
  const roomOf = (size: ShellSize) =>
    legacyPrepaid && size === "standard"
      ? 6
      : Math.max(0, (stock[size === "large" ? largeKey(pearl) : pearl] ?? 0) - draftsOf(size));
  const polyOf = (placement: ShellPlacement) => motifPolygons(placement.motifId);
  const allPlaced = design.pieces.length > 0 && unplaced.length === 0;

  useEffect(() => {
    onStatusRef.current?.({ unplaced: unplaced.length, total: design.pieces.length });
  }, [unplaced.length, design.pieces.length]);

  const [notice, setNotice] = useState("");
  const [needsFreshSheet, setNeedsFreshSheet] = useState(false);
  const say = (key?: "nest.outside" | "nest.overlap" | "nest.fit" | "nest.cutLocked" | "nest.needLarge") => {
    setNotice(t(lang, key ?? "nest.fit"));
    sfx.fail();
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

  const tooBig = (id: string) => {
    const source = design.pieces.find((piece) => piece.id === id);
    return !!source && needsLargeSheet(source, piecePearl(source, design));
  };

  const roomStd = roomOf("standard");
  const roomLarge = roomOf("large");
  /** 새 장을 열면 화면상 보유는 바로 줄어든다 (확정 전 예약). */
  const ownedStd = Math.max(0, (stock[pearl] ?? 0) - draftsOf("standard"));
  const ownedLarge = Math.max(0, (stock[largeKey(pearl)] ?? 0) - draftsOf("large"));
  const reusedStd = reusedOf("standard");
  const reusedLarge = reusedOf("large");
  const freshStd = draftsOf("standard");
  const freshLarge = draftsOf("large");
  const usingStd = reusedStd + freshStd;
  const usingLarge = reusedLarge + freshLarge;
  const waitStd = waiting.some((piece) => !tooBig(piece.id));
  const waitLarge = waiting.some((piece) => tooBig(piece.id));
  const hasStdSheet = visible.some((sheet) => sheetSize(sheet) === "standard");
  const hasLargeSheet = visible.some((sheet) => sheetSize(sheet) === "large");
  const needOpenStandard = waitStd && roomStd > 0 && !hasStdSheet;
  const needOpenLarge = waitLarge && roomLarge > 0 && !hasLargeSheet;
  const needBuyStandard = !legacyPrepaid && waitStd && roomStd === 0;
  const needBuyLarge = !legacyPrepaid && waitLarge && roomLarge === 0;
  const selectPearls = [...new Set([...pearls, ...(orderPearl ? [orderPearl] : [])])];

  /** 열린 장이 없거나 들어갈 자리가 없을 때, 새 장(보통 → 대형 순)을 열어 올린다. */
  const openAndPlace = (id: string) => {
    const source = design.pieces.find((piece) => piece.id === id);
    if (!source) return false;
    const kind = piecePearl(source, design);
    const unopened: ShellStock = {
      [kind]: Math.min(1, roomOf("standard")),
      [largeKey(kind)]: Math.min(1, roomOf("large")),
    };
    const packed = autoNest([toNest(source, design)], [], unopened);
    const sheet = packed.opened[0];
    if (!sheet || !packed.placements.length) {
      setNeedsFreshSheet(true);
      say(tooBig(id) ? "nest.needLarge" : "nest.fit");
      return false;
    }
    remember();
    sfx.pop();
    setSheets([...sheets, { ...sheet, placements: [] }]);
    setActiveId(sheet.id);
    setPlacements([...placements.filter((item) => item.pieceId !== id), packed.placements[0]]);
    setSelected(id);
    return true;
  };

  /** 고른 대기 문양을 현재 장에 올린다. 장이 없거나 안 들어가면 새 장을 연다. */
  const placeWaiting = (id: string) => {
    if (!active) {
      openAndPlace(id);
      return;
    }
    const source = design.pieces.find((piece) => piece.id === id);
    if (!source || piecePearl(source, design) !== active.pearl) return;
    const packed = autoNest([toNest(source, design)], [{ ...active, placements: blockers(active, id) }], {});
    if (!packed.placements.length) {
      if (!openAndPlace(id)) say(tooBig(id) && sheetSize(active) === "standard" ? "nest.needLarge" : "nest.fit");
      return;
    }
    remember();
    sfx.pop();
    setPlacements([...placements.filter((item) => item.pieceId !== id), packed.placements[0]]);
    setSelected(id);
  };

  const moveTo = (id: string, x: number, y: number, r: number, turns: number[] = [r]) => {
    if (!active) return false;
    if (cutIds.has(id)) {
      say("nest.cutLocked");
      return false;
    }
    const source = design.pieces.find((piece) => piece.id === id);
    if (!source) return false;
    const current = placements.find((item) => item.pieceId === id);
    const taken = occupied(active, id);
    let reason: ReturnType<typeof placementFits> = "outside";
    let turn = r;
    let overlappingTurn: number | undefined;
    for (const candidate of turns) {
      reason = placementFits(active, toNest(source, design), { x, y, r: candidate }, taken);
      turn = candidate;
      if (reason === "ok") break;
      if (reason === "overlap") overlappingTurn ??= candidate;
    }
    if (reason !== "ok" && overlappingTurn !== undefined) { reason = "overlap"; turn = overlappingTurn; }
    if (reason !== "ok" && reason !== "overlap") {
      if (reason === "outside" && tooBig(id) && sheetSize(active) === "standard") say("nest.needLarge");
      else say("nest.outside");
      return false;
    }
    remember();
    if (reason === "overlap") pendingOverlap.current ??= { id, previous: current };
    else if (pendingOverlap.current?.id === id) pendingOverlap.current = null;
    setNotice(reason === "overlap" ? t(lang, "nest.overlap") : "");
    const next = {
      pieceId: id,
      motifId: source.motif,
      sheetId: active.id,
      x,
      y,
      r: turn,
      s: source.s,
      locked: current?.locked,
    };
    setPlacements([...placements.filter((item) => item.pieceId !== id), next]);
    setSelected(id);
    sfx.pop();
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
    const unopened: ShellStock = {};
    for (const kind of pearls) {
      const drafts = (size: ShellSize) => sheets.filter((sheet) => sheet.pearl === kind && !ledgerIds.has(sheet.id) && sheetSize(sheet) === size).length;
      unopened[kind] = legacyPrepaid ? 6 : Math.max(0, (stock[kind] ?? 0) - drafts("standard"));
      unopened[largeKey(kind)] = Math.max(0, (stock[largeKey(kind)] ?? 0) - drafts("large"));
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
    if (result.unplaced.length) {
      if (result.unplaced.some(tooBig)) say("nest.needLarge");
      else say("nest.fit");
    }
  };

  const confirm = () => {
    if (unplaced.length > 0) {
      say("nest.fit");
      return;
    }
    const used = new Set(placements.map((item) => item.sheetId));
    for (const item of placements) {
      const sheet = sheets.find((entry) => entry.id === item.sheetId);
      const piece = design.pieces.find((entry) => entry.id === item.pieceId);
      if (!sheet || !piece) { say("nest.fit"); return; }
      const reason = placementFits(sheet, toNest(piece, design), item, occupied(sheet, item.pieceId));
      if (reason !== "ok") { setActiveId(sheet.id); setSelected(item.pieceId); say(reason === "overlap" ? "nest.overlap" : "nest.outside"); return; }
    }
    const plan: ShellPlan = {
      sheets: sheets.filter((sheet) => used.has(sheet.id) && !ledgerIds.has(sheet.id)),
      placements,
    };
    const result = onConfirm(plan);
    if (!result.ok) {
      sfx.fail();
      say();
      return;
    }
    sfx.success();
  };

  const actionsRef = useRef<NestActions>({ auto: runAuto, confirm });
  useLayoutEffect(() => {
    actionsRef.current = { auto: runAuto, confirm };
  });
  useEffect(() => {
    if (!actionRef) return;
    actionRef.current = {
      auto: () => actionsRef.current.auto(),
      confirm: () => actionsRef.current.confirm(),
    };
    return () => {
      actionRef.current = null;
    };
  }, [actionRef]);

  const openSheet = (size: ShellSize) => {
    if (roomOf(size) <= 0) {
      say();
      sfx.fail();
      return;
    }
    setNeedsFreshSheet(false);
    const sheet = makeSheet(pearl, undefined, size);
    remember();
    setSheets([...sheets, sheet]);
    setActiveId(sheet.id);
    sfx.pop();
  };

  const dropTray = (drop: TrayDrag) => {
    const lift = toolLift("touch");
    const at = { clientX: drop.x, clientY: drop.y - lift };
    const bench = benchRef.current?.getBoundingClientRect();
    const svg = svgRef.current?.getBoundingClientRect();
    if (svg && active && at.clientX >= svg.left && at.clientX <= svg.right && at.clientY >= svg.top && at.clientY <= svg.bottom) {
      const point = pointOf(at);
      if (point) moveTo(drop.id, point.x, point.y, 0, AUTO_ROTATIONS);
      return;
    }
    if (!active && bench && at.clientX >= bench.left && at.clientX <= bench.right && at.clientY >= bench.top && at.clientY <= bench.bottom) {
      openAndPlace(drop.id);
    }
  };

  const shown = active
    ? {
        ...active,
        // 시트에 남은 잠금/절단 조각 + 편집 중 조각. 같은 pieceId는 편집본만 그린다(잔상 방지).
        placements: (() => {
          const byId = new Map<string, (typeof mineOnSheet)[number]>();
          for (const item of active.placements) byId.set(item.pieceId, item);
          for (const item of mineOnSheet) byId.set(item.pieceId, item);
          return [...byId.values()];
        })(),
      }
    : null;
  const free = shown ? Math.round(freeRatio(shown, polyOf) * 100) : 0;
  const ghostPiece = trayDrag?.moving ? design.pieces.find((piece) => piece.id === trayDrag.id) : undefined;
  const unitPx = trayDrag?.unit ?? 1.6;
  const ghostBox = ghostPiece ? motifLocalBox(ghostPiece.motif) : null;

  const sheetSizeNeeded = waiting[0] && tooBig(waiting[0].id) ? "large" : "standard";
  const openSize = sheetSizeNeeded === "standard" && roomStd === 0 && roomLarge > 0 ? "large" : sheetSizeNeeded;
  let sheetLesson: Lesson | undefined;
  if (allPlaced) sheetLesson = "confirmSheet";
  else if (waiting.length) {
    if (!active || needsFreshSheet) sheetLesson = roomOf(openSize) > 0 ? "openSheet" : "buySheet";
    else sheetLesson = selectedWaiting && !trayDrag ? "putOnSheet" : "trayMotif";
  }

  return (
    <LessonGate lesson={sheetLesson} untilComplete><div data-nest-step="1">
      <BenchLayout
        tools={<>
          {toolsHeading}
          {!embedded && (
            <StepHeader title={t(lang, "nest.title")} icon="cutter">
              {t(lang, "nest.tip")}
            </StepHeader>
          )}
          {legacyPrepaid && <p className="panel py-2 text-sm text-[var(--brown)]">{t(lang, "nest.legacy")}</p>}
          <div className="panel nest-stock py-2">
            <div className="nest-stock-pick">
              {selectPearls.map((kind) => {
                const ordered = orderPearl === kind;
                return (
                  <button
                    key={kind}
                    type="button"
                    className={`nest-stock-pearl ${kind === pearl ? "on" : ""} ${ordered ? "ordered" : ""}`}
                    onClick={() => {
                      sfx.click();
                      setPearl(kind);
                    }}
                  >
                    <NacreSwatch pearl={kind} className="swatch lg shrink-0" />
                    <span className="nest-stock-pearl-text">
                      {pearlName(lang, kind)}
                      {ordered && <small>{t(lang, "nest.orderPearl")}</small>}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="nest-stock-row">
              {(
                [
                  {
                    key: "standard" as const,
                    label: "nest.stockStd",
                    owned: ownedStd,
                    using: usingStd,
                    reused: reusedStd,
                    fresh: freshStd,
                    need: needBuyStandard,
                    material: PEARLS[pearl].material,
                  },
                  {
                    key: "large" as const,
                    label: "nest.stockLarge",
                    owned: ownedLarge,
                    using: usingLarge,
                    reused: reusedLarge,
                    fresh: freshLarge,
                    need: needBuyLarge,
                    material: PEARLS[pearl].largeMaterial,
                  },
                ] as const
              ).map((cell) => (
                <div key={cell.key} className={`nest-stock-cell ${cell.need ? "lack" : ""}`}>
                  <div className="nest-stock-cell-main">
                    <span className="nest-stock-label">{t(lang, cell.label)}</span>
                    <span className="nest-stock-num">{t(lang, "nest.stockCount", { n: cell.owned })}</span>
                    <span className="nest-stock-using">
                      {t(lang, "nest.inUseDetail", { n: cell.using })}
                      <br />
                      {t(lang, "nest.inUseSplit", { reused: cell.reused, fresh: cell.fresh })}
                    </span>
                  </div>
                  {!legacyPrepaid && (
                    <button
                      type="button"
                      data-lesson={cell.key === openSize ? "buySheet" : undefined}
                      className={`nest-buy ${cell.need ? "on cta-glow" : ""}`}
                      disabled={money < MATERIALS[cell.material].price}
                      onClick={() => {
                        if (buy(cell.material)) sfx.coin();
                        else sfx.fail();
                      }}
                    >
                      +{MATERIALS[cell.material].pack} · <Coin /> {MATERIALS[cell.material].price}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="nest-sheets flex flex-wrap gap-1">
            {visible.map((sheet, index) => (
              <Btn key={sheet.id} size="sm" variant={sheet.id === active?.id ? "gold" : "cream"} onClick={() => setActiveId(sheet.id)}>
                {t(lang, sheetSize(sheet) === "large" ? "nest.sheetLarge" : "nest.sheet", { n: index + 1 })}
              </Btn>
            ))}
            <Btn
              size="sm"
              variant={needOpenStandard ? "gold" : "cream"}
              className={needOpenStandard ? "cta-glow" : ""}
              disabled={roomStd <= 0}
              data-lesson={openSize === "standard" ? "openSheet" : undefined}
              onClick={() => openSheet("standard")}
            >
              {t(lang, "nest.newSheet")}
            </Btn>
            <Btn
              size="sm"
              variant={needOpenLarge ? "gold" : "cream"}
              className={needOpenLarge ? "cta-glow" : ""}
              disabled={roomLarge <= 0}
              data-lesson={openSize === "large" ? "openSheet" : undefined}
              onClick={() => openSheet("large")}
            >
              {t(lang, "nest.newLarge")}
            </Btn>
          </div>
        </>}
        progress={<>
          {progressHeading}
          {notice && <p role="status" className="nest-notice demo-hint">{notice}</p>}
          <div className="text-sm text-[var(--cream)]">
            <div className="mb-1">{shown ? t(lang, "nest.free", { n: free }) : "\u00a0"}</div>
            <Meter value={free / 100} color="var(--gold)" />
          </div>
          <div className="nest-tray">
            {waiting.length > 0 ? (
              <>
                <span className="nest-tray-label">{t(lang, "nest.dragHint")}</span>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {waiting.map((piece) => (
                    <button
                      key={piece.id}
                      type="button"
                      data-nest-keep-select=""
                      aria-label={motifName(lang, piece.motif)}
                      data-lesson={piece.id === waiting[0]?.id ? "trayMotif" : undefined}
                      onClick={e => { if (firstGift || e.detail === 0) setSelected(piece.id); }}
                      className={`tray-piece nest-tray-piece shrink-0 ${selected === piece.id ? "ring-2 ring-[var(--gold-deep)]" : ""}`}
                      onPointerDown={(e) => {
                        if (firstGift || trayDrag) return;
                        try {
                          e.currentTarget.setPointerCapture(e.pointerId);
                        } catch {
                          // 붙잡지 못하면 탭 선택만 된다.
                        }
                        setSelected(piece.id);
                        const box = svgRef.current?.getBoundingClientRect();
                        setTrayDrag({
                          id: piece.id,
                          pointerId: e.pointerId,
                          sx: e.clientX,
                          sy: e.clientY,
                          x: e.clientX,
                          y: e.clientY,
                          moving: false,
                          unit: box && active ? box.width / active.width : 1.6,
                        });
                      }}
                      onPointerMove={(e) => {
                        if (!trayDrag || e.pointerId !== trayDrag.pointerId) return;
                        const moving = trayDrag.moving || Math.hypot(e.clientX - trayDrag.sx, e.clientY - trayDrag.sy) > 8;
                        setTrayDrag({ ...trayDrag, x: e.clientX, y: e.clientY, moving });
                      }}
                      onPointerUp={(e) => {
                        if (!trayDrag || e.pointerId !== trayDrag.pointerId) return;
                        const done = { ...trayDrag, x: e.clientX, y: e.clientY };
                        setTrayDrag(null);
                        if (done.moving) dropTray(done);
                      }}
                      onPointerCancel={() => setTrayDrag(null)}
                    >
                      <MotifIcon motif={piece.motif} className="h-10 w-10" />
                      {tooBig(piece.id) && <span className="nest-tray-badge">{t(lang, "nest.largeBadge")}</span>}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <span className="nest-tray-label">{design.pieces.length ? t(lang, "nest.trayEmpty") : "\u00a0"}</span>
            )}
          </div>
          <div className="nest-piece-bar-slot">
            {selectedPiece && (
              <div
                className="nest-piece-bar"
                data-nest-keep-select=""
                role="toolbar"
                aria-label={motifName(lang, selectedPiece.motif)}
              >
                <div className="nest-piece-bar-head">
                  <MotifIcon motif={selectedPiece.motif} className="h-6 w-6" />
                  {motifName(lang, selectedPiece.motif)}
                </div>
                <div className="nest-piece-bar-actions">
                  <Btn
                    size="sm"
                    variant="cream"
                    disabled={selectedPiece.kind !== "placed"}
                    onClick={() => {
                      if (selectedPiece.kind !== "placed") return;
                      const { placement } = selectedPiece;
                      moveTo(placement.pieceId, placement.x, placement.y, 0);
                    }}
                  >
                    {t(lang, "nest.resetRotation")}
                  </Btn>
                  <Btn
                    size="sm"
                    variant="cream"
                    onClick={() => {
                      const prev = history.current.pop();
                      if (!prev) return;
                      setSheets(prev.sheets);
                      setPlacements(prev.placements);
                      sfx.click();
                    }}
                  >
                    {t(lang, "nest.undo")}
                  </Btn>
                  <Btn
                    size="sm"
                    variant="cream"
                    className="nest-piece-bar-turn"
                    aria-label={t(lang, "nest.turnL")}
                    title="-15°"
                    disabled={selectedPiece.kind !== "placed"}
                    onClick={() => {
                      if (selectedPiece.kind !== "placed") return;
                      const { placement } = selectedPiece;
                      moveTo(placement.pieceId, placement.x, placement.y, turnPiece(placement.r, -1));
                    }}
                  >
                    <span className="nest-piece-bar-turn-glyph" aria-hidden>
                      ↺
                    </span>
                  </Btn>
                  <Btn
                    size="sm"
                    variant="cream"
                    className="nest-piece-bar-turn"
                    aria-label={t(lang, "nest.turnR")}
                    title="+15°"
                    disabled={selectedPiece.kind !== "placed"}
                    onClick={() => {
                      if (selectedPiece.kind !== "placed") return;
                      const { placement } = selectedPiece;
                      moveTo(placement.pieceId, placement.x, placement.y, turnPiece(placement.r, 1));
                    }}
                  >
                    <span className="nest-piece-bar-turn-glyph" aria-hidden>
                      ↻
                    </span>
                  </Btn>
                  <Btn
                    size="sm"
                    variant="cream"
                    data-lesson="putOnSheet"
                    disabled={selectedPiece.kind !== "waiting"}
                    onClick={() => {
                      if (selectedPiece.kind !== "waiting") return;
                      placeWaiting(selectedPiece.piece.id);
                    }}
                  >
                    {t(lang, "nest.put")}
                  </Btn>
                  <Btn
                    size="sm"
                    variant="cream"
                    disabled={selectedPiece.kind !== "placed"}
                    onClick={() => {
                      if (selectedPiece.kind !== "placed") return;
                      const { placement } = selectedPiece;
                      if (cutIds.has(placement.pieceId)) {
                        say("nest.cutLocked");
                        return;
                      }
                      remember();
                      setPlacements(placements.filter((item) => item.pieceId !== placement.pieceId));
                      setSelected(placement.pieceId);
                      sfx.click();
                    }}
                  >
                    {t(lang, "nest.lift")}
                  </Btn>
                </div>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Btn variant="gold" onClick={runAuto}>
              {t(lang, "nest.auto")}
            </Btn>
            <Btn
              variant="cream"
              onClick={() => {
                remember();
                const keep = new Set(placements.filter((item) => item.locked).map((item) => item.sheetId));
                setPlacements(placements.filter((item) => item.locked));
                setSheets(sheets.filter((sheet) => ledgerIds.has(sheet.id) || keep.has(sheet.id)));
                clearSelected();
                sfx.click();
              }}
            >
              {t(lang, "nest.reset")}
            </Btn>
            {!hideConfirm && (
              <Btn
                variant="pink"
                data-lesson="confirmSheet"
                className={`col-span-2 ${allPlaced ? "cta-glow" : ""}`}
                disabled={unplaced.length > 0}
                onClick={confirm}
              >
                {confirmLabel ?? t(lang, "nest.confirm")}
              </Btn>
            )}
          </div>
        </>}
        next={<>
          {nextAction}
        </>}
      >
        <div ref={benchRef} className="workbench overflow-auto" style={{ maxHeight: 440 }}>
          {shown ? (
            <svg
              ref={svgRef}
              viewBox={`0 0 ${shown.width} ${shown.height}`}
              style={{ width: `${Math.round(zoom * 100)}%`, height: "auto", touchAction: "none" }}
              onPointerMove={(e) => {
                if (!drag) return;
                const point = pointOf(e);
                if (!point) return;
                if (drag.kind === "move") {
                  setDrag({ ...drag, x: point.x + drag.dx, y: point.y + drag.dy });
                  return;
                }
                const ang = angleAt(drag.cx, drag.cy, point.x, point.y);
                let liveR = drag.startR + (ang - drag.startAngle);
                liveR = ((liveR % 360) + 360) % 360;
                setDrag({ ...drag, liveR: +liveR.toFixed(1) });
              }}
              onPointerUp={() => {
                if (!drag) return;
                const current = placements.find((item) => item.pieceId === drag.id);
                const next = drag;
                setDrag(null);
                if (!current) return;
                if (next.kind === "move") moveTo(next.id, next.x, next.y, current.r);
                else moveTo(next.id, current.x, current.y, next.liveR);
              }}
              onPointerCancel={() => setDrag(null)}
            >
              <rect width={shown.width} height={shown.height} rx="6" fill={PEARLS[pearl].stops[0]} stroke="#5c4030" strokeWidth="1.5" />
              {shown.placements.map((item) => {
                const moving = drag?.kind === "move" && drag.id === item.pieceId;
                const rotating = drag?.kind === "rotate" && drag.id === item.pieceId;
                const x = moving ? drag.x : item.x;
                const y = moving ? drag.y : item.y;
                const r = rotating ? drag.liveR : item.r;
                const cut = cutIds.has(item.pieceId);
                const motif = item.motifId as MotifId;
                const stamp = MOTIFS[motif].stamp;
                return (
                  <g
                    key={item.pieceId}
                    data-nest-keep-select=""
                    transform={`translate(${x} ${y}) rotate(${r}) scale(${item.s})`}
                    opacity={cut ? 0.38 : 1}
                  >
                    <g pointerEvents="none">
                      <MotifSilhouette motif={motif} color={selected === item.pieceId ? "#8d5a32" : "#f4efe4"} />
                      <path
                        d={motifOutline(motif)}
                        fill="none"
                        stroke={selected === item.pieceId ? "#4a2c1a" : "#6b4e3a"}
                        strokeWidth={0.7}
                      />
                    </g>
                    {/* 마스크 rect·두꺼운 stroke가 아니라 실제 윤곽만 집는다 (디자인 화면과 동일) */}
                    <path
                      d={motifOutline(motif)}
                      fill="transparent"
                      stroke="transparent"
                      strokeWidth={stamp ? 2.4 / item.s : 0}
                      style={{ pointerEvents: cut ? "none" : "auto", cursor: cut ? "default" : "grab" }}
                      onPointerDown={(e) => {
                        if (cut) return;
                        e.stopPropagation();
                        const point = pointOf(e);
                        setSelected(item.pieceId);
                        setDrag({
                          kind: "move",
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
                    />
                  </g>
                );
              })}
              {selectedPlacement &&
                selectedPlacement.sheetId === shown.id &&
                !cutIds.has(selectedPlacement.pieceId) &&
                (() => {
                  const live =
                    drag?.kind === "move" && drag.id === selectedPlacement.pieceId
                      ? { ...selectedPlacement, x: drag.x, y: drag.y }
                      : drag?.kind === "rotate" && drag.id === selectedPlacement.pieceId
                        ? { ...selectedPlacement, r: drag.liveR }
                        : selectedPlacement;
                  return (
                    <NestRotateChrome
                      placement={live}
                      keepSelect
                      onRotateStart={(e) => {
                        e.stopPropagation();
                        const point = pointOf(e);
                        if (!point) return;
                        setSelected(selectedPlacement.pieceId);
                        setDrag({
                          kind: "rotate",
                          id: selectedPlacement.pieceId,
                          cx: live.x,
                          cy: live.y,
                          startAngle: angleAt(live.x, live.y, point.x, point.y),
                          startR: live.r,
                          liveR: live.r,
                        });
                        sfx.tick();
                        try {
                          svgRef.current?.setPointerCapture(e.pointerId);
                        } catch {
                          // 붙잡지 못해도 시트 안 이동으로 각도를 따른다.
                        }
                      }}
                    />
                  );
                })()}
            </svg>
          ) : (
            <p className="flex aspect-[3/2] items-center justify-center p-4 text-center text-sm text-[var(--cream)]">{t(lang, "nest.empty")}</p>
          )}
        </div>
        {ghostPiece && ghostBox && trayDrag && (
          <svg
            className="nest-drag-ghost"
            viewBox={`${ghostBox.x} ${ghostBox.y} ${ghostBox.w} ${ghostBox.h}`}
            style={{
              left: trayDrag.x + ghostBox.x * ghostPiece.s * unitPx,
              top: trayDrag.y - toolLift("touch") + ghostBox.y * ghostPiece.s * unitPx,
              width: ghostBox.w * ghostPiece.s * unitPx,
              height: ghostBox.h * ghostPiece.s * unitPx,
            }}
          >
            <MotifSilhouette motif={ghostPiece.motif} color="#f4efe4" />
            <path d={motifOutline(ghostPiece.motif)} fill="none" stroke="#4a2c1a" strokeWidth={0.9 / Math.max(0.5, ghostPiece.s)} />
          </svg>
        )}
      </BenchLayout>
    </div></LessonGate>
  );
}

/** 디자인과 같이 패 위에서 바로 돌리는 손잡이. 크기 조절은 구획에 없다. */
function NestRotateChrome({
  placement,
  onRotateStart,
  keepSelect = false,
}: {
  placement: ShellPlacement;
  onRotateStart: (e: React.PointerEvent) => void;
  keepSelect?: boolean;
}) {
  const box = motifLocalBox(placement.motifId as MotifId);
  const corners = [
    [box.x, box.y],
    [box.x + box.w, box.y],
    [box.x + box.w, box.y + box.h],
    [box.x, box.y + box.h],
  ].map(([lx, ly]) => nestLocalToWorld(placement, lx, ly));
  const topMid = nestLocalToWorld(placement, box.x + box.w / 2, box.y);
  const rot = nestLocalToWorld(placement, box.x + box.w / 2, box.y - 20 / Math.max(placement.s, 0.6));

  return (
    <g
      className="nest-rotate-chrome"
      style={{ pointerEvents: "auto" }}
      {...(keepSelect ? { "data-nest-keep-select": "" } : {})}
    >
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
        transform={`translate(${rot.x} ${rot.y}) rotate(${placement.r})`}
        fill="none"
        stroke="#8a6a3a"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none"
      />
    </g>
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
