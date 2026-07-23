import { z } from "zod";

export const DND5E_ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Dnd5eAbility = (typeof DND5E_ABILITIES)[number];

export const DND5E_ABILITY_NAMES: Record<Dnd5eAbility, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

// SRD 5.1 standard languages (CC-BY-4.0) -- names only, used by race data and the background
// "N languages of your choice" grant.
export const DND5E_LANGUAGES = [
  "Common",
  "Dwarvish",
  "Elvish",
  "Giant",
  "Gnomish",
  "Goblin",
  "Halfling",
  "Orc",
  "Abyssal",
  "Celestial",
  "Draconic",
  "Deep Speech",
  "Infernal",
  "Primordial",
  "Sylvan",
  "Undercommon",
] as const;

// SRD 5.1 skill list (CC-BY-4.0)
export const DND5E_SKILLS: { id: string; name: string; ability: Dnd5eAbility }[] = [
  { id: "acrobatics", name: "Acrobatics", ability: "dex" },
  { id: "animal-handling", name: "Animal Handling", ability: "wis" },
  { id: "arcana", name: "Arcana", ability: "int" },
  { id: "athletics", name: "Athletics", ability: "str" },
  { id: "deception", name: "Deception", ability: "cha" },
  { id: "history", name: "History", ability: "int" },
  { id: "insight", name: "Insight", ability: "wis" },
  { id: "intimidation", name: "Intimidation", ability: "cha" },
  { id: "investigation", name: "Investigation", ability: "int" },
  { id: "medicine", name: "Medicine", ability: "wis" },
  { id: "nature", name: "Nature", ability: "int" },
  { id: "perception", name: "Perception", ability: "wis" },
  { id: "performance", name: "Performance", ability: "cha" },
  { id: "persuasion", name: "Persuasion", ability: "cha" },
  { id: "religion", name: "Religion", ability: "int" },
  { id: "sleight-of-hand", name: "Sleight of Hand", ability: "dex" },
  { id: "stealth", name: "Stealth", ability: "dex" },
  { id: "survival", name: "Survival", ability: "wis" },
];

// SRD 5.1 classes with hit dice (CC-BY-4.0)
export const DND5E_CLASSES: { name: string; hitDie: number }[] = [
  { name: "Barbarian", hitDie: 12 },
  { name: "Bard", hitDie: 8 },
  { name: "Cleric", hitDie: 8 },
  { name: "Druid", hitDie: 8 },
  { name: "Fighter", hitDie: 10 },
  { name: "Monk", hitDie: 8 },
  { name: "Paladin", hitDie: 10 },
  { name: "Ranger", hitDie: 10 },
  { name: "Rogue", hitDie: 8 },
  { name: "Sorcerer", hitDie: 6 },
  { name: "Warlock", hitDie: 8 },
  { name: "Wizard", hitDie: 6 },
];

export const DND5E_ALIGNMENTS = [
  "Lawful Good",
  "Neutral Good",
  "Chaotic Good",
  "Lawful Neutral",
  "True Neutral",
  "Chaotic Neutral",
  "Lawful Evil",
  "Neutral Evil",
  "Chaotic Evil",
] as const;

// SRD 5.1 standard conditions (CC-BY-4.0), exhaustion handled separately (has levels)
export const DND5E_CONDITIONS = [
  "blinded",
  "charmed",
  "deafened",
  "frightened",
  "grappled",
  "incapacitated",
  "invisible",
  "paralyzed",
  "petrified",
  "poisoned",
  "prone",
  "restrained",
  "stunned",
  "unconscious",
] as const;
export type Dnd5eCondition = (typeof DND5E_CONDITIONS)[number];

const abilityScoreSchema = z.number().int().min(1).max(30);

const attackSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(100),
  ability: z.enum(DND5E_ABILITIES).default("str"),
  // Manual, for +1/+2/+3 weapons -- added to both the attack roll and damage.
  magicBonus: z.number().int().min(-5).max(5).default(0),
  damageDice: z.string().max(30).default(""),
  damageType: z.string().max(30).default(""),
});

