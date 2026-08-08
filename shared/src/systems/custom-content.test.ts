import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { customBackgroundDataSchema } from "./custom-content.js";

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
