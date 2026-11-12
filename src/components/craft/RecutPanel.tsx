"use client";

import { useMemo, useRef, useState } from "react";
import { Btn } from "@/components/ui";
import type { PieceCutResult, RecutSession } from "@/lib/cutFragments";
import type { PearlId } from "@/lib/data";
import { newPiece, piecePearl, type Design, type PlacedPiece } from "@/lib/game";
import { pearlName, t } from "@/lib/i18n";
import { sfx } from "@/lib/sound";
import {
  autoNest,
  commitNest,
  fitsWithoutNewSheet,
  makeSheet,
  type NestPiece,
  type ShellLedger,
  type ShellPlan,
  type ShellPlacement,
} from "@/lib/shellNest";
import { useSave } from "@/lib/store";
import NestStep, { motifPolygons } from "./NestStep";

function nestOf(piece: PlacedPiece, design: Design): NestPiece {
  return {
    id: piece.id,
    motifId: piece.motif,
    pearl: piecePearl(piece, design),
    s: piece.s,
    polygons: motifPolygons(piece.motif),
  };
}

const polygonsOf = (placement: ShellPlacement) => motifPolygons(placement.motifId);

function suggestLayout(
  mode: "manual" | "auto" | "fresh",
  piece: PlacedPiece,
  design: Design,
  ledger: ShellLedger,
  stock: Partial<Record<PearlId, number>>,
): ShellPlan | undefined {
  if (mode === "manual") return undefined;
  const nest = nestOf(piece, design);
  if (mode === "fresh") {
    if ((stock[nest.pearl] ?? 0) < 1) return undefined;
    const sheet = makeSheet(nest.pearl);
    const packed = autoNest([nest], [sheet], { [nest.pearl]: 0 }, polygonsOf);
    return { sheets: [sheet], placements: packed.placements };
  }
  const open = ledger.sheets.filter((sheet) => sheet.pearl === nest.pearl);
  const packed = autoNest([nest], open, { [nest.pearl]: stock[nest.pearl] ?? 0 }, polygonsOf);
  return { sheets: packed.opened, placements: packed.placements };
}