const spellSchema = z.object({
  id: z.string().min(1),
  // References an SrdSpell.id when picked from the SRD dropdown; absent for a
  // custom/homebrew spell entered by name.
  srdId: z.string().max(80).optional(),
  name: z.string().max(100),
  level: z.number().int().min(0).max(9),
  prepared: z.boolean().default(false),
  // Overrides sheet.spellcastingAbility for this spell only (multiclass casters,
  // feats keying off a different ability). Falls back to the sheet default when unset.
  abilityOverride: z.enum(DND5E_ABILITIES).optional(),
  // Granted "at will" by a feat/invocation (e.g. Armor of Shadows -> mage armor at will) --
  // always castable without spending a slot, same as a cantrip (see consumesSlot in the sheet).
  atWill: z.boolean().default(false),
});

// Structured armor data copied from SRD_ARMOR/CustomItemData onto an inventory item when picked
// from the armor dropdown -- lets effectiveAC() compute real 5e AC (base + capped Dex, one body
// armor + one shield) instead of flat-adding a manually-entered acBonus.
const inventoryArmorSchema = z.object({
  baseAC: z.number().int().min(0).max(30),
  addDex: z.boolean(),
  maxDex: z.number().int().min(0).max(10).optional(),
  category: z.enum(["light", "medium", "heavy", "shield"]),
  stealthDisadvantage: z.boolean(),
});

const inventoryItemSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(100),
  quantity: z.number().int().min(0).max(9999).default(1),
  weight: z.number().min(0).max(9999).default(0),
  notes: z.string().max(200).default(""),
  // References an SrdMagicItem.name when picked from the SRD dropdown; freeform items just
  // leave this unset. Bonuses below are always entered manually -- the SRD data has no
  // structured numeric effects, so there's nothing to auto-apply from the picked name.
  equipped: z.boolean().default(false),
  abilityBonuses: z.record(z.enum(DND5E_ABILITIES), z.number().int().min(-10).max(10)).default({}),
  acBonus: z.number().int().min(-10).max(10).default(0),
  // Present only for armor/shield items (from the SRD or custom armor picker) -- drives
  // effectiveAC()'s real AC formula instead of the flat acBonus above.
  armor: inventoryArmorSchema.optional(),
  // requiresAttunement is a manual flag -- SRD magic item data (SrdMagicItem) is names/category/
  // rarity only, no attunement info, so it can't be auto-derived from the picked name.
  requiresAttunement: z.boolean().default(false),
  attuned: z.boolean().default(false),
  // Sell value in gp, manually entered -- used by the campaign shop's "sell" transaction.
  value: z.number().min(0).max(999999).default(0),
});

const currencySchema = z.object({
  cp: z.number().int().min(0).max(999999).default(0),
  sp: z.number().int().min(0).max(999999).default(0),
  ep: z.number().int().min(0).max(999999).default(0),
  gp: z.number().int().min(0).max(999999).default(0),
  pp: z.number().int().min(0).max(999999).default(0),
});

// A feat or feature/trait on the character sheet -- always-active structured bonuses that feed
// the derived ability/AC/attack/spell values (unlike equipped items, no equip toggle). Sourced
// from an SRD/custom feat template, class/subclass level-up, or hand-entered; the bonuses are
// copied onto the sheet entry. Feats and features use the same shape but stay separate arrays
// on the sheet since the physical 5e sheet separates the two sections.
export const effectEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().max(100),
  description: z.string().max(500).default(""),
  abilityBonuses: z.record(z.enum(DND5E_ABILITIES), z.number().int().min(-10).max(10)).default({}),
  acBonus: z.number().int().min(-10).max(10).default(0),
  attackBonus: z.number().int().min(-10).max(10).default(0),
  damageBonus: z.number().int().min(-10).max(10).default(0),
  spellDCBonus: z.number().int().min(-10).max(10).default(0),
  spellAttackBonus: z.number().int().min(-10).max(10).default(0),
  // Skill ids this feat/feature/invocation grants proficiency in (e.g. Beguiling Influence ->
  // deception+persuasion) -- aggregated alongside sheet.skillProficiencies rather than merged
  // into it, so removing the entry (e.g. swapping invocations) automatically un-grants it.
  skillProficiencies: z.array(z.string().max(40)).default([]),
});

export type EffectEntry = z.infer<typeof effectEntrySchema>;

