import assert from "node:assert/strict";
import test from "node:test";
import {
  autoNest,
  commitNest,
  makeSheet,
  markCut,
  placementFits,
  poseKeys,
  reconcileProgress,
  rectPoly,
  sheetUse,
  releaseReservation,
  restoreSave,
} from "../src/lib/shellNest.ts";

function piece(id, w, h, pearl = "white", extra = {}) {
  return { id, motifId: id, pearl, s: 1, polygons: rectPoly(w, h), ...extra };
}

function keysOf(item, pose) {
  return new Set(poseKeys(item.polygons, item.s, pose.r, pose.x, pose.y).map((cell) => cell.key));
}

const polys = () => rectPoly(20, 20);

test("the expected sheet count follows the layout", () => {
  const pieces = [piece("a", 28, 28), piece("b", 28, 28), piece("c", 28, 28), piece("d", 28, 28), piece("e", 28, 28)];
  const packed = autoNest(pieces, [], { white: 3 });
  const count = sheetUse({ sheets: packed.opened, placements: packed.placements }, { sheets: [] });
  const used = Object.values(count.used).reduce((sum, n) => sum + n, 0);
  assert.equal(used, 1);
  assert.equal(count.fresh.white, 1);
  assert.notEqual(used, pieces.length);
});

test("five motifs share one sheet instead of five", () => {
  const pieces = ["a", "b", "c", "d", "e"].map((id) => piece(id, 28, 28));
  const result = autoNest(pieces, [], { white: 3 });
  assert.equal(result.unplaced.length, 0);
  assert.equal(result.opened.length, 1);
  assert.equal(new Set(result.placements.map((item) => item.sheetId)).size, 1);
  assert.notEqual(result.opened.length, pieces.length);
});

test("pieces that do not share a sheet open more sheets, still fewer than the motif count", () => {
  const pieces = [piece("a", 120, 44), piece("b", 120, 44), piece("c", 120, 44), piece("d", 120, 44)];
  const result = autoNest(pieces, [], { white: 4 });
  assert.equal(result.unplaced.length, 0, `unplaced ${result.unplaced.length}, sheets ${result.opened.length}`);
  assert.ok(result.opened.length >= 2, `sheets ${result.opened.length}`);
  assert.ok(result.opened.length < pieces.length, `sheets ${result.opened.length}`);
});

test("leftover space on an open sheet is used before a new sheet", () => {
  const used = makeSheet("white", "open-1");
  const parked = { pieceId: "old", motifId: "old", sheetId: used.id, x: 50, y: 46, r: 0, s: 1 };
  used.placements = [parked];
  used.cutPieceIds = ["old"];
  const blocker = piece("old", 80, 70, "white", { locked: true });
  const fresh = piece("new", 36, 36);
  const result = autoNest([fresh, blocker], [used], { white: 0 });
  assert.equal(result.unplaced.length, 0);
  assert.equal(result.opened.length, 0);
  assert.equal(result.placements.find((item) => item.pieceId === "new")?.sheetId, used.id);
  assert.equal(result.sheets.find((item) => item.id === used.id)?.status, "active");
});

test("auto nest runs, then a manual move is accepted and an overlap is not", () => {
  const pieces = [piece("a", 40, 40), piece("b", 40, 40)];
  const result = autoNest(pieces, [], { white: 1 });
  const sheet = result.opened[0];
  const first = result.placements.find((item) => item.pieceId === "a");
  const second = result.placements.find((item) => item.pieceId === "b");
  const moved = { x: 120, y: 80, r: 0 };
  assert.equal(placementFits(sheet, pieces[0], moved, keysOf(pieces[1], second)), "ok");
  assert.equal(placementFits(sheet, pieces[0], { x: second.x, y: second.y, r: second.r }, keysOf(pieces[1], second)), "overlap");
  assert.equal(placementFits(sheet, pieces[0], { x: -40, y: 20, r: 0 }, new Set()), "outside");
});

test("a locked piece stays put while the others are packed", () => {
  const sheet = makeSheet("white", "kept");
  const pinned = { pieceId: "lock", motifId: "lock", sheetId: sheet.id, x: 40, y: 40, r: 0, s: 1, locked: true };
  sheet.placements = [pinned];
  const result = autoNest([piece("lock", 30, 30, "white", { locked: true }), piece("a", 30, 30), piece("b", 30, 30)], [sheet], { white: 1 });
  const stay = result.placements.find((item) => item.pieceId === "lock");
  assert.equal(stay.x, 40);
  assert.equal(stay.y, 40);
  assert.equal(stay.locked, true);
  assert.equal(result.unplaced.length, 0);
  assert.equal(result.placements.length, 3);
});

test("opening a sheet charges one, and the same sheet is not charged again", () => {
  const pieces = [piece("a", 30, 30), piece("b", 30, 30)];
  const packed = autoNest(pieces, [], { white: 2 });
  const plan = { sheets: packed.opened, placements: packed.placements };
  const first = commitNest({ stock: { white: 4 }, ledger: { sheets: [] }, plan, polygonsFor: () => polys() });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.stock.white, 3);
  assert.equal(first.charged.white, 1);
  const again = commitNest({ stock: first.stock, ledger: first.ledger, plan: first.plan, polygonsFor: () => polys() });
  assert.equal(again.ok, true);
  if (!again.ok) return;
  assert.equal(again.stock.white, 3);
  assert.equal(again.charged.white, undefined);
});