export default function RecutPanel({
  design,
  piece,
  pending,
  ledger,
  stock,
  mode,
  draft,
  onMode,
  onDraft,
  onJoin,
  onCommit,
  onShop,
  onPause,
}: {
  design: Design;
  piece: PlacedPiece;
  pending: PieceCutResult;
  ledger: ShellLedger;
  stock: Partial<Record<PearlId, number>>;
  mode: RecutSession["mode"];
  draft?: ShellPlan;
  onMode: (mode: RecutSession["mode"]) => void;
  onDraft: (plan: ShellPlan) => void;
  onJoin?: () => void;
  onCommit: (plan: ShellPlan) => { ok: true } | { ok: false; missing: PearlId };
  onShop?: () => void;
  onPause?: () => void;
}) {
  const lang = useSave((s) => s.lang);
  const pearl = piecePearl(piece, design);
  const openStock = stock[pearl] ?? 0;
  const fits = fitsWithoutNewSheet(nestOf(piece, design), ledger.sheets, polygonsOf);
  const blocked = !fits && openStock < 1;
  const reusable = pending.condition === "reusable-broken";
  const seed = useRef<{ key: string; plan?: ShellPlan }>({ key: "", plan: undefined });
  const nestMode = mode === "manual" || mode === "auto" || mode === "fresh" ? mode : null;
  const seedKey = `${piece.id}:${mode}`;
  if (seed.current.key !== seedKey) {
    const saved = draft && (draft.placements.length > 0 || draft.sheets.length > 0) ? draft : undefined;
    seed.current = {
      key: seedKey,
      plan: saved ?? (nestMode ? suggestLayout(nestMode, piece, design, ledger, stock) : undefined),
    };
  }

  if (nestMode) {
    const solo: Design = { ...design, pieces: [piece] };
    return (
      <div className="flex flex-col gap-3" data-recut-panel="nest" data-recut-mode={nestMode}>
        <Btn
          variant="cream"
          onClick={() => {
            sfx.click();
            onMode("choose");
          }}
        >
          {t(lang, "cut.recutBack")}
        </Btn>
        <NestStep
          key={seedKey}
          design={solo}
          ledger={ledger}
          stock={stock}
          initial={seed.current.plan}
          onChange={onDraft}
          onConfirm={onCommit}
          embedded
          confirmLabel={t(lang, "nest.confirm")}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3" data-recut-panel="choose" data-recut-fit={fits ? "yes" : "no"}>
      <div className="panel flex flex-col gap-2 py-3 text-sm text-[var(--brown)]">
        <p className="text-base font-bold">{t(lang, reusable ? "cut.joinOffer" : "cut.scrapTitle")}</p>
        {reusable ? <p>{t(lang, "cut.reuseNote")}</p> : <p>{t(lang, fits ? "cut.scrapLeftover" : "cut.scrapNeedSheet")}</p>}
        <p>{t(lang, fits ? "cut.recutCanFit" : "cut.recutCannotFit")}</p>
        <p>{t(lang, "cut.recutStock", { n: openStock })}</p>
        <p>{t(lang, "cut.recutExtra", { n: pending.extraSheets ?? 0 })}</p>
        <p>{t(lang, "cut.recutBreaks", { breaks: pending.breaks ?? 0, recuts: pending.recuts ?? 0 })}</p>
        {blocked && <p>{t(lang, "cut.scrapNoStock")}</p>}
      </div>
      {reusable && onJoin && (
        <Btn
          variant="pink"
          onClick={() => {
            sfx.click();
            onJoin();
          }}
        >
          {t(lang, "cut.recutJoin")}
        </Btn>
      )}
      <Btn variant="gold" disabled={!fits} onClick={() => (sfx.click(), onMode("manual"))}>
        {t(lang, "cut.recutLeftover")}
      </Btn>
      <Btn variant="gold" disabled={blocked} onClick={() => (sfx.click(), onMode("auto"))}>
        {t(lang, "cut.recutAuto")}
      </Btn>
      <Btn variant="cream" disabled={openStock < 1} onClick={() => (sfx.click(), onMode("fresh"))}>
        {t(lang, "cut.recutFresh")} · {pearlName(lang, pearl)}
      </Btn>
      {blocked && (
        <div className="grid grid-cols-2 gap-2">
          {onShop && (
            <Btn variant="pink" onClick={() => (sfx.click(), onShop())}>
              {t(lang, "cut.recutShop")}
            </Btn>
          )}
          {onPause && (
            <Btn variant="cream" onClick={() => (sfx.click(), onPause())}>
              {t(lang, "cut.recutPause")}
            </Btn>
          )}
        </div>
      )}
    </div>
  );
}

function crowdedSheet(piece: PlacedPiece): ShellLedger {
  const design: Design = { shape: "round", lacquer: "black", pearl: "white", pieces: [piece] };
  const nest = nestOf(piece, design);
  const copies = Array.from({ length: 8 }, (_, index) => ({ ...nest, id: `fill-${index}` }));
  const packed = autoNest(copies, [], { white: 1 }, polygonsOf);
  const sheet = packed.sheets[0];
  if (!sheet) return { sheets: [makeSheet("white", "lab-full")] };
  return {
    sheets: [
      {
        ...sheet,
        id: "lab-full",
        placements: sheet.placements.map((item) => ({ ...item, sheetId: "lab-full" })),
        cutPieceIds: sheet.placements.map((item) => item.pieceId),
      },
    ],
  };
}

/** 개발용. 저장 재고는 건드리지 않고 재절단 선택만 연다. */
export function RecutLab() {
  const piece = useMemo(() => ({ ...newPiece("plum", "white"), id: "recut-plum", s: 1.3 }), []);
  const design = useMemo<Design>(() => ({ shape: "round", lacquer: "black", pearl: "white", pieces: [piece] }), [piece]);
  const [scene, setScene] = useState<"open" | "full" | "empty">("open");
  const [mode, setMode] = useState<RecutSession["mode"]>("choose");
  const [stock, setStock] = useState(2);
  const [ledger, setLedger] = useState<ShellLedger>(() => ({ sheets: [makeSheet("white", "lab-open")] }));
  const [draft, setDraft] = useState<ShellPlan | undefined>(undefined);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState<PieceCutResult>({
    pieceId: piece.id,
    motifId: "plum",
    condition: "scrapped",
    fragments: [],
    crack: [],
    seam: [],
    clips: [],
    cutScore: 40,
    firstCutScore: 40,
    breaks: 3,
    recuts: 0,
    extraSheets: 0,
    shellWaste: 1,
    sideShare: [],
    splitReason: "shard",
  });

  const load = (next: "open" | "full" | "empty") => {
    setScene(next);
    setMode("choose");
    setDraft(undefined);
    setNote(null);
    setPending((current) => ({ ...current, extraSheets: 0 }));
    if (next === "open") {
      setStock(2);
      setLedger({ sheets: [makeSheet("white", "lab-open")] });
      return;
    }
    setStock(next === "empty" ? 0 : 2);
    setLedger(crowdedSheet(piece));
  };

  return (
    <div className="screen" data-recut-lab="1">
      <div className="screen-body flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          <Btn variant={scene === "open" ? "pink" : "cream"} onClick={() => load("open")}>
            남은 자리
          </Btn>
          <Btn variant={scene === "full" ? "pink" : "cream"} onClick={() => load("full")}>
            공간 없음
          </Btn>
          <Btn variant={scene === "empty" ? "pink" : "cream"} onClick={() => load("empty")}>
            재고 없음
          </Btn>
        </div>
        {note && <p className="panel py-2 text-sm text-[var(--brown)]">{note}</p>}
        <RecutPanel
          key={`${scene}-${ledger.sheets[0]?.id ?? "none"}`}
          design={design}
          piece={piece}
          pending={pending}
          ledger={ledger}
          stock={{ white: stock }}
          mode={mode}
          draft={draft}
          onMode={(next) => {
            setDraft(undefined);
            setMode(next);
          }}
          onDraft={setDraft}
          onShop={() => setNote("상점으로 이동할 수 있어요. 이 연습 화면은 재고를 바꾸지 않아요.")}
          onPause={() => setNote("제작을 저장하고 멈출 수 있어요. 이 연습 화면은 저장하지 않아요.")}
          onCommit={(plan) => {
            const result = commitNest({
              stock: { white: stock },
              ledger,
              plan,
              ownedPieceIds: [piece.id],
              polygonsFor: polygonsOf,
            });
            if (!result.ok) return result;
            const charged = result.charged.white ?? 0;
            setStock(result.stock.white ?? 0);
            setLedger(result.ledger);
            setPending((current) => ({ ...current, extraSheets: (current.extraSheets ?? 0) + charged }));
            setNote(`새로 연 자개패 ${charged}장 · 남은 미사용 ${result.stock.white ?? 0}장`);
            setMode("choose");
            return { ok: true };
          }}
        />
      </div>
    </div>
  );
}
