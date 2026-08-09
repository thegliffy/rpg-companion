import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customBackgroundDataSchema, customContentDataSchemaFor, resolveSpellHealing, customSpellToSrdShape, formatBackgroundGrants } from "./custom-content.js";
import type { CustomContent } from "../types.js";

function spellItem(id: number, data: Record<string, unknown>): CustomContent {
  return {
    id,
    type: "spell",
    system: "dnd5e",
    createdByUserId: 1,
    createdByUsername: "tester",
    name: "Test Spell",
    data,
    status: "approved",
    approvedByUserId: null,
    approvedAt: null,
    createdAt: "2026-01-01",
  };
}

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

describe("customBackgroundDataSchema startingCurrency migration (#182)", () => {
  it("folds a pre-#182 flat gold: number into startingCurrency.gp", () => {
    const legacy = { skills: { fixed: [], choices: [] }, equipment: { items: [], gold: 15 } };
    const parsed = customBackgroundDataSchema.parse(legacy);
    assert.equal(parsed.equipment.startingCurrency.gp, 15);
    assert.equal(parsed.equipment.startingCurrency.sp, 0);
  });

  it("leaves an author-supplied startingCurrency untouched rather than overwriting it from gold", () => {
    const data = {
      skills: { fixed: [], choices: [] },
      equipment: { items: [], gold: 0, startingCurrency: { cp: 0, sp: 5, ep: 0, gp: 0, pp: 0 } },
    };
    const parsed = customBackgroundDataSchema.parse(data);
    assert.equal(parsed.equipment.startingCurrency.sp, 5);
    assert.equal(parsed.equipment.startingCurrency.gp, 0);
  });

  it("defaults to all-zero currency when equipment is never authored", () => {
    const parsed = customBackgroundDataSchema.parse({ skills: { fixed: [], choices: [] } });
    assert.deepEqual(parsed.equipment.startingCurrency, { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 });
  });
});

describe("formatBackgroundGrants equipment currency line (#182)", () => {
  it("lists every nonzero denomination, not just gold", () => {
    const data = customBackgroundDataSchema.parse({
      skills: { fixed: [], choices: [] },
      equipment: { items: [], gold: 0, startingCurrency: { cp: 0, sp: 5, ep: 0, gp: 10, pp: 0 } },
    });
    const { equipment } = formatBackgroundGrants(data);
    assert.match(equipment, /a pouch containing 5 sp, 10 gp/);
  });

  it("omits the pouch line entirely when starting currency is all zero", () => {
    const data = customBackgroundDataSchema.parse({
      skills: { fixed: [], choices: [] },
      equipment: { items: ["a bedroll"], gold: 0 },
    });
    const { equipment } = formatBackgroundGrants(data);
    assert.equal(equipment, "a bedroll");
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

describe("resolveSpellHealing (#182)", () => {
  it("resolves a curated SRD healing spell", () => {
    const h = resolveSpellHealing("cure-wounds", []);
    assert.deepEqual(h, { dice: "1d8", bonus: 0 });
  });

  it("resolves a fixed-value curated spell with no dice", () => {
    const h = resolveSpellHealing("revivify", []);
    assert.deepEqual(h, { dice: "", bonus: 1 });
  });

  it("returns null for a spell with no curated or custom healing", () => {
    assert.equal(resolveSpellHealing("fireball", []), null);
  });

  it("resolves a custom spell's own healingDice/healingBonus", () => {
    const items = [spellItem(1, { level: 1, healingDice: "2d6", healingBonus: 3 })];
    assert.deepEqual(resolveSpellHealing("custom-1", items), { dice: "2d6", bonus: 3 });
  });

  it("treats an all-zero custom spell as no healing, same convention hasBuffEffect uses", () => {
    const items = [spellItem(1, { level: 1, healingDice: "", healingBonus: 0 })];
    assert.equal(resolveSpellHealing("custom-1", items), null);
  });

  it("returns null for an unknown custom id", () => {
    assert.equal(resolveSpellHealing("custom-999", []), null);
  });
});

describe("customSpellToSrdShape carries the new #182 fields", () => {
  it("carries components, saveEffect, conditionImposed, areaOfEffect onto the SrdSpell shape", () => {
    const item = spellItem(1, {
      level: 3,
      school: "Evocation",
      castingTime: "1 action",
      range: "60 feet",
      duration: "Instantaneous",
      requiresAttackRoll: false,
      ritual: false,
      classes: ["wizard"],
      components: { verbal: true, somatic: true, material: true, materialConsumed: true, materialCost: "bat guano" },
      saveEffect: "half",
      conditionImposed: "restrained",
      areaOfEffect: "20-ft radius",
    });
    const srd = customSpellToSrdShape(item);
    assert.deepEqual(srd.components, { verbal: true, somatic: true, material: true, materialConsumed: true, materialCost: "bat guano" });
    assert.equal(srd.saveEffect, "half");
    assert.equal(srd.conditionImposed, "restrained");
    assert.equal(srd.areaOfEffect, "20-ft radius");
  });

  it("normalizes saveEffect 'none' to undefined, matching the empty-string-to-undefined convention for description", () => {
    const item = spellItem(1, {
      level: 0,
      school: "",
      castingTime: "1 action",
      range: "Self",
      duration: "Instantaneous",
      requiresAttackRoll: false,
      ritual: false,
      classes: [],
      saveEffect: "none",
    });
    assert.equal(customSpellToSrdShape(item).saveEffect, undefined);
  });
});
