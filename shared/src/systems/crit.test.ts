import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { critFormula, critDamageFormula, naturalD20, isCriticalHit, isCriticalMiss, suggestedCritThreshold } from "./crit.js";
import type { RollDetail } from "../types.js";

describe("critFormula", () => {
  it("doubles a single dice term", () => {
    assert.equal(critFormula("1d8"), "2d8");
    assert.equal(critFormula("2d6"), "4d6");
  });

  it("doubles dice but not a flat modifier -- PHB 196", () => {
    assert.equal(critFormula("2d8+4"), "4d8+4");
    assert.equal(critFormula("1d6+1"), "2d6+1");
    assert.equal(critFormula("1d20-3"), "2d20-3");
  });

  it("doubles every dice term independently", () => {
    assert.equal(critFormula("1d8+1d6"), "2d8+2d6");
    assert.equal(critFormula("8d6+2d6"), "16d6+4d6");
  });

  it("strips whitespace", () => {
    assert.equal(critFormula(" 2d8 + 4 "), "4d8+4");
  });

  it("is case-insensitive on the die separator", () => {
    assert.equal(critFormula("2D8+4"), "4d8+4");
  });

  it("leaves a bare constant unchanged -- a real SRD monster damageDice value", () => {
    assert.equal(critFormula("1"), "1");
  });

  it("leaves an empty string unchanged", () => {
    assert.equal(critFormula(""), "");
  });

  it("leaves a keep/drop formula unchanged rather than mangling what the modifier selects", () => {
    assert.equal(critFormula("4d6kh3"), "4d6kh3");
  });

  it("leaves anything else it doesn't recognize unchanged", () => {
    assert.equal(critFormula("(1d4+1)*2"), "(1d4+1)*2");
    assert.equal(critFormula("1d20!"), "1d20!");
    assert.equal(critFormula("not a formula"), "not a formula");
  });
});

describe("critDamageFormula", () => {
  it("is a plain crit when there's no extra dice", () => {
    assert.equal(critDamageFormula("1d8+3", 0), "2d8+3");
  });

  it("adds extra dice of the weapon's own size on top of the doubled roll -- Brutal Critical", () => {
    assert.equal(critDamageFormula("1d12+5", 1), "2d12+5+1d12");
    assert.equal(critDamageFormula("1d12+5", 3), "2d12+5+3d12");
  });

  it("sizes the extra dice off the weapon's own die, not an arbitrary size", () => {
    assert.equal(critDamageFormula("2d6+4", 1), "4d6+4+1d6");
  });

  it("falls back to the doubled formula when the base isn't a recognizable dice term", () => {
    assert.equal(critDamageFormula("1", 1), "1");
  });
});

describe("naturalD20 / isCriticalHit / isCriticalMiss", () => {
  function detailWithD20(value: number, kept = true): RollDetail {
    return { terms: [{ kind: "dice", sides: 20, dice: [{ value, kept }], subtotal: kept ? value : 0 }], total: value };
  }

  it("reads the natural value off a bare d20 roll", () => {
    assert.equal(naturalD20(detailWithD20(17)), 17);
  });

  it("ignores a flat bonus and finds the d20 among other terms", () => {
    const detail: RollDetail = {
      terms: [
        { kind: "dice", sides: 20, dice: [{ value: 20, kept: true }], subtotal: 20 },
        { kind: "operator", op: "+" },
        { kind: "constant", value: 5 },
      ],
      total: 25,
    };
    assert.equal(naturalD20(detail), 20);
  });

  it("returns null with no detail or no d20 term", () => {
    assert.equal(naturalD20(null), null);
    assert.equal(naturalD20({ terms: [{ kind: "constant", value: 5 }], total: 5 }), null);
  });

  it("a natural 20 always crits regardless of threshold, a lower roll needs to meet it", () => {
    assert.equal(isCriticalHit(detailWithD20(20), 20), true);
    assert.equal(isCriticalHit(detailWithD20(19), 20), false);
    assert.equal(isCriticalHit(detailWithD20(19), 19), true);
  });

  it("natural 1 is always a critical miss regardless of threshold", () => {
    assert.equal(isCriticalMiss(detailWithD20(1)), true);
    assert.equal(isCriticalMiss(detailWithD20(2)), false);
  });
});

describe("suggestedCritThreshold", () => {
  it("defaults to 20 with no relevant features", () => {
    assert.equal(suggestedCritThreshold(["Remarkable Athlete"]), 20);
  });

  it("Improved Critical lowers it to 19", () => {
    assert.equal(suggestedCritThreshold(["Improved Critical"]), 19);
  });

  it("Superior Critical wins over Improved Critical when both apply", () => {
    assert.equal(suggestedCritThreshold(["Improved Critical", "Superior Critical"]), 18);
  });

  it("takes the lowest across custom subclass feature thresholds too", () => {
    assert.equal(suggestedCritThreshold([], [19, 17]), 17);
    assert.equal(suggestedCritThreshold(["Improved Critical"], [17]), 17);
  });
});
