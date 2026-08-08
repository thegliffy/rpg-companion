import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customFeatDataSchema, customSpellDataSchema, customRaceDataSchema } from "shared";
import { describeSchemaIssues } from "./schemaErrors.js";

/** Runs a payload through a schema and returns the author-facing messages (asserting it failed). */
function messagesFor(schema: Parameters<typeof describeSchemaIssues>[0], data: unknown): string[] {
  const parsed = schema.safeParse(data);
  if (parsed.success) throw new Error("expected the payload to be rejected, but it parsed");
  return describeSchemaIssues(schema, parsed.error.issues);
}

describe("strict custom-content schemas (#177)", () => {
  it("rejects an unknown field instead of silently dropping it", () => {
    const messages = messagesFor(customFeatDataSchema, { description: "x", totallyFakeField: 1 });
    assert.match(messages[0], /Unknown field/);
    assert.match(messages[0], /totallyFakeField/);
  });

  it("suggests the nearest real field for a typo", () => {
    const messages = messagesFor(customFeatDataSchema, { description: "x", initiativeBonis: 5 });
    assert.match(messages[0], /did you mean "initiativeBonus"/);
  });

  it("rejects a stripped field the old schema quietly accepted -- a spell's components", () => {
    const messages = messagesFor(customSpellDataSchema, {
      level: 1,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self",
      duration: "1 round",
      requiresAttackRoll: false,
      ritual: false,
      classes: ["wizard"],
      components: "V,S",
    });
    assert.match(messages[0], /components/);
  });

  it("names the nested path when the unknown key is inside a sub-object", () => {
    const messages = messagesFor(customSpellDataSchema, {
      level: 1,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self",
      duration: "1 round",
      requiresAttackRoll: false,
      ritual: false,
      classes: ["wizard"],
      buff: { acBonuss: 5 },
    });
    assert.match(messages[0], /at "buff"/);
    // The suggestion must come from the *buff* schema, not the top-level spell schema.
    assert.match(messages[0], /did you mean "acBonus"/);
  });

  it("offers no suggestion when nothing is close, rather than a misleading one", () => {
    const messages = messagesFor(customFeatDataSchema, { description: "x", qqqqqqqqzzzz: 1 });
    assert.doesNotMatch(messages[0], /did you mean/);
  });

  it("still accepts every real field, including the ones added this pass", () => {
    assert.equal(customFeatDataSchema.safeParse({ description: "x", initiativeBonus: 5 }).success, true);
    const spell = customSpellDataSchema.safeParse({
      level: 1,
      school: "Abjuration",
      castingTime: "1 action",
      range: "Self",
      duration: "1 round",
      requiresAttackRoll: false,
      ritual: false,
      classes: ["wizard"],
      buff: { acBonus: 5, speedBonus: 10, speedMultiplier: 2 },
    });
    assert.equal(spell.success, true);
  });

  it("keeps migrating legacy shapes -- preprocess runs before strict sees the keys", () => {
    // A pre-#124 race stored `traits` as a bare string[]; the preprocess upgrades it first.
    assert.equal(customRaceDataSchema.safeParse({ speed: 30, traits: ["Darkvision"] }).success, true);
  });
});