export const dnd5eSheetSchema = z.object({
  class: z.string().max(60).default(""),
  subclass: z.string().max(60).default(""),
  race: z.string().max(60).default(""),
  subrace: z.string().max(60).default(""),
  background: z.string().max(60).default(""),
  alignment: z.string().max(40).default("True Neutral"),
  level: z.number().int().min(1).max(20).default(1),
  abilities: z.object({
    str: abilityScoreSchema.default(10),
    dex: abilityScoreSchema.default(10),
    con: abilityScoreSchema.default(10),
    int: abilityScoreSchema.default(10),
    wis: abilityScoreSchema.default(10),
    cha: abilityScoreSchema.default(10),
  }),
  saveProficiencies: z.array(z.enum(DND5E_ABILITIES)).default([]),
  skillProficiencies: z.array(z.string().max(40)).max(30).default([]),
  ac: z.number().int().min(0).max(40).default(10),
  speed: z.number().int().min(0).max(200).default(30),
  hitDice: z.string().max(20).default(""),
  hitDiceTotal: z.number().int().min(0).max(20).default(1),
  hitDiceAvailable: z.number().int().min(0).max(20).default(1),
  // Per-level hit die amount (rolled or averaged), CON excluded -- index 0 is level 1's
  // max die value. Combined with the current CON modifier in computeHpMax() so a later
  // CON change (ASI, item, feature) retroactively corrects every level already gained.
  hpDiceHistory: z.array(z.number().int().min(0).max(30)).max(20).default([]),
  deathSaveSuccesses: z.number().int().min(0).max(3).default(0),
  deathSaveFailures: z.number().int().min(0).max(3).default(0),
  attacks: z.array(attackSchema).max(20).default([]),
  spellSlots: z
    .array(
      z.object({
        level: z.number().int().min(1).max(9),
        total: z.number().int().min(0).max(20),
        // Slots currently unspent (not "used") — restored to `total` on a rest.
        available: z.number().int().min(0).max(20),
      }),
    )
    .max(9)
    .default([]),
  proficienciesText: z.string().max(4000).default(""),
  // Freeform history predating the structured `features` list below (item #45) -- kept as an
  // "other notes" scratch area rather than replaced, so nothing written before the migration
  // is lost.
  featuresText: z.string().max(8000).default(""),
  equipmentText: z.string().max(4000).default(""),
  personalityText: z.string().max(4000).default(""),
  // Owner-only scratch space — redacted server-side for a DM viewing/editing
  // someone else's character; never sent to or writable by a non-owner.
  privateNotes: z.string().max(4000).default(""),
  spellcastingAbility: z.enum([...DND5E_ABILITIES, ""]).default(""),
  spells: z.array(spellSchema).max(200).default([]),
  items: z.array(inventoryItemSchema).max(200).default([]),
  currency: currencySchema.default({}),
  conditions: z.array(z.enum(DND5E_CONDITIONS)).default([]),
  exhaustionLevel: z.number().int().min(0).max(6).default(0),
  status: z.enum(["active", "dead", "retired"]).default("active"),
  statusChangedAt: z.string().nullable().default(null),
  feats: z.array(effectEntrySchema).max(50).default([]),
  // Structured features & traits (racial, class, subclass) -- same shape as `feats`, populated
  // automatically on level-up (blank bonuses, editable) and manually addable. Kept as a
  // separate array purely to mirror the physical sheet's distinct "Feats" vs "Features & Traits"
  // sections; the bonus aggregation below treats both arrays identically.
  features: z.array(effectEntrySchema).max(100).default([]),
  // Druid Wild Shape: which beast is currently assumed (empty = not transformed) plus the
  // beast form's separate HP pool, and remaining uses (2 per short/long rest).
  wildShape: z
    .object({
      beastId: z.string().max(80).default(""),
      hpCurrent: z.number().int().min(0).max(999).default(0),
      hpMax: z.number().int().min(0).max(999).default(0),
      usesAvailable: z.number().int().min(0).max(10).default(2),
    })
    .default({}),
  // Warlock: one spell per unlocked tier (6th/7th/8th/9th at levels 11/13/15/17), castable once
  // per long rest without a Pact Magic slot. Entries are added on demand as tiers unlock (see
  // unlockedArcanumTiers in class-progression.ts); `used` resets to false on a long rest.
  mysticArcanum: z
    .array(
      z.object({
        spellLevel: z.union([z.literal(6), z.literal(7), z.literal(8), z.literal(9)]),
        spellName: z.string().max(100).default(""),
        used: z.boolean().default(false),
      }),
    )
    .max(4)
    .default([]),
  // Warlock: chosen at level 3 ("Pact Boon" feature). Purely a labeled choice in v1 -- no
  // mechanical hooks (e.g. a Pact of the Blade weapon or Pact of the Chain familiar).
  pactBoon: z.enum(["", "chain", "blade", "tome"]).default(""),
});

