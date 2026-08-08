import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyDamage, applyHealing } from "./dnd5e.js";

describe("applyDamage", () => {
  it("subtracts from HP when there's no temp HP", () => {
    const r = applyDamage({ hpCurrent: 30, hpMax: 40, tempHp: 0, damage: 12 });
    assert.equal(r.hpCurrent, 18);
    assert.equal(r.hpDelta, -12);
    assert.equal(r.tempAbsorbed, 0);
    assert.equal(r.droppedToZero, false);
    assert.equal(r.died, false);
  });

  it("spends temporary hit points before real HP (PHB 198)", () => {
    const r = applyDamage({ hpCurrent: 30, hpMax: 40, tempHp: 5, damage: 12 });
    assert.equal(r.tempAbsorbed, 5);
    assert.equal(r.tempHp, 0);
    assert.equal(r.hpCurrent, 23);
    // Only the 7 that got past the temp pool counts as HP lost -- this is what a concentration
    // save is computed from, so absorbing must not inflate it.
    assert.equal(r.hpDelta, -7);
  });

  it("is a complete no-op when temp HP absorbs the whole hit", () => {
    const r = applyDamage({ hpCurrent: 30, hpMax: 40, tempHp: 10, damage: 6 });
    assert.equal(r.tempAbsorbed, 6);
    assert.equal(r.tempHp, 4);
    assert.equal(r.hpCurrent, 30);
    assert.equal(r.hpDelta, 0);
    assert.equal(r.deathSaveFailures, 0);
  });

  it("floors at 0 rather than going negative, and flags dropping to 0", () => {
    const r = applyDamage({ hpCurrent: 8, hpMax: 40, tempHp: 0, damage: 20 });
    assert.equal(r.hpCurrent, 0);
    assert.equal(r.hpDelta, -8, "only the 8 HP that existed were lost");
    assert.equal(r.droppedToZero, true);
    assert.equal(r.died, false, "12 leftover is under the 40 max");
  });

  it("kills outright when leftover damage meets or exceeds max HP (massive damage)", () => {
    // 10 HP, 40 max, 50 damage -> 40 carries past 0, which equals max HP.
    const r = applyDamage({ hpCurrent: 10, hpMax: 40, tempHp: 0, damage: 50 });
    assert.equal(r.hpCurrent, 0);
    assert.equal(r.died, true);
    assert.equal(r.deathSaveFailures, 0, "instant death replaces the failure, it doesn't stack");
  });

  it("does not kill when leftover is one short of max HP", () => {
    const r = applyDamage({ hpCurrent: 10, hpMax: 40, tempHp: 0, damage: 49 });
    assert.equal(r.died, false);
    assert.equal(r.droppedToZero, true);
  });

  it("counts temp HP against the massive-damage threshold", () => {
    // Same 50 damage, but 10 temp HP soak first -> only 40 lands, 30 of it past 0. Not death.
    const r = applyDamage({ hpCurrent: 10, hpMax: 40, tempHp: 10, damage: 50 });
    assert.equal(r.died, false);
    assert.equal(r.tempAbsorbed, 10);
  });

  it("adds one death-save failure for damage taken at 0 HP", () => {
    const r = applyDamage({ hpCurrent: 0, hpMax: 40, tempHp: 0, damage: 5 });
    assert.equal(r.hpCurrent, 0);
    assert.equal(r.deathSaveFailures, 1);
    assert.equal(r.hpDelta, 0, "no HP left to lose");
    assert.equal(r.droppedToZero, false, "already was at 0");
  });

  it("adds two death-save failures when the hit at 0 HP was a critical", () => {
    const r = applyDamage({ hpCurrent: 0, hpMax: 40, tempHp: 0, damage: 5, isCrit: true });
    assert.equal(r.deathSaveFailures, 2);
  });

  it("kills instantly when damage at 0 HP meets max HP, crit or not", () => {
    for (const isCrit of [false, true]) {
      const r = applyDamage({ hpCurrent: 0, hpMax: 40, tempHp: 0, damage: 40, isCrit });
      assert.equal(r.died, true);
      assert.equal(r.deathSaveFailures, 0);
    }
  });

  it("ignores zero and negative damage", () => {
    for (const damage of [0, -5]) {
      const r = applyDamage({ hpCurrent: 20, hpMax: 40, tempHp: 3, damage });
      assert.equal(r.hpCurrent, 20);
      assert.equal(r.tempHp, 3);
      assert.equal(r.hpDelta, 0);
    }
  });
});

describe("applyHealing", () => {
  it("restores HP up to the maximum and no further", () => {
    assert.equal(applyHealing({ hpCurrent: 30, hpMax: 40, tempHp: 0, healing: 5 }).hpCurrent, 35);
    const capped = applyHealing({ hpCurrent: 30, hpMax: 40, tempHp: 0, healing: 100 });
    assert.equal(capped.hpCurrent, 40);
    assert.equal(capped.hpDelta, 10, "reports what was actually restored, not what was offered");
  });

  it("leaves temporary hit points alone -- healing can't restore them (PHB 198)", () => {
    const r = applyHealing({ hpCurrent: 10, hpMax: 40, tempHp: 7, healing: 5 });
    assert.equal(r.tempHp, 7);
    assert.equal(r.tempAbsorbed, 0);
  });

  it("flags a revive when any healing lands on a character at 0", () => {
    const r = applyHealing({ hpCurrent: 0, hpMax: 40, tempHp: 0, healing: 1 });
    assert.equal(r.hpCurrent, 1);
    assert.equal(r.revived, true);
  });

  it("does not flag a revive for 0 healing at 0 HP", () => {
    assert.equal(applyHealing({ hpCurrent: 0, hpMax: 40, tempHp: 0, healing: 0 }).revived, false);
  });

  it("does not flag a revive when the character was already conscious", () => {
    assert.equal(applyHealing({ hpCurrent: 5, hpMax: 40, tempHp: 0, healing: 5 }).revived, false);
  });
});
