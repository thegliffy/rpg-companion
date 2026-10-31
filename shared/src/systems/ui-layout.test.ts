import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SHEET_LAYOUTS, SHEET_LAYOUT_IDS, sheetUiForClass } from "./ui-layout.js";
import { dnd5eSheetSchema, DND5E_CLASSES } from "./dnd5e.js";

describe("sheetUiForClass", () => {
  it("maps every selectable class (incl. Wikidot imports) to a known layout", () => {
    for (const c of DND5E_CLASSES) {
      const { layout } = sheetUiForClass(c.name);
      assert.ok(SHEET_LAYOUT_IDS.includes(layout), `${c.name} -> ${layout}`);
    }
    // The wizard picker's display names resolve through the lowercased-prefix match.
    assert.equal(sheetUiForClass("Artificer (Wikidot Import)").layout, "arcane");
    assert.equal(sheetUiForClass("Blood Hunter (Wikidot)").layout, "martial");
  });

  it("covers every layout archetype so each has at least one class using it", () => {
    const used = new Set(DND5E_CLASSES.map((c) => sheetUiForClass(c.name).layout));
    for (const id of SHEET_LAYOUT_IDS) {
      assert.ok(used.has(id), `no class maps to ${id}`);
    }
  });

  it("falls back to the shipped order with no accent for unknown/homebrew classes", () => {
    assert.deepEqual(sheetUiForClass("Undead Warlock-Knight"), { layout: "martial", accent: null });
  });

  it("gives every mapped class its own accent colour", () => {
    for (const c of DND5E_CLASSES) {
      assert.match(sheetUiForClass(c.name).accent ?? "", /^#[0-9a-f]{6}$/);
    }
  });

  it("each layout's tab order contains every view tab exactly once", () => {
    for (const id of SHEET_LAYOUT_IDS) {
      const tabs = [...SHEET_LAYOUTS[id].tabOrder].sort();
      assert.deepEqual(tabs, ["combat", "equipment", "feats", "overview"]);
      const subs = [...SHEET_LAYOUTS[id].combatSubOrder].sort();
      assert.deepEqual(subs, ["magic", "martial"]);
    }
  });

  it("every archetype genuinely differs from the shipped one (choosing one does something)", () => {
    for (const id of SHEET_LAYOUT_IDS) {
      if (id === "martial") continue;
      const c = SHEET_LAYOUTS.martial;
      const l = SHEET_LAYOUTS[id];
      assert.ok(
        l.tabOrder.join() !== c.tabOrder.join() || l.combatSubOrder.join() !== c.combatSubOrder.join(),
        `${id} is identical to martial`,
      );
    }
  });
});

describe("dnd5eSheetSchema uiVariant", () => {
  it("defaults to auto", () => {
    assert.equal(dnd5eSheetSchema.parse({ abilities: {} }).uiVariant, "auto");
  });

  it("accepts a pinned layout and rejects junk", () => {
    assert.equal(dnd5eSheetSchema.parse({ abilities: {}, uiVariant: "arcane" }).uiVariant, "arcane");
    assert.equal(dnd5eSheetSchema.safeParse({ abilities: {}, uiVariant: "vibes" }).success, false);
  });
});