export type Dnd5eSheetData = z.infer<typeof dnd5eSheetSchema>;

export function abilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function proficiencyBonus(level: number): number {
  return 2 + Math.floor((level - 1) / 4);
}

/** An item's equip/ability/AC bonuses apply only when equipped, and (if it requires attunement)
 * only once attuned -- so an unattuned magic item sits in inventory inert, same as unequipped. */
export function itemBonusesActive(item: Dnd5eSheetData["items"][number]): boolean {
  return item.equipped && (!item.requiresAttunement || item.attuned);
}

/** Sum of abilityBonuses from every active (equipped + attuned-if-required) item, for the given ability. */
export function equippedAbilityBonus(sheet: Dnd5eSheetData, ability: Dnd5eAbility): number {
  return sheet.items.reduce((sum, item) => (itemBonusesActive(item) ? sum + (item.abilityBonuses[ability] ?? 0) : sum), 0);
}

/** Every feat and feature/trait entry, combined -- both arrays feed the same bonus totals. */
function allEffectEntries(sheet: Dnd5eSheetData): EffectEntry[] {
  return [...sheet.feats, ...sheet.features];
}

/** Sum of abilityBonuses from every feat/feature (always active), for the given ability. */
export function featAbilityBonus(sheet: Dnd5eSheetData, ability: Dnd5eAbility): number {
  return allEffectEntries(sheet).reduce((sum, entry) => sum + (entry.abilityBonuses[ability] ?? 0), 0);
}

/** Sum of a numeric bonus field across every feat/feature, e.g. acBonus/attackBonus/spellDCBonus. */
export function featBonusTotal(
  sheet: Dnd5eSheetData,
  key: "acBonus" | "attackBonus" | "damageBonus" | "spellDCBonus" | "spellAttackBonus",
): number {
  return allEffectEntries(sheet).reduce((sum, entry) => sum + entry[key], 0);
}

/** Skill ids granted by any feat/feature (e.g. an invocation like Beguiling Influence) --
 * deduped, kept separate from sheet.skillProficiencies so removing the granting entry
 * automatically un-grants the skill instead of leaving an orphaned proficiency. */
export function effectSkillProficiencies(sheet: Dnd5eSheetData): string[] {
  return [...new Set(allEffectEntries(sheet).flatMap((entry) => entry.skillProficiencies))];
}

/** True when a skill is proficient either directly (sheet.skillProficiencies) or via a granting
 * feat/feature/invocation (effectSkillProficiencies) -- the two sources are additive. */
export function isSkillProficient(sheet: Dnd5eSheetData, skillId: string): boolean {
  return sheet.skillProficiencies.includes(skillId) || effectSkillProficiencies(sheet).includes(skillId);
}

/** Base ability score plus bonuses from every equipped item and every feat. */
export function effectiveAbilityScore(sheet: Dnd5eSheetData, ability: Dnd5eAbility): number {
  return sheet.abilities[ability] + equippedAbilityBonus(sheet, ability) + featAbilityBonus(sheet, ability);
}

/** The equipped (and attuned-if-required) body armor and shield, if any -- only one of each
 * counts toward AC, so armorPieces() picks the first found and the UI warns about the rest. */
function armorPieces(sheet: Dnd5eSheetData) {
  const active = sheet.items.filter((item) => itemBonusesActive(item) && item.armor);
  return {
    body: active.find((item) => item.armor!.category !== "shield"),
    shield: active.find((item) => item.armor!.category === "shield"),
    bodyCount: active.filter((item) => item.armor!.category !== "shield").length,
    shieldCount: active.filter((item) => item.armor!.category === "shield").length,
  };
}

/**
 * AC = equipped body armor's base + capped Dex (or 10 + Dex if no body armor equipped) + an
 * equipped shield's bonus + every active item's flat acBonus + feat acBonus. When no structured
 * armor is equipped, falls back to the manual `sheet.ac` field (unarmored defense, mage armor,
 * natural armor, etc. have no physical item to equip) plus the same item/feat bonuses -- so
 * existing characters and characters without a modeled armor item behave exactly as before.
 */
