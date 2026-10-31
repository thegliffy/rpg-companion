/**
 * Per-class sheet UI (#ui). Layout archetypes: the sheet's tab navs and landing panels are
 * data-driven from here, plus a per-class accent colour. Every class defaults to its archetype's
 * layout (via `sheetUiForClass`), and a character can pin any layout through the sheet's
 * `uiVariant` field ("auto" = follow the class).
 *
 * Kept as plain data (no React) so the shared package can validate the `uiVariant` enum and the
 * frontend can iterate the order without importing anything UI-framework-side.
 */

/** Tab ids the 5e sheet knows how to render -- mirrors Dnd5eSheet's view keys. */
export type SheetViewTab = "combat" | "equipment" | "feats" | "overview";

/** Sub-tab ids of the Combat view -- mirrors Dnd5eSheet's combatSub keys. */
export type SheetCombatSub = "martial" | "magic";

export const SHEET_LAYOUT_IDS = ["martial", "arcane", "divine", "hybrid"] as const;
export type SheetLayoutId = (typeof SHEET_LAYOUT_IDS)[number];

export interface SheetLayoutDef {
  label: string;
  /** View-tab order, first to last. Must contain every SheetViewTab exactly once. */
  tabOrder: SheetViewTab[];
  /** Sub-tab order of the Combat view; the first entry is what the sheet opens on. */
  combatSubOrder: SheetCombatSub[];
}

/**
 * Every archetype differs from every other in nav order or landing panel -- choosing one is a
 * visible change, not a relabel. `martial` keeps the order the sheet shipped with.
 */
export const SHEET_LAYOUTS: Record<SheetLayoutId, SheetLayoutDef> = {
  martial: { label: "Martial", tabOrder: ["combat", "equipment", "feats", "overview"], combatSubOrder: ["martial", "magic"] },
  arcane: { label: "Arcane", tabOrder: ["combat", "feats", "overview", "equipment"], combatSubOrder: ["magic", "martial"] },
  divine: { label: "Divine", tabOrder: ["combat", "feats", "equipment", "overview"], combatSubOrder: ["magic", "martial"] },
  hybrid: { label: "Hybrid", tabOrder: ["combat", "equipment", "overview", "feats"], combatSubOrder: ["martial", "magic"] },
};

/**
 * Accent colours are deliberately per class (the user asked for "a different UI for each class"
 * -- two classes sharing a layout archetype should still look like their own class on the sheet).
 * Values must read on the dark themes; these ride the same family as the theme accents.
 */
export const CLASS_UI: Record<string, { layout: SheetLayoutId; accent: string }> = {
  barbarian: { layout: "martial", accent: "#e74c3c" },
  bard: { layout: "hybrid", accent: "#e84393" },
  cleric: { layout: "divine", accent: "#f1c40f" },
  druid: { layout: "divine", accent: "#2ecc71" },
  fighter: { layout: "martial", accent: "#d35400" },
  monk: { layout: "martial", accent: "#16a085" },
  paladin: { layout: "divine", accent: "#f5b041" },
  ranger: { layout: "hybrid", accent: "#229954" },
  rogue: { layout: "hybrid", accent: "#a0a8b0" },
  sorcerer: { layout: "arcane", accent: "#8e44ad" },
  warlock: { layout: "arcane", accent: "#7d3c98" },
  wizard: { layout: "arcane", accent: "#2e86de" },
  // Wikidot-import pseudo-classes: sheet.class stores the import's display name, matched on the
  // lowercased name prefix below, so keys here stay bare.
  artificer: { layout: "arcane", accent: "#00b3b3" },
  "blood hunter": { layout: "martial", accent: "#c0392b" },
};

/** Resolve a class display name (including "(Wikidot)"-style imports) to its layout + accent. */
export function sheetUiForClass(
  className: string,
): { layout: SheetLayoutId; accent: string | null } {
  const key = className.trim().toLowerCase();
  const entry =
    CLASS_UI[key] ??
    Object.entries(CLASS_UI).find(([name]) => key.startsWith(name))?.[1] ??
    null;
  // Unknown/homebrew classes keep the shipped (martial) order but no accent override -- the
  // theme's own accent is the fallback. (Homebrew classes genuinely have no archetype opinion.)
  return { layout: entry?.layout ?? "martial", accent: entry?.accent ?? null };
}