test("reconfirming moves this craft, drops its uncut reservation, and leaves a cut or another craft", () => {
  const sheet = makeSheet("white", "s1");
  sheet.placements = [
    { pieceId: "mine", motifId: "m", sheetId: "s1", x: 30, y: 30, r: 0, s: 1 },
    { pieceId: "gone", motifId: "g", sheetId: "s1", x: 70, y: 30, r: 0, s: 1 },
    { pieceId: "cut", motifId: "c", sheetId: "s1", x: 110, y: 30, r: 0, s: 1 },
    { pieceId: "other", motifId: "o", sheetId: "s1", x: 30, y: 80, r: 0, s: 1 },
  ];
  sheet.cutPieceIds = ["cut"];
  const result = commitNest({
    stock: { white: 2 },
    ledger: { sheets: [sheet] },
    plan: { sheets: [], placements: [{ pieceId: "mine", motifId: "m", sheetId: "s1", x: 100, y: 80, r: 0, s: 1 }] },
    ownedPieceIds: ["mine", "gone", "cut"],
    polygonsFor: () => polys(),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.stock.white, 2);
  assert.equal(result.charged.white, undefined);
  const placed = Object.fromEntries(result.ledger.sheets[0].placements.map((item) => [item.pieceId, item.x]));
  assert.deepEqual(placed, { mine: 100, cut: 110, other: 30 });
});

test("a reservation can be cleared before the cut, and not after", () => {
  const sheet = makeSheet("white", "s1");
  sheet.placements = [{ pieceId: "a", motifId: "a", sheetId: sheet.id, x: 40, y: 40, r: 0, s: 1 }];
  const ledger = { sheets: [sheet] };
  const released = releaseReservation(ledger, "a");
  assert.equal(released.sheets[0].placements.length, 0);
  const cut = markCut(ledger, "a");
  const stuck = releaseReservation(cut, "a");
  assert.equal(stuck.sheets[0].placements.length, 1);
  assert.ok(stuck.sheets[0].cutPieceIds.includes("a"));
});

test("an older in-progress craft is not charged twice and keeps its goods", () => {
  const restored = restoreSave(
    {
      money: 80,
      gallery: [{ id: "old-art" }],
      inventory: { pearlWhite: 7, wood: 1 },
      craftProgress: { stepIdx: 4, design: { pieces: [] }, scores: { dry: 70 }, placed: [{ id: "p" }] },
    },
    { pearlWhite: 12, wood: 2, hemp: 2 },
  );
  assert.equal(restored.money, 80);
  assert.equal(restored.gallery.length, 1);
  assert.equal(restored.inventory.pearlWhite, 7);
  assert.equal(restored.inventory.wood, 1);
  assert.equal(restored.inventory.hemp, 2);
  assert.equal(restored.craftProgress.stepIdx, 4);
  assert.equal(restored.craftProgress.legacyPearlPaid, true);
  assert.equal(restored.craftProgress.scores.dry, 70);
  const progressed = reconcileProgress({ stepIdx: 4, stepModel: "nest", legacyPearlPaid: false, shellPlan: { sheets: [], placements: [] } });
  assert.equal(progressed.stepIdx, 4);
  assert.equal(progressed.stepModel, "design-nest");
  assert.equal(progressed.nestPending, true);
  const afterNest = reconcileProgress({ stepIdx: 5, stepModel: "nest", legacyPearlPaid: true, shellPlan: { sheets: [], placements: [], confirmed: true } });
  assert.equal(afterNest.stepIdx, 4);
  assert.equal(afterNest.nestPending, undefined);
  const settled = reconcileProgress({ stepIdx: 4, stepModel: "design-nest", legacyPearlPaid: false });
  assert.equal(settled.stepIdx, 4);
  assert.equal(settled.nestPending, undefined);
  const early = reconcileProgress({ stepIdx: 2 });
  assert.equal(early.stepIdx, 2);
  assert.equal(early.legacyPearlPaid, true);
  const prepaid = commitNest({
    stock: { white: 4 },
    ledger: { sheets: [] },
    plan: { sheets: [makeSheet("white", "legacy")], placements: [] },
    legacyPrepaid: true,
    polygonsFor: () => polys(),
  });
  assert.equal(prepaid.ok, true);
  if (!prepaid.ok) return;
  assert.equal(prepaid.stock.white, 4);
});

test("a saved plan restores the same placements", () => {
  const pieces = [piece("a", 28, 28), piece("b", 28, 28)];
  const packed = autoNest(pieces, [], { white: 1 });
  const plan = { sheets: packed.opened, placements: packed.placements, confirmed: true };
  const copy = JSON.parse(JSON.stringify(plan));
  assert.equal(copy.placements.length, plan.placements.length);
  assert.equal(copy.placements[0].x, plan.placements[0].x);
  assert.equal(copy.placements[1].sheetId, plan.placements[1].sheetId);
  assert.equal(copy.sheets[0].id, plan.sheets[0].id);
});

test("not enough stock leaves pieces unplaced and commit refuses the new sheet", () => {
  const pieces = [piece("a", 100, 70), piece("b", 100, 70)];
  const result = autoNest(pieces, [], { white: 1 });
  assert.equal(result.opened.length, 1);
  assert.equal(result.unplaced.length, 1);
  const refused = commitNest({
    stock: { white: 0 },
    ledger: { sheets: [] },
    plan: { sheets: result.opened, placements: result.placements },
    polygonsFor: () => polys(),
  });
  assert.equal(refused.ok, false);
  if (refused.ok) return;
  assert.equal(refused.missing, "white");
});
