import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveSpendsFromPools, martialResourceAvailable, martialResetKeys } from "./class-progression.js";
import type { MartialResourcePool } from "./class-progression.js";
import { dnd5eSheetSchema } from "./dnd5e.js";

function sheetWith(martialUsed: Record<string, number>) {
  return dnd5eSheetSchema.parse({ abilities: {}, martialUsed });
}

describe("resolveSpendsFromPools (#179)", () => {
  const ki: MartialResourcePool = { key: "ki", label: "Ki Points", max: 3, resetOn: "short" };
  const handOfMercy: MartialResourcePool = { key: "subclass:hom-id", label: "Hand of Healing/Harm", max: 1, resetOn: "long", spendsFrom: "Ki Points" };

  it("leaves a pool with no spendsFrom untouched", () => {
    const [resolved] = resolveSpendsFromPools([ki]);
    assert.deepEqual(resolved, ki);
  });

  it("swaps key/max/resetOn to the matched target's, so Use/Reset share one counter", () => {
    const [, resolved] = resolveSpendsFromPools([ki, handOfMercy]);
    assert.equal(resolved.key, "ki");
    assert.equal(resolved.max, 3);
    assert.equal(resolved.resetOn, "short");
    // The resource keeps its own label -- only the underlying counter is shared.
    assert.equal(resolved.label, "Hand of Healing/Harm");
  });

  it("matches case-insensitively and tolerates surrounding whitespace", () => {
    const messy: MartialResourcePool = { key: "subclass:x", label: "X", max: 1, resetOn: "long", spendsFrom: "  ki points  " };
    const [, resolved] = resolveSpendsFromPools([ki, messy]);
    assert.equal(resolved.key, "ki");
  });

  it("leaves the pool independent when the target name doesn't match anything (typo-tolerant)", () => {
    const dangling: MartialResourcePool = { key: "subclass:y", label: "Y", max: 1, resetOn: "long", spendsFrom: "Ki Pointz" };
    const [, resolved] = resolveSpendsFromPools([ki, dangling]);
    assert.equal(resolved.key, "subclass:y");
    assert.equal(resolved.max, 1);
  });

  it("does not resolve a pool against itself when its own label matches spendsFrom", () => {
    const selfReferential: MartialResourcePool = { key: "subclass:z", label: "Ki Points", max: 1, resetOn: "long", spendsFrom: "Ki Points" };
    const [resolved] = resolveSpendsFromPools([selfReferential]);
    assert.equal(resolved.key, "subclass:z");
  });

  it("shares the actual spent count once resolved", () => {
    const [resolvedKi, resolvedHom] = resolveSpendsFromPools([ki, handOfMercy]);
    const sheet = sheetWith({ ki: 2 });
    assert.equal(martialResourceAvailable(sheet, resolvedKi), 1);
    assert.equal(martialResourceAvailable(sheet, resolvedHom), 1, "same key, so the same spend shows on both rows");
  });

  it("dedupes to one reset key even though two pools now share it", () => {
    const [resolvedKi, resolvedHom] = resolveSpendsFromPools([ki, handOfMercy]);
    const keys = martialResetKeys([resolvedKi, resolvedHom], "short");
    assert.deepEqual(keys, ["ki", "ki"]);
    assert.deepEqual([...new Set(keys)], ["ki"]);
  });

  it("carries options through untouched for a pool with named choices sharing one counter", () => {
    const channelDivinity: MartialResourcePool = { key: "subclass:cd", label: "Channel Divinity", max: 1, resetOn: "short", options: ["Turn Undead", "Radiance of the Dawn"] };
    const [resolved] = resolveSpendsFromPools([channelDivinity]);
    assert.deepEqual(resolved.options, ["Turn Undead", "Radiance of the Dawn"]);
  });
});
