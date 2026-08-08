import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dnd5eSheetSchema, activeEffectAcBonus, effectiveSpeed, hasBuffEffect, buffEffectSchema, initiativeBonus, effectiveAbilityScore } from "./dnd5e.js";
import type { Dnd5eSheetData } from "./dnd5e.js";

/** A sheet with the given active effects; every other field takes its schema default. `abilities`
 * is passed explicitly because the object itself has no default -- only its six members do. */
function sheetWith(effects: Record<string, unknown>[], speed = 30): Dnd5eSheetData {
  return dnd5eSheetSchema.parse({
    abilities: {},
    speed,
    activeEffects: effects.map((e, i) => ({ id: `e${i}`, name: `Effect ${i}`, ...e })),
  });
}

describe("activeEffectAcBonus", () => {
  it("is 0 with no effects", () => {
    assert.equal(activeEffectAcBonus(sheetWith([])), 0);
  });

  it("sums AC across effects -- Shield's +5", () => {
    assert.equal(activeEffectAcBonus(sheetWith([{ acBonus: 5 }])), 5);
    assert.equal(activeEffectAcBonus(sheetWith([{ acBonus: 5 }, { acBonus: 1 }])), 6);
  });

  it("ignores effects that carry no AC", () => {
    assert.equal(activeEffectAcBonus(sheetWith([{ attackDice: "1d4" }, { acBonus: 2 }])), 2);
  });
});

describe("effectiveSpeed", () => {
  it("returns the base speed untouched with no effects", () => {
    assert.equal(effectiveSpeed(sheetWith([])), 30);
  });

  it("adds a flat bonus -- Longstrider's +10", () => {
    assert.equal(effectiveSpeed(sheetWith([{ speedBonus: 10 }])), 40);
  });

  it("multiplies -- Boots of Speed doubling", () => {
    assert.equal(effectiveSpeed(sheetWith([{ speedMultiplier: 2 }])), 60);
  });

  it("applies every flat bonus before any multiplier, so the two compose as the rules read", () => {
    // Longstrider (+10) then doubled: you double your *current* speed, so (30+10)*2, not 30*2+10.
    assert.equal(effectiveSpeed(sheetWith([{ speedBonus: 10 }, { speedMultiplier: 2 }])), 80);
    // Order in the array must not matter.
    assert.equal(effectiveSpeed(sheetWith([{ speedMultiplier: 2 }, { speedBonus: 10 }])), 80);
  });

  it("stacks multipliers and rounds down to whole feet", () => {
    assert.equal(effectiveSpeed(sheetWith([{ speedMultiplier: 0.5 }], 25)), 12);
  });

  it("never goes below 0", () => {
    assert.equal(effectiveSpeed(sheetWith([{ speedBonus: -60 }], 30)), 0);
  });
});

describe("hasBuffEffect", () => {
  const blank = buffEffectSchema.parse({});

  it("is false for an all-default buff", () => {
    assert.equal(hasBuffEffect(blank), false);
  });

  it("recognises a pure-AC buff -- otherwise Shield reads as a no-op", () => {
    assert.equal(hasBuffEffect(buffEffectSchema.parse({ acBonus: 5 })), true);
  });

  it("recognises pure-speed buffs, flat and multiplied", () => {
    assert.equal(hasBuffEffect(buffEffectSchema.parse({ speedBonus: 10 })), true);
    assert.equal(hasBuffEffect(buffEffectSchema.parse({ speedMultiplier: 2 })), true);
  });

  it("still recognises the attack/damage/save fields it always did", () => {
    for (const buff of [{ attackBonus: 1 }, { attackDice: "1d4" }, { damageBonus: 2 }, { damageDice: "2d6" }, { saveDice: "1d4" }]) {
      assert.equal(hasBuffEffect(buffEffectSchema.parse(buff)), true, JSON.stringify(buff));
    }
  });

  it("is not fooled by a damage type with no dice behind it", () => {
    assert.equal(hasBuffEffect(buffEffectSchema.parse({ damageType: "fire" })), false);
  });
});

describe("initiativeBonus", () => {
  /** A sheet with the given Dex score and feat/feature entries. */
  function sheetFor(dex: number, entries: { feats?: Record<string, unknown>[]; features?: Record<string, unknown>[] } = {}) {
    return dnd5eSheetSchema.parse({
      abilities: { dex },
      feats: (entries.feats ?? []).map((f, i) => ({ id: `f${i}`, name: `Feat ${i}`, ...f })),
      features: (entries.features ?? []).map((f, i) => ({ id: `x${i}`, name: `Feature ${i}`, ...f })),
    });
  }

  it("is the Dexterity modifier when nothing else applies", () => {
    assert.equal(initiativeBonus(sheetFor(14)), 2);
    assert.equal(initiativeBonus(sheetFor(8)), -1);
  });

  it("adds a feat's initiative bonus -- Alert's +5", () => {
    assert.equal(initiativeBonus(sheetFor(14, { feats: [{ initiativeBonus: 5 }] })), 7);
  });

  it("reads features as well as feats, and sums several", () => {
    assert.equal(initiativeBonus(sheetFor(10, { features: [{ initiativeBonus: 2 }], feats: [{ initiativeBonus: 5 }] })), 7);
  });

  it("stays separate from a Dexterity bonus -- an ability bonus moves AC and every Dex check too", () => {
    const viaInitiative = sheetFor(14, { feats: [{ initiativeBonus: 2 }] });
    const viaAbility = sheetFor(14, { feats: [{ abilityBonuses: { dex: 4 } }] });
    // Both land on +4 initiative, but only the ability route changes the underlying Dex score.
    assert.equal(initiativeBonus(viaInitiative), 4);
    assert.equal(initiativeBonus(viaAbility), 4);
    assert.equal(effectiveAbilityScore(viaInitiative, "dex"), 14);
    assert.equal(effectiveAbilityScore(viaAbility, "dex"), 18);
  });
});