export function effectiveAC(sheet: Dnd5eSheetData): number {
  const { body, shield } = armorPieces(sheet);
  const dexMod = abilityModifier(effectiveAbilityScore(sheet, "dex"));
  const itemAcBonus = sheet.items.reduce((sum, item) => (itemBonusesActive(item) ? sum + item.acBonus : sum), 0);
  const base = body
    ? body.armor!.baseAC + (body.armor!.addDex ? Math.min(dexMod, body.armor!.maxDex ?? Infinity) : 0)
    : shield
      ? 10 + dexMod
      : sheet.ac;
  const shieldBonus = shield ? shield.armor!.baseAC : 0;
  return base + shieldBonus + itemAcBonus + featBonusTotal(sheet, "acBonus");
}

/** A human-readable AC breakdown ("Chain Shirt 13 + Dex +2 + Shield +2"), or null when no
 * structured armor is equipped (AC is just the plain manual/override number in that case). */
export function acBreakdownText(sheet: Dnd5eSheetData): string | null {
  const { body, shield } = armorPieces(sheet);
  if (!body && !shield) return null;
  const dexMod = abilityModifier(effectiveAbilityScore(sheet, "dex"));
  const parts: string[] = [];
  if (body) {
    parts.push(`${body.name || "Armor"} ${body.armor!.baseAC}`);
    if (body.armor!.addDex) parts.push(`Dex ${formatModifier(Math.min(dexMod, body.armor!.maxDex ?? Infinity))}`);
  } else {
    parts.push(`${10 + dexMod}`);
  }
  if (shield) parts.push(`${shield.name || "Shield"} +${shield.armor!.baseAC}`);
  return parts.join(" + ");
}

/** True when equipped, active body armor imposes Stealth disadvantage. */
export function hasArmorStealthDisadvantage(sheet: Dnd5eSheetData): boolean {
  return sheet.items.some(
    (item) => itemBonusesActive(item) && item.armor && item.armor.category !== "shield" && item.armor.stealthDisadvantage,
  );
}

/** Warns when more than one body armor or more than one shield is equipped -- only the first of
 * each counts toward AC (armorPieces()), so the rest are silently doing nothing. */
export function armorOverlapWarning(sheet: Dnd5eSheetData): string | null {
  const { bodyCount, shieldCount } = armorPieces(sheet);
  const parts: string[] = [];
  if (bodyCount > 1) parts.push(`${bodyCount} body armor pieces`);
  if (shieldCount > 1) parts.push(`${shieldCount} shields`);
  return parts.length > 0 ? `${parts.join(" and ")} equipped -- only one of each counts toward AC.` : null;
}

export function saveBonus(sheet: Dnd5eSheetData, ability: Dnd5eAbility): number {
  const mod = abilityModifier(effectiveAbilityScore(sheet, ability));
  return sheet.saveProficiencies.includes(ability) ? mod + proficiencyBonus(sheet.level) : mod;
}

export function skillBonus(sheet: Dnd5eSheetData, skillId: string): number {
  const skill = DND5E_SKILLS.find((s) => s.id === skillId);
  if (!skill) return 0;
  const mod = abilityModifier(effectiveAbilityScore(sheet, skill.ability));
  return isSkillProficient(sheet, skillId) ? mod + proficiencyBonus(sheet.level) : mod;
}

