import assert from "node:assert/strict";
import test from "node:test";
import { earnedAchievements, GIFT_ID, storyOrder, VISITOR_ID } from "../src/lib/workshopStory.ts";

test("the gift and visitor keep their identity, requested materials and reward", () => {
  const gift = storyOrder("man", "gift");
  const visitor = storyOrder("woman", "visitor");
  assert.equal(gift.id, GIFT_ID);
  assert.equal(visitor.id, VISITOR_ID);
  assert.equal(gift.patron.presentation, "feminine");
  assert.equal(visitor.patron.presentation, "masculine");
  assert.equal(gift.reward, 0);
  assert.ok(visitor.reward > 0);
  assert.equal(visitor.motifs.cloudLine, 1);
  assert.equal(visitor.pearl, "abalone");
});

test("the first finish opens a motif and each seal pays once", () => {
  const art = { scores: { sand: 84 }, commissionId: GIFT_ID };
  assert.deepEqual(earnedAchievements(art, []), ["first"]);
  assert.deepEqual(earnedAchievements(art, ["first"]), []);
  const royal = { scores: { sand: 85 }, commissionId: VISITOR_ID };
  assert.deepEqual(earnedAchievements(royal, ["first"]), ["polish", "patron"]);
  assert.deepEqual(earnedAchievements(royal, ["first", "polish", "patron"]), []);
});
