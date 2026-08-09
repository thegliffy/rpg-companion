import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customBackgroundDataSchema, customContentDataSchemaFor } from "./custom-content.js";

describe("customBackgroundDataSchema variantTables migration (#180)", () => {
  it("wraps a pre-#180 flat variants[] + variantPickCount into a single untitled table", () => {
    const legacy = {
      skills: { fixed: [], choices: [] },
      variants: [{ id: "v1", title: "Sailor", description: "You grew up on a ship." }],
      variantPickCount: 1,
    };
    const parsed = customBackgroundDataSchema.parse(legacy);
    assert.equal(parsed.variantTables.length, 1);
    assert.equal(parsed.variantTables[0].pickCount, 1);
    assert.equal(parsed.variantTables[0].variants.length, 1);
    assert.equal(parsed.variantTables[0].variants[0].title, "Sailor");
    assert.equal("variants" in parsed, false);
    assert.equal("variantPickCount" in parsed, false);
  });

  it("migrates an empty legacy variants[] to an empty variantTables[], not a phantom table", () => {
    const legacy = { skills: { fixed: [], choices: [] }, variants: [], variantPickCount: 1 };
    const parsed = customBackgroundDataSchema.parse(legacy);
    assert.deepEqual(parsed.variantTables, []);
  });

  it("supports two independent tables authored directly in the current shape (Far Traveler)", () => {
    const data = {
      skills: { fixed: [], choices: [] },
      variantTables: [
        {
          id: "t-reason",
          title: "Reason for Travelling",
          pickCount: 1,
          variants: [{ id: "r1", title: "Fleeing a Crisis", description: "" }],
        },
        {
          id: "t-homeland",
          title: "Homeland",
          pickCount: 1,
          variants: [{ id: "h1", title: "A Bustling City", description: "" }],
        },
      ],
    };
    const parsed = customBackgroundDataSchema.parse(data);
    assert.equal(parsed.variantTables.length, 2);
    assert.equal(parsed.variantTables[0].title, "Reason for Travelling");
    assert.equal(parsed.variantTables[1].title, "Homeland");
  });

  it("treats pickCount: 0 as a pure flavor table (oath tenets, Mercy's masks) -- nothing to pick", () => {
    const data = {
      skills: { fixed: [], choices: [] },
      variantTables: [
        {
          id: "t-tenets",
          title: "Tenets",
          pickCount: 0,
          variants: [{ id: "ten1", title: "Honesty", description: "Don't lie." }],
        },
      ],
    };
    const parsed = customBackgroundDataSchema.parse(data);
    assert.equal(parsed.variantTables[0].pickCount, 0);
  });

  it("still rejects unknown top-level keys post-migration (#177's strict mode)", () => {
    const result = customBackgroundDataSchema.safeParse({
      skills: { fixed: [], choices: [] },
      totallyFakeField: "zzz",
    });
    assert.equal(result.success, false);
  });
});

describe("customContentDataSchemaFor (#181)", () => {
  it("returns the matching schema for every content type", () => {
    assert.equal(customContentDataSchemaFor("feat").safeParse({}).success, true);
    assert.equal(customContentDataSchemaFor("race").safeParse({}).success, true);
    assert.equal(customContentDataSchemaFor("background").safeParse({}).success, true);
    assert.equal(customContentDataSchemaFor("subrace").safeParse({}).success, true);
    assert.equal(customContentDataSchemaFor("subclass").safeParse({}).success, true);
    // class/spell/item/monster each require a field with no default (hitDie, level, etc.) --
    // confirm the right schema is picked by checking `{}` fails on a *missing required* field
    // (and a minimal valid object succeeds), not on an *unrecognized* one, which would mean the
    // wrong schema matched.
    assert.equal(customContentDataSchemaFor("class").safeParse({}).success, false);
    assert.equal(customContentDataSchemaFor("class").safeParse({ hitDie: 8 }).success, true);
    assert.equal(customContentDataSchemaFor("spell").safeParse({}).success, false);
    assert.equal(customContentDataSchemaFor("spell").safeParse({ level: 1 }).success, true);
  });

  it("backfills a field added after the row was first written, the exact crash this closes (#181)", () => {
    // Shaped like a feat stored before #101 added prereqAbility/prereqLevel/prereqText, and
    // before #175/#178 added initiativeBonus/optionalAttackModifier/damageAbilityBonus -- every
    // field a consumer might read unconditionally (Object.entries(d.prereqAbility), etc.) is
    // absent, the same way a genuinely old database row would be.
    const preHistoric = {
      description: "An ancient feat",
      abilityBonuses: {},
      acBonus: 0,
      attackBonus: 0,
      damageBonus: 0,
      spellDCBonus: 0,
      spellAttackBonus: 0,
      saveBonus: 0,
      skillProficiencies: [],
    };
    const parsed = customContentDataSchemaFor("feat").safeParse(preHistoric);
    assert.equal(parsed.success, true);
    if (!parsed.success) return;
    assert.deepEqual((parsed.data as { prereqAbility: unknown }).prereqAbility, {});
    assert.equal((parsed.data as { initiativeBonus: unknown }).initiativeBonus, 0);
  });
});
