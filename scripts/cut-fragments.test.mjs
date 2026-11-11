import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  analyzeSplit,
  buildWedges,
  crackSide,
  dropToPose,
  evaluateBreak,
  fragmentTarget,
  generateCrackRays,
  intactResult,
  pathToPolygons,
  pointInPolygon,
  polygonsFromPaths,
  readBreak,
  scoreSeamJoin,
  unappliedShellWaste,
} from "../src/lib/cutFragments.ts";

const rect = [
  [
    { x: -20, y: -10 },
    { x: 20, y: -10 },
    { x: 20, y: 10 },
    { x: -20, y: 10 },
  ],
];
const rectBounds = { x: -20, y: -10, w: 40, h: 20 };

function motifPaths(id) {
  const src = readFileSync(new URL("../src/lib/motifCuts.ts", import.meta.url), "utf8");
  const start = src.indexOf(`\n  ${id}: [`);
  const end = src.indexOf("\n  ],", start);
  const block = src.slice(start, end);
  return [...block.matchAll(/ d: "([^"]+)"/g)].map((match) => match[1]).filter((d) => d.startsWith("M") || d.startsWith("m"));
}

function boundsOf(polygons, pad = 0.6) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const polygon of polygons) {
    for (const point of polygon) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
  }
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 };
}

function centerOf(bounds) {
  return { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 };
}

function breakAt(polygons, bounds, origin, extra = {}) {
  return evaluateBreak({
    pieceId: "piece-1",
    motifId: "test",
    polygons,
    bounds,
    origin,
    direction: { x: 0, y: 1 },
    stress: 1.02,
    error: 6,
    thickness: 0.9,
    seed: 4,
    cutScore: 70,
    shellWaste: 1,
    ...extra,
  });
}

test("intact cut keeps one fragment and the original mask", () => {
  const result = intactResult("p1", "turtle", 88);
  assert.equal(result.condition, "intact");
  assert.equal(result.fragments.length, 1);
  assert.equal(result.clips.length, 0);
  assert.equal(result.crack.length, 0);
  assert.equal(result.shellWaste, 0);
  assert.equal(unappliedShellWaste(result), 0);
});

test("a centered crack splits a rectangle into two reusable pieces", () => {
  const result = breakAt(rect, rectBounds, { x: 0, y: 0 });
  assert.equal(result.condition, "reusable-broken");
  assert.equal(result.splitReason, "split");
  assert.equal(result.fragments.length, 2);
  assert.equal(result.clips.length, 2);
  assert.ok(result.sideShare.every((share) => share >= 0.18));
  assert.equal(result.shellWasteApplied, false);
  assert.equal(unappliedShellWaste(result), 1);
});

test("a crack near the edge is too small to reuse", () => {
  const result = breakAt(rect, rectBounds, { x: 16.5, y: 0 }, { direction: { x: 1, y: 0 } });
  assert.equal(result.condition, "scrapped");
  assert.ok(result.splitReason === "sliver" || result.splitReason === "shard");
});

test("high stress shatters instead of forcing two usable pieces", () => {
  const result = breakAt(rect, rectBounds, { x: 0, y: 0 }, { stress: 1.8, error: 42, seed: 9 });
  assert.equal(result.condition, "scrapped");
  assert.notEqual(result.splitReason, "split");
  assert.ok(result.clips.length !== 2 || result.sideShare.some((share) => share < 0.18) || result.clips.length >= 3);
});

test("a crack that misses the body is not forced into two pieces", () => {
  const corner = [
    [
      { x: 12, y: 6 },
      { x: 18, y: 6 },
      { x: 18, y: 9 },
      { x: 12, y: 9 },
    ],
  ];
  const result = breakAt(corner, rectBounds, { x: 0, y: 0 });
  assert.equal(result.condition, "scrapped");
  assert.equal(result.splitReason, "miss");
  assert.equal(result.clips.length, 0);
});

test("the visible crack and the clip boundary are the same split", () => {
  const rays = generateCrackRays({
    origin: { x: 0, y: 0 },
    direction: { x: 0, y: 1 },
    bounds: rectBounds,
    stress: 1.02,
    error: 4,
    thickness: 0.9,
    seed: 2,
  });
  const wedges = buildWedges(rays.rays, rectBounds);
  const report = analyzeSplit(rect, wedges, rays.rays, rectBounds);
  assert.equal(report.ok, true);
  let checked = 0;
  for (let y = -8; y <= 8; y += 2) {
    for (let x = -16; x <= 16; x += 2) {
      const point = { x, y };
      if (Math.abs(x) < 1.4) continue;
      const side = crackSide(rays.crack, point) >= 0 ? 0 : 1;
      const inside = wedges.map((wedge) => pointInPolygon(point, wedge));
      assert.equal(inside.filter(Boolean).length, 1, `${x},${y} should sit in one clip`);
      assert.equal(inside[side], true, `${x},${y} clip ${inside.indexOf(true)} != side ${side}`);
      checked++;
    }
  }
  assert.ok(checked > 20);
});

