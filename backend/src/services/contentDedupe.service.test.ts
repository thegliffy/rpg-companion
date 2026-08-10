import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CustomContent } from "shared";
import { computeDuplicatePairs } from "./contentDedupe.service.js";

let nextId = 1;

function item(overrides: Partial<CustomContent> & { name: string; data: unknown }): CustomContent {
  return {
    id: nextId++,
    type: "spell",
    system: "dnd5e",
    createdByUserId: 1,
    createdByUsername: "tester",
    status: "approved",
    approvedByUserId: null,
    approvedAt: null,
    createdAt: "2026-01-01",
    ...overrides,
  };
}

describe("computeDuplicatePairs (#182 content dedup)", () => {
  it("flags identical names once normalized (case, surrounding whitespace)", () => {
    const a = item({ name: "Fireball", data: { level: 3 } });
    const b = item({ name: " fireball ", data: { level: 5 } }); // different mechanics, name alone is enough
    const [pair] = computeDuplicatePairs([a, b]);
    assert.ok(pair);
    assert.match(pair.reason, /Identical name/);
    assert.equal(pair.nameSimilarity, 1);
  });

  it("flags a near-miss name pair that crosses the similarity threshold", () => {
    const a = item({ name: "Mage Armor", data: { level: 1 } });
    const b = item({ name: "Mage Armour", data: { level: 4 } }); // one-letter edit, unrelated mechanics
    const [pair] = computeDuplicatePairs([a, b]);
    assert.ok(pair);
    assert.match(pair.reason, /Similar name/);
    assert.ok(pair.nameSimilarity >= 0.82 && pair.nameSimilarity < 1);
  });

  it("does not flag a clearly-different name pair with different mechanics", () => {
    const a = item({ name: "Fireball", data: { level: 3, damageDice: "8d6" } });
    const b = item({ name: "Charm Person", data: { level: 1, damageDice: undefined } });
    assert.deepEqual(computeDuplicatePairs([a, b]), []);
  });

  it("flags identical mechanical data even with different names/descriptions/ids", () => {
    const a = item({ name: "Fire Bolt", data: { level: 0, damageDice: "1d10", description: "Hurl a mote of fire." } });
    const b = item({ name: "Flame Dart", data: { level: 0, damageDice: "1d10", description: "A dart of searing flame." } });
    const [pair] = computeDuplicatePairs([a, b]);
    assert.ok(pair);
    assert.equal(pair.mechanicallyIdentical, true);
    assert.match(pair.reason, /Identical mechanical data/);
  });

  it("is order-independent for arrays -- a reordered trait list still fingerprints the same", () => {
    const traits = [
      { id: "t1", name: "Darkvision", darkvisionFeet: 60 },
      { id: "t2", name: "Fey Ancestry", darkvisionFeet: 0 },
    ];
    const a = item({ type: "race", name: "Elf-alike A", data: { speed: 30, traits } });
    const b = item({ type: "race", name: "Elf-alike B", data: { speed: 30, traits: [...traits].reverse() } });
    const [pair] = computeDuplicatePairs([a, b]);
    assert.ok(pair);
    assert.equal(pair.mechanicallyIdentical, true);
  });

  it("never flags a same-name pair across different content types", () => {
    const a = item({ type: "spell", name: "Fireball", data: { level: 3 } });
    const b = item({ type: "item", name: "Fireball", data: { level: 3 } });
    assert.deepEqual(computeDuplicatePairs([a, b]), []);
  });

  it("never flags a same-name pair across different systems", () => {
    const a = item({ system: "dnd5e", name: "Fireball", data: { level: 3 } });
    const b = item({ system: "pf2e", name: "Fireball", data: { level: 3 } });
    assert.deepEqual(computeDuplicatePairs([a, b]), []);
  });

  it("ignores near-empty drafts sharing a trivial fingerprint (mechanics alone, unrelated names)", () => {
    const a = item({ name: "Alpha", data: {} });
    const b = item({ name: "Zeta Draft", data: {} });
    assert.deepEqual(computeDuplicatePairs([a, b]), []);
  });
});
