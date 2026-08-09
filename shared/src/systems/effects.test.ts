import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dnd5eSheetSchema,
  activeEffectAcBonus,
  effectiveSpeed,
  hasBuffEffect,
  buffEffectSchema,
  initiativeBonus,
  effectiveAbilityScore,
  d20Formula,
  effectiveHpBonus,
  effectiveDarkvision,
  isSaveProficient,
  effectSaveProficiencies,
  hasCompanionGrant,
  saveBonus,
  effectiveAC,
  acBreakdownText,
} from "./dnd5e.js";
import type { Dnd5eSheetData } from "./dnd5e.js";
import { naturalD20, isCriticalHit, isCriticalMiss } from "./crit.js";
import type { RollDetail } from "../types.js";

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

  it("is not fooled by damage type options with no dice behind them either (#180)", () => {
    assert.equal(hasBuffEffect(buffEffectSchema.parse({ damageTypeOptions: ["radiant", "necrotic"] })), false);
  });

  it("still recognises a damage-dice buff that also carries type options", () => {
    assert.equal(
      hasBuffEffect(buffEffectSchema.parse({ damageDice: "3d8", damageTypeOptions: ["radiant", "necrotic"] })),
      true,
    );
  });
});

describe("buffEffectSchema damageTypeOptions (#180)", () => {
  it("defaults to empty -- damageType behaves exactly as before when no choice is authored", () => {
    const buff = buffEffectSchema.parse({ damageDice: "1d6", damageType: "fire" });
    assert.deepEqual(buff.damageTypeOptions, []);
    assert.equal(buff.damageType, "fire");
  });

  it("round-trips an authored set of alignment-split options", () => {
    const buff = buffEffectSchema.parse({ damageDice: "3d8", damageTypeOptions: ["radiant", "necrotic"] });
    assert.deepEqual(buff.damageTypeOptions, ["radiant", "necrotic"]);
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

describe("effectiveHpBonus (#182, Tough)", () => {
  function sheetAtLevel(level: number, feats: Record<string, unknown>[] = []) {
    return dnd5eSheetSchema.parse({
      level,
      abilities: {},
      feats: feats.map((f, i) => ({ id: `f${i}`, name: `Feat ${i}`, ...f })),
    });
  }

  it("is 0 with no hpBonusPerLevel source", () => {
    assert.equal(effectiveHpBonus(sheetAtLevel(5)), 0);
  });

  it("multiplies by the character's current level -- Tough's +2/level", () => {
    assert.equal(effectiveHpBonus(sheetAtLevel(5, [{ hpBonusPerLevel: 2 }])), 10);
    assert.equal(effectiveHpBonus(sheetAtLevel(1, [{ hpBonusPerLevel: 2 }])), 2);
  });

  it("sums more than one source", () => {
    assert.equal(effectiveHpBonus(sheetAtLevel(4, [{ hpBonusPerLevel: 2 }, { hpBonusPerLevel: 1 }])), 12);
  });
});

describe("effectiveSpeed with a feat-sourced speedBonus (#182, Mobile)", () => {
  function sheetWithSpeedFeat(speed: number, feats: Record<string, unknown>[] = []) {
    return dnd5eSheetSchema.parse({
      speed,
      abilities: {},
      feats: feats.map((f, i) => ({ id: `f${i}`, name: `Feat ${i}`, ...f })),
    });
  }

  it("adds an always-on feat speed bonus -- Mobile's +10 ft", () => {
    assert.equal(effectiveSpeed(sheetWithSpeedFeat(30, [{ speedBonus: 10 }])), 40);
  });

  it("composes with an active-effect multiplier as (base + flat) * multiplier", () => {
    const sheet = dnd5eSheetSchema.parse({
      speed: 30,
      abilities: {},
      feats: [{ id: "f0", name: "Mobile", speedBonus: 10 }],
      activeEffects: [{ id: "e0", name: "Boots of Speed", speedMultiplier: 2 }],
    });
    // (30 + 10 feat) * 2 = 80, not 30*2 + 10 = 70 -- the flat bonus applies before the multiplier
    // the same way a buff's own speedBonus already does.
    assert.equal(effectiveSpeed(sheet), 80);
  });
});

describe("isSaveProficient / effectSaveProficiencies (#182, Resilient)", () => {
  function sheetWith(saveProficiencies: string[], feats: Record<string, unknown>[] = []) {
    return dnd5eSheetSchema.parse({
      abilities: {},
      saveProficiencies,
      feats: feats.map((f, i) => ({ id: `f${i}`, name: `Feat ${i}`, ...f })),
    });
  }

  it("is proficient via the sheet's own fixed list, same as before this existed", () => {
    assert.equal(isSaveProficient(sheetWith(["wis"]), "wis"), true);
    assert.equal(isSaveProficient(sheetWith(["wis"]), "str"), false);
  });

  it("is also proficient via a granting feat -- Resilient (Constitution)", () => {
    const sheet = sheetWith([], [{ savingThrowProficiencies: ["con"] }]);
    assert.equal(isSaveProficient(sheet, "con"), true);
    assert.equal(isSaveProficient(sheet, "str"), false);
  });

  it("the two sources are additive, not exclusive", () => {
    const sheet = sheetWith(["wis"], [{ savingThrowProficiencies: ["con"] }]);
    assert.equal(isSaveProficient(sheet, "wis"), true);
    assert.equal(isSaveProficient(sheet, "con"), true);
  });

  it("removing the granting feat un-grants the proficiency, mirroring effectSkillProficiencies", () => {
    assert.deepEqual(effectSaveProficiencies(sheetWith([], [{ savingThrowProficiencies: ["con", "wis"] }])), ["con", "wis"]);
    assert.deepEqual(effectSaveProficiencies(sheetWith([])), []);
  });

  it("saveBonus() adds the proficiency bonus once proficient via either source", () => {
    const proficient = sheetWith([], [{ savingThrowProficiencies: ["con"] }]);
    const notProficient = sheetWith([]);
    // Both start from the same ability score (10, +0 mod); the only difference is proficiency.
    assert.equal(saveBonus(proficient, "con") > saveBonus(notProficient, "con"), true);
  });
});

describe("effectiveAC with naturalArmorBase (#182, Natural Armor / Bladesong)", () => {
  function sheetWithNaturalArmor(abilities: Record<string, number>, feats: Record<string, unknown>[] = []) {
    return dnd5eSheetSchema.parse({
      abilities,
      feats: feats.map((f, i) => ({ id: `f${i}`, name: `Feat ${i}`, ...f })),
    });
  }

  it("uses base + Dex instead of the plain unarmored AC when granted -- Lizardfolk/Tortle-style", () => {
    const sheet = sheetWithNaturalArmor({ dex: 14 }, [{ naturalArmorBase: 13 }]);
    assert.equal(effectiveAC(sheet), 13 + 2); // +2 Dex mod
  });

  it("adds a second ability on top of base + Dex when set -- Bladesong-style INT-to-AC", () => {
    const sheet = sheetWithNaturalArmor({ dex: 14, int: 16 }, [{ naturalArmorBase: 10, naturalArmorAbility: "int" }]);
    assert.equal(effectiveAC(sheet), 10 + 2 + 3); // 10 + Dex +2 + Int +3
  });

  it("falls back to the plain sheet.ac fallback when nothing grants it", () => {
    const sheet = dnd5eSheetSchema.parse({ abilities: { dex: 14 }, ac: 12 });
    assert.equal(effectiveAC(sheet), 12);
  });

  it("still adds feat acBonus and active-effect bonuses on top of natural armor", () => {
    const sheet = dnd5eSheetSchema.parse({
      abilities: { dex: 14 },
      feats: [{ id: "f0", name: "Natural Armor", naturalArmorBase: 13 }, { id: "f1", name: "Defense-alike", acBonus: 1 }],
      activeEffects: [{ id: "e0", name: "Shield", acBonus: 5 }],
    });
    assert.equal(effectiveAC(sheet), 13 + 2 + 1 + 5);
  });

  it("picks the higher of two natural-armor sources rather than stacking or picking the first", () => {
    const sheet = sheetWithNaturalArmor({ dex: 10 }, [{ naturalArmorBase: 12 }, { naturalArmorBase: 15 }]);
    assert.equal(effectiveAC(sheet), 15); // not 12, not 27
  });
});

describe("effectiveAC naturalArmorAllowsLightArmor gating (#182, Bladesong vs. Natural Armor)", () => {
  function armorItem(category: "light" | "medium" | "heavy" | "shield", baseAC: number) {
    return {
      id: "armor0",
      name: "Test Armor",
      equipped: true,
      armor: { baseAC, addDex: category !== "heavy", category, stealthDisadvantage: false },
    };
  }

  it("plain Natural Armor (allowsLightArmor: false) is blocked by light armor too", () => {
    const sheet = dnd5eSheetSchema.parse({
      abilities: { dex: 14 },
      feats: [{ id: "f0", name: "Natural Armor", naturalArmorBase: 13 }],
      items: [armorItem("light", 11)],
    });
    // Falls through to the equipped light armor's own AC, not the natural-armor formula.
    assert.equal(effectiveAC(sheet), 11 + 2);
  });

  it("Bladesong-style (allowsLightArmor: true) still applies in light armor", () => {
    const sheet = dnd5eSheetSchema.parse({
      abilities: { dex: 14, int: 16 },
      feats: [{ id: "f0", name: "Bladesong", naturalArmorBase: 10, naturalArmorAbility: "int", naturalArmorAllowsLightArmor: true }],
      items: [armorItem("light", 11)],
    });
    assert.equal(effectiveAC(sheet), 10 + 2 + 3); // formula wins over the light armor's own AC
  });

  it("Bladesong-style is still blocked by medium armor", () => {
    const sheet = dnd5eSheetSchema.parse({
      abilities: { dex: 14, int: 16 },
      feats: [{ id: "f0", name: "Bladesong", naturalArmorBase: 10, naturalArmorAbility: "int", naturalArmorAllowsLightArmor: true }],
      items: [armorItem("medium", 14)],
    });
    assert.equal(effectiveAC(sheet), 14 + 2); // the medium armor's own AC, not the formula
  });

  it("Bladesong-style is blocked by a shield, per its own \"not wielding a shield\" clause", () => {
    const sheet = dnd5eSheetSchema.parse({
      abilities: { dex: 14, int: 16 },
      feats: [{ id: "f0", name: "Bladesong", naturalArmorBase: 10, naturalArmorAbility: "int", naturalArmorAllowsLightArmor: true }],
      items: [armorItem("shield", 2)],
    });
    assert.equal(effectiveAC(sheet), 10 + 2 + 2); // 10 + Dex unarmored fallback + the shield's own +2, not the formula
  });

  it("plain Natural Armor is unaffected by a shield, unlike Bladesong-style", () => {
    const sheet = dnd5eSheetSchema.parse({
      abilities: { dex: 10 },
      feats: [{ id: "f0", name: "Natural Armor", naturalArmorBase: 13 }],
      items: [armorItem("shield", 2)],
    });
    assert.equal(effectiveAC(sheet), 13 + 0 + 2); // formula + shield bonus, both apply together
  });

  it("acBreakdownText is null (not a stale armor description) when Bladesong overrides light armor", () => {
    const sheet = dnd5eSheetSchema.parse({
      abilities: { dex: 14, int: 16 },
      feats: [{ id: "f0", name: "Bladesong", naturalArmorBase: 10, naturalArmorAbility: "int", naturalArmorAllowsLightArmor: true }],
      items: [armorItem("light", 11)],
    });
    assert.equal(acBreakdownText(sheet), null);
  });

  it("acBreakdownText still describes the armor when it's medium (Bladesong blocked)", () => {
    const sheet = dnd5eSheetSchema.parse({
      abilities: { dex: 14, int: 16 },
      feats: [{ id: "f0", name: "Bladesong", naturalArmorBase: 10, naturalArmorAbility: "int", naturalArmorAllowsLightArmor: true }],
      items: [armorItem("medium", 14)],
    });
    assert.match(acBreakdownText(sheet)!, /Test Armor 14/);
  });
});

describe("effectiveAbilityScore with abilityScoreSetTo (#182, Amulet of Health)", () => {
  function sheetWithItem(con: number, item: Record<string, unknown>) {
    return dnd5eSheetSchema.parse({
      abilities: { con },
      items: [{ id: "i0", name: "Amulet of Health", equipped: true, ...item }],
    });
  }

  it("raises a lower score to the set value", () => {
    const sheet = sheetWithItem(10, { abilityScoreSetTo: { con: 19 } });
    assert.equal(effectiveAbilityScore(sheet, "con"), 19);
  });

  it("never lowers a score that's already higher -- 'no effect if already 19+'", () => {
    const sheet = sheetWithItem(20, { abilityScoreSetTo: { con: 19 } });
    assert.equal(effectiveAbilityScore(sheet, "con"), 20);
  });

  it("is evaluated after additive ability bonuses, not instead of them", () => {
    const sheet = sheetWithItem(10, { abilityScoreSetTo: { con: 19 }, abilityBonuses: { con: 2 } });
    // 10 + 2 = 12, still below 19 -- setTo wins.
    assert.equal(effectiveAbilityScore(sheet, "con"), 19);
  });

  it("only applies while the item is active (equipped)", () => {
    const sheet = dnd5eSheetSchema.parse({
      abilities: { con: 10 },
      items: [{ id: "i0", name: "Amulet of Health", equipped: false, abilityScoreSetTo: { con: 19 } }],
    });
    assert.equal(effectiveAbilityScore(sheet, "con"), 10);
  });

  it("does not affect an ability the item doesn't set", () => {
    const sheet = sheetWithItem(10, { abilityScoreSetTo: { con: 19 } });
    assert.equal(effectiveAbilityScore(sheet, "str"), 10);
  });
});

describe("hasBuffEffect with flySpeed (#182, Broom of Flying)", () => {
  it("recognises a pure fly-speed grant -- otherwise a Broom of Flying toggle reads as a no-op", () => {
    assert.equal(hasBuffEffect(buffEffectSchema.parse({ flySpeed: 30 })), true);
  });

  it("stays a no-op at flySpeed 0, same as every other zero-valued field", () => {
    assert.equal(hasBuffEffect(buffEffectSchema.parse({})), false);
  });
});

describe("hasCompanionGrant (#182, Beast Master / Echo Knight-style companions)", () => {
  it("is false with no granted feat/feature", () => {
    const sheet = dnd5eSheetSchema.parse({ abilities: {} });
    assert.equal(hasCompanionGrant(sheet), false);
  });

  it("is true once a feature carries grantsCompanion", () => {
    const sheet = dnd5eSheetSchema.parse({
      abilities: {},
      features: [{ id: "feat0", name: "Ranger's Companion", grantsCompanion: true }],
    });
    assert.equal(hasCompanionGrant(sheet), true);
  });

  it("is true via a granted feat too, not just features", () => {
    const sheet = dnd5eSheetSchema.parse({
      abilities: {},
      feats: [{ id: "f0", name: "Homebrew Beastmaster", grantsCompanion: true }],
    });
    assert.equal(hasCompanionGrant(sheet), true);
  });

  it("stays false when every entry leaves grantsCompanion at its default", () => {
    const sheet = dnd5eSheetSchema.parse({
      abilities: {},
      features: [{ id: "feat0", name: "Something Else" }],
    });
    assert.equal(hasCompanionGrant(sheet), false);
  });
});

describe("effectiveDarkvision (#182, Twilight Domain's Eyes of Night)", () => {
  it("is just the sheet's own value with no granting feat/feature", () => {
    const sheet = dnd5eSheetSchema.parse({ abilities: {}, darkvisionFeet: 60 });
    assert.equal(effectiveDarkvision(sheet), 60);
  });

  it("takes the higher of the sheet's value and a granted feature's, not the sum", () => {
    const sheet = dnd5eSheetSchema.parse({
      abilities: {},
      darkvisionFeet: 60,
      features: [{ id: "f0", name: "Eyes of Night", darkvisionFeet: 300 }],
    });
    assert.equal(effectiveDarkvision(sheet), 300);
  });

  it("a lower granted value never overrides a higher sheet value", () => {
    const sheet = dnd5eSheetSchema.parse({
      abilities: {},
      darkvisionFeet: 120,
      feats: [{ id: "f0", name: "Minor Darkvision Feat", darkvisionFeet: 30 }],
    });
    assert.equal(effectiveDarkvision(sheet), 120);
  });

  it("stays at the sheet's value when a granted entry leaves darkvisionFeet unset", () => {
    const sheet = dnd5eSheetSchema.parse({
      abilities: {},
      darkvisionFeet: 60,
      features: [{ id: "f0", name: "Something Else" }],
    });
    assert.equal(effectiveDarkvision(sheet), 60);
  });
});

describe("d20Formula", () => {
  it("uses a single d20 at normal", () => {
    assert.equal(d20Formula("normal", 0), "1d20");
    assert.equal(d20Formula("normal", 5), "1d20+5");
    assert.equal(d20Formula("normal", -2), "1d20-2");
  });

  it("keeps the higher of two d20s for advantage, the lower for disadvantage", () => {
    assert.equal(d20Formula("advantage", 5), "2d20kh1+5");
    assert.equal(d20Formula("disadvantage", 5), "2d20kl1+5");
  });

  it("omits a zero bonus rather than emitting '+0'", () => {
    assert.equal(d20Formula("advantage", 0), "2d20kh1");
  });

  it("puts extra dice before the flat bonus and preserves their own sign", () => {
    assert.equal(d20Formula("normal", 5, ["1d4"]), "1d20+1d4+5");
    assert.equal(d20Formula("normal", 5, ["-1d4"]), "1d20-1d4+5");
    // Bless and Bane at once, on an advantage roll.
    assert.equal(d20Formula("advantage", 3, ["1d4", "-1d4"]), "2d20kh1+1d4-1d4+3");
  });

  it("ignores blank dice entries", () => {
    assert.equal(d20Formula("normal", 2, ["", "  "]), "1d20+2");
  });

  it("trims whitespace around a dice term", () => {
    assert.equal(d20Formula("normal", 0, [" 1d6 "]), "1d20+1d6");
  });
});

describe("naturalD20 on advantage/disadvantage rolls (#176)", () => {
  /** A RollDetail shaped like what the backend produces for a 2d20kh1/kl1 roll. */
  function twoD20(a: { value: number; kept: boolean }, b: { value: number; kept: boolean }): RollDetail {
    return {
      terms: [{ kind: "dice", sides: 20, dice: [a, b], subtotal: (a.kept ? a.value : 0) + (b.kept ? b.value : 0) }],
      total: (a.kept ? a.value : 0) + (b.kept ? b.value : 0),
    };
  }

  it("reads the kept die, not the first one", () => {
    assert.equal(naturalD20(twoD20({ value: 3, kept: false }, { value: 17, kept: true })), 17);
  });

  it("does NOT crit on a DROPPED natural 20 -- the whole risk of two-d20 rolls", () => {
    // Disadvantage: a 20 was rolled but discarded, so this is a 5, not a critical hit.
    const detail = twoD20({ value: 20, kept: false }, { value: 5, kept: true });
    assert.equal(naturalD20(detail), 5);
    assert.equal(isCriticalHit(detail, 20), false);
  });

  it("still crits on a KEPT natural 20", () => {
    const detail = twoD20({ value: 20, kept: true }, { value: 2, kept: false });
    assert.equal(isCriticalHit(detail, 20), true);
  });

  it("does not treat a dropped natural 1 as a critical miss", () => {
    assert.equal(isCriticalMiss(twoD20({ value: 1, kept: false }, { value: 12, kept: true })), false);
    assert.equal(isCriticalMiss(twoD20({ value: 1, kept: true }, { value: 12, kept: false })), true);
  });
});