test("joining error changes the attach score, and a perfect seam stays high", () => {
  const result = breakAt(rect, rectBounds, { x: 0, y: 0 }, { seed: 5 });
  const perfect = scoreSeamJoin(result.seam, result.fragments, result.fragments);
  assert.ok(perfect.score > 98, `perfect ${perfect.score}`);
  const gapped = result.fragments.map((frag, index) => (index === 1 ? { ...frag, dx: frag.dx + 6, dy: frag.dy + 1 } : frag));
  const gapScore = scoreSeamJoin(result.seam, result.fragments, gapped);
  assert.ok(gapScore.score < perfect.score - 15, `gap ${gapScore.score}`);
  const turned = result.fragments.map((frag, index) => (index === 1 ? { ...frag, r: 28 } : frag));
  const turnScore = scoreSeamJoin(result.seam, result.fragments, turned);
  assert.ok(turnScore.score < perfect.score - 10, `turn ${turnScore.score}`);
  const overlapped = result.fragments.map((frag) => ({ ...frag, dx: 0, dy: 0 }));
  const overlapScore = scoreSeamJoin(result.seam, result.fragments, overlapped);
  assert.ok(overlapScore.overlap > 0);
  assert.ok(overlapScore.score < perfect.score);
});

test("fragment drag maps back to motif space and rotation is kept", () => {
  const result = breakAt(rect, rectBounds, { x: 0, y: 0 });
  const piece = { x: 150, y: 148, r: 15, s: 1.3 };
  const frag = result.fragments[0];
  const target = fragmentTarget(piece, frag);
  const back = dropToPose(piece, target, 0, frag);
  assert.ok(Math.abs(back.dx - frag.dx) < 1e-6);
  assert.ok(Math.abs(back.dy - frag.dy) < 1e-6);
  const turned = dropToPose(piece, target, 30, frag);
  assert.equal(turned.r, 30);
  assert.ok(Math.abs(turned.dx - frag.dx) < 1e-6);
});

test("the same crack survives a save round-trip", () => {
  const result = breakAt(rect, rectBounds, { x: 1, y: -2 }, { seed: 11 });
  const restored = JSON.parse(JSON.stringify(result));
  assert.deepEqual(restored.crack, result.crack);
  assert.deepEqual(restored.clips, result.clips);
  assert.deepEqual(restored.fragments, result.fragments);
  assert.equal(restored.condition, result.condition);
  const again = generateCrackRays({
    origin: { x: 1, y: -2 },
    direction: { x: 0, y: 1 },
    bounds: rectBounds,
    stress: 1.02,
    error: 6,
    thickness: 0.9,
    seed: 11,
  });
  assert.deepEqual(again.crack, result.crack);
});

test("older artwork pieces without a break stay intact", () => {
  const legacy = JSON.parse('{"id":"old","motif":"turtle","x":10,"y":20,"s":1,"r":0}');
  assert.equal(readBreak(legacy), "intact");
  assert.equal(readBreak({}), "intact");
  assert.equal(readBreak({ breakState: { condition: "reusable-broken" } }), "reusable-broken");
});

test("turtle and lotus can break into two real pieces", () => {
  for (const id of ["turtle", "lotus"]) {
    const polygons = polygonsFromPaths(motifPaths(id));
    assert.ok(polygons.length >= 1, id);
    const bounds = boundsOf(polygons, 1);
    const result = breakAt(polygons, bounds, centerOf(bounds), { seed: id === "turtle" ? 3 : 6, motifId: id, pieceId: id });
    assert.equal(result.condition, "reusable-broken", `${id} ${result.splitReason} ${result.sideShare.map((n) => n.toFixed(2)).join(",")}`);
    assert.equal(result.fragments.length, 2);
    assert.ok(result.crack.length >= 4);
    const report = analyzeSplit(polygons, result.clips, [result.crack, ...(result.extraCracks ?? [])], bounds);
    assert.equal(report.ok, true, id);
  }
});

test("path polygons cover the turtle shell", () => {
  const [shell] = pathToPolygons(motifPaths("turtle")[0]);
  let minX = Infinity;
  let maxX = -Infinity;
  for (const point of shell) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
  }
  assert.ok(maxX - minX > 40);
  assert.ok(pointInPolygon({ x: 0, y: 0 }, shell));
});
