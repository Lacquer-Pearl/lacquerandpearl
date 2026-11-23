import assert from "node:assert/strict";
import test from "node:test";
import { canAcceptCommission, earnedAchievements, GIFT_ID, storyOrder, VISITOR_ID } from "../src/lib/workshopStory.ts";

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

test("only the current tutorial commission opens until the visitor's delivery is read", () => {
  for (const chapter of ["gift", "visitor", "ending"]) {
    assert.equal(canAcceptCommission({ chapter }, "random-order"), false);
    const story = { apprentice: "woman", chapter };
    assert.equal(canAcceptCommission(story, GIFT_ID), chapter === "gift");
    assert.equal(canAcceptCommission(story, VISITOR_ID), chapter === "visitor");
    assert.equal(canAcceptCommission(story, "random-order"), chapter === "ending");
    for (const id of [GIFT_ID, VISITOR_ID, "random-order"]) {
      assert.equal(canAcceptCommission({ ...story, delivery: true }, id), false);
    }
  }
});