export function formatModifier(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

/** Attack bonus = ability modifier + proficiency bonus (always proficient) + magic bonus + feat attack bonuses. */
export function attackBonus(sheet: Dnd5eSheetData, attack: { ability: Dnd5eAbility; magicBonus: number }): number {
  return (
    abilityModifier(effectiveAbilityScore(sheet, attack.ability)) +
    proficiencyBonus(sheet.level) +
    attack.magicBonus +
    featBonusTotal(sheet, "attackBonus")
  );
}

export function passiveScore(sheet: Dnd5eSheetData, skillId: string): number {
  return 10 + skillBonus(sheet, skillId);
}

export function spellSaveDCForAbility(sheet: Dnd5eSheetData, ability: Dnd5eAbility | ""): number | null {
  if (!ability) return null;
  return (
    8 + proficiencyBonus(sheet.level) + abilityModifier(effectiveAbilityScore(sheet, ability)) + featBonusTotal(sheet, "spellDCBonus")
  );
}

export function spellAttackBonusForAbility(sheet: Dnd5eSheetData, ability: Dnd5eAbility | ""): number | null {
  if (!ability) return null;
  return (
    proficiencyBonus(sheet.level) + abilityModifier(effectiveAbilityScore(sheet, ability)) + featBonusTotal(sheet, "spellAttackBonus")
  );
}

export function spellSaveDC(sheet: Dnd5eSheetData): number | null {
  return spellSaveDCForAbility(sheet, sheet.spellcastingAbility);
}

export function spellAttackBonus(sheet: Dnd5eSheetData): number | null {
  return spellAttackBonusForAbility(sheet, sheet.spellcastingAbility);
}

/**
 * Max HP per RAW: sum of hit die rolls/averages (CON excluded) plus level × current CON
 * modifier -- recalculated fresh from the current CON mod, so it's always correct even
 * after CON changes retroactively (ASI, equipped item, feature), unlike a running total
 * that bakes in whatever CON mod happened to apply at each individual level-up.
 */
export function computeHpMax(sheet: Dnd5eSheetData): number {
  const diceSum = sheet.hpDiceHistory.reduce((sum, v) => sum + v, 0);
  return diceSum + sheet.level * abilityModifier(effectiveAbilityScore(sheet, "con"));
}

export function totalInventoryWeight(sheet: Dnd5eSheetData): number {
  return sheet.items.reduce((sum, item) => sum + item.quantity * item.weight, 0);
}

type Currency = z.infer<typeof currencySchema>;

/** Total wealth in copper pieces (1cp=1, 1sp=10, 1ep=50, 1gp=100, 1pp=1000). */
export function currencyToCopper(currency: Currency): number {
  return currency.pp * 1000 + currency.gp * 100 + currency.ep * 50 + currency.sp * 10 + currency.cp;
}

/** Re-normalizes a copper total into denominations, greedy largest-first (like making change). */
export function copperToCurrency(totalCopper: number): Currency {
  let remaining = Math.max(0, Math.round(totalCopper));
  const pp = Math.floor(remaining / 1000);
  remaining -= pp * 1000;
  const gp = Math.floor(remaining / 100);
  remaining -= gp * 100;
  const ep = Math.floor(remaining / 50);
  remaining -= ep * 50;
  const sp = Math.floor(remaining / 10);
  remaining -= sp * 10;
  return { pp, gp, ep, sp, cp: remaining };
}

/** True for non-5e systems (no status concept) and 5e characters with status "active". */
export function characterIsActive(character: { system: string; sheetData: unknown }): boolean {
  if (character.system !== "dnd5e") return true;
  const status = (character.sheetData as Partial<Dnd5eSheetData> | null)?.status;
  return status === undefined || status === "active";
}

export const DND5E_CONDITION_LABELS: Record<Dnd5eCondition, string> = {
  blinded: "Blinded",
  charmed: "Charmed",
  deafened: "Deafened",
  frightened: "Frightened",
  grappled: "Grappled",
  incapacitated: "Incapacitated",
  invisible: "Invisible",
  paralyzed: "Paralyzed",
  petrified: "Petrified",
  poisoned: "Poisoned",
  prone: "Prone",
  restrained: "Restrained",
  stunned: "Stunned",
  unconscious: "Unconscious",
};

/** Condition tags as shown on the initiative tracker combatant row. */
export function conditionTags(sheet: Dnd5eSheetData): string[] {
  const tags = sheet.conditions.map((c) => DND5E_CONDITION_LABELS[c]);
  if (sheet.exhaustionLevel > 0) tags.push(`Exhaustion ${sheet.exhaustionLevel}`);
  return tags;
}

export const DND5E_STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

// PHB point-buy cost per score (27-point budget, scores 8-15)
export const DND5E_POINT_BUY_COSTS: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};
export const DND5E_POINT_BUY_BUDGET = 27;

export function pointBuyTotal(abilities: Record<Dnd5eAbility, number>): number {
  return DND5E_ABILITIES.reduce((sum, a) => sum + (DND5E_POINT_BUY_COSTS[abilities[a]] ?? 0), 0);
}

export function classHitDie(className: string): number | null {
  const cls = DND5E_CLASSES.find((c) => c.name.toLowerCase() === className.trim().toLowerCase());
  return cls?.hitDie ?? null;
}

export function emptyDnd5eSheet(): Dnd5eSheetData {
  return dnd5eSheetSchema.parse({ abilities: {} });
}

export const dnd5eSystem = {
  id: "dnd5e" as const,
  name: "D&D 5e",
  schema: dnd5eSheetSchema,
  emptySheet: emptyDnd5eSheet,
};
