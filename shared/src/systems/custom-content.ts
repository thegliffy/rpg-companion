import { z } from "zod";
import { DND5E_ABILITIES } from "./dnd5e.js";
import type { ClassLevelEntry, CasterType } from "./class-progression.js";
import type { SrdSpell } from "./srd-spells.js";
import type { SrdMonster } from "./srd-monsters.js";
import type { CustomContentType, CustomContentSystem, CustomContent } from "../types.js";

export const customRaceDataSchema = z.object({
  abilityBonuses: z.record(z.enum(DND5E_ABILITIES), z.number().int().min(-4).max(4)).default({}),
  speed: z.number().int().min(0).max(200).default(30),
  size: z.string().trim().max(20).default("Medium"),
  languages: z.array(z.string().trim().max(40)).max(20).default([]),
  traits: z.array(z.string().trim().max(60)).max(20).default([]),
});
export type CustomRaceData = z.infer<typeof customRaceDataSchema>;

// Mirrors the SRD MartialLevelEntry fields exactly (class-progression.ts), so a homebrew
// class's martial features (rage, martial arts dice, sneak attack, etc.) render through the
// same martialFeatureLines() display as a built-in class.
const martialLevelEntrySchema = z.object({
  level: z.number().int().min(1).max(20),
  extraAttacks: z.number().int().min(0).max(3).optional(),
  actionSurges: z.number().int().min(0).max(3).optional(),
  indomitableUses: z.number().int().min(0).max(3).optional(),
  rageCount: z.number().int().min(-1).max(10).optional(),
  rageDamageBonus: z.number().int().min(0).max(10).optional(),
  brutalCriticalDice: z.number().int().min(0).max(5).optional(),
  sneakAttack: z.object({ diceCount: z.number().int().min(0).max(20), diceValue: z.number().int().min(4).max(12) }).optional(),
  martialArts: z.object({ diceCount: z.number().int().min(0).max(20), diceValue: z.number().int().min(4).max(12) }).optional(),
  kiPoints: z.number().int().min(0).max(20).optional(),
  unarmoredMovement: z.number().int().min(0).max(60).optional(),
  auraRange: z.number().int().min(0).max(120).optional(),
  favoredEnemies: z.number().int().min(0).max(5).optional(),
  favoredTerrain: z.number().int().min(0).max(5).optional(),
});

const classLevelEntrySchema = z.object({
  level: z.number().int().min(1).max(20),
  cantripsKnown: z.number().int().min(0).max(20).optional(),
  spellsKnown: z.number().int().min(0).max(40).optional(),
  slots: z.record(z.string(), z.number().int().min(0).max(20)).optional(),
  features: z.array(z.string().trim().max(60)).max(10).optional(),
  martial: martialLevelEntrySchema.optional(),
});

export const customClassDataSchema = z.object({
  hitDie: z.number().int().refine((v) => [6, 8, 10, 12].includes(v), { message: "Hit die must be 6, 8, 10, or 12" }),
  casterType: z.enum(["none", "prepared", "known", "pact"]).default("none"),
  levels: z.array(classLevelEntrySchema).max(20).default([]),
});
export type CustomClassData = z.infer<typeof customClassDataSchema>;

export const customBackgroundDataSchema = z.object({
  skillProficiencies: z.array(z.string().trim().max(40)).max(2).default([]),
  feature: z.string().trim().max(60).default(""),
  toolProficiencies: z.array(z.string().trim().max(40)).max(10).default([]),
  equipmentText: z.string().trim().max(300).default(""),
});
export type CustomBackgroundData = z.infer<typeof customBackgroundDataSchema>;

export const customSubraceDataSchema = z.object({
  parentRace: z.string().trim().max(60).default(""),
  abilityBonuses: z.record(z.enum(DND5E_ABILITIES), z.number().int().min(-4).max(4)).default({}),
  // Optional speed override; 0/unset means "inherit parent race's speed".
  speed: z.number().int().min(0).max(200).default(0),
  traits: z.array(z.string().trim().max(60)).max(20).default([]),
});
export type CustomSubraceData = z.infer<typeof customSubraceDataSchema>;

export const customSubclassDataSchema = z.object({
  parentClass: z.string().trim().max(60).default(""),
  levels: z.array(classLevelEntrySchema).max(20).default([]),
});
export type CustomSubclassData = z.infer<typeof customSubclassDataSchema>;

// Structured effect bonuses shared by feats (and, later, #45's features). All manually
// entered; summed into the sheet's derived ability/AC/attack/spell values when active.
export const effectBonusesSchema = z.object({
  abilityBonuses: z.record(z.enum(DND5E_ABILITIES), z.number().int().min(-10).max(10)).default({}),
  acBonus: z.number().int().min(-10).max(10).default(0),
  attackBonus: z.number().int().min(-10).max(10).default(0),
  damageBonus: z.number().int().min(-10).max(10).default(0),
  spellDCBonus: z.number().int().min(-10).max(10).default(0),
  spellAttackBonus: z.number().int().min(-10).max(10).default(0),
});
export type EffectBonuses = z.infer<typeof effectBonusesSchema>;

export const customFeatDataSchema = effectBonusesSchema.extend({
  description: z.string().trim().max(500).default(""),
});
export type CustomFeatData = z.infer<typeof customFeatDataSchema>;

// Mirrors the SRD SrdSpell field set exactly (srd-spells.ts) -- name/level come from the
// custom-content row's own name/nothing-special-needed level field, so this schema keeps
// `level` too (spells need it outside a class-progression context) plus every mechanical field.
export const customSpellDataSchema = z.object({
  level: z.number().int().min(0).max(9),
  school: z.string().trim().max(30).default(""),
  castingTime: z.string().trim().max(60).default(""),
  range: z.string().trim().max(60).default(""),
  duration: z.string().trim().max(60).default(""),
  requiresAttackRoll: z.boolean().default(false),
  saveAbility: z.enum(DND5E_ABILITIES).optional(),
  damageDice: z.string().trim().max(30).optional(),
  damageType: z.string().trim().max(30).optional(),
  ritual: z.boolean().default(false),
  // SRD class ids (lowercase) that can cast this spell -- same convention as SrdSpell.classes.
  classes: z.array(z.string().trim().toLowerCase().max(30)).max(12).default([]),
});
export type CustomSpellData = z.infer<typeof customSpellDataSchema>;

/** Maps a "spell"-type custom-content row onto the SrdSpell shape, id-prefixed to avoid
 * colliding with real SRD spell ids -- lets every SRD-spell-keyed lookup (cast control,
 * ritual check, class filtering) treat an approved custom spell identically to an SRD one. */
export function customSpellToSrdShape(item: CustomContent): SrdSpell {
  const d = item.data as CustomSpellData;
  return {
    id: `custom-${item.id}`,
    name: item.name,
    level: d.level,
    school: d.school,
    castingTime: d.castingTime,
    range: d.range,
    duration: d.duration,
    requiresAttackRoll: d.requiresAttackRoll,
    saveAbility: d.saveAbility,
    damageDice: d.damageDice,
    damageType: d.damageType,
    ritual: d.ritual,
    classes: d.classes,
  };
}

// Spans the SRD weapon/armor/gear/magic-item shape via a `kind` discriminator, plus the same
// structured effect bonuses an equipped item already applies (#34) -- so a homebrew +1 sword or
// bespoke armor drives AC/attack/damage exactly like an SRD item, which plain SRD gear/weapons
// (no bonuses) and SRD magic items (name/category/rarity only, no mechanical stats) cannot.
export const customItemDataSchema = z.object({
  kind: z.enum(["weapon", "armor", "gear", "magic"]),
  weight: z.number().min(0).max(9999).default(0),
  // Sell value in gp -- same unit as the sheet's InventoryItem.value, used by the campaign shop.
  value: z.number().min(0).max(999999).default(0),
  // Weapon fields
  damageDice: z.string().trim().max(30).default(""),
  damageType: z.string().trim().max(30).default(""),
  properties: z.array(z.string().trim().max(40)).max(10).default([]),
  // Armor fields
  baseAC: z.number().int().min(0).max(30).default(0),
  dexBonus: z.boolean().default(false),
  maxDexBonus: z.number().int().min(0).max(10).optional(),
  stealthDisadvantage: z.boolean().default(false),
  // Magic item reference fields (informational, like SrdMagicItem)
  category: z.string().trim().max(30).default(""),
  rarity: z.string().trim().max(30).default(""),
  // Effect bonuses applied to the inventory entry when picked (mirrors equipped-item bonuses).
  abilityBonuses: z.record(z.enum(DND5E_ABILITIES), z.number().int().min(-10).max(10)).default({}),
  acBonus: z.number().int().min(-10).max(10).default(0),
});
export type CustomItemData = z.infer<typeof customItemDataSchema>;

/** Human-readable mechanical notes for a custom item, matching weaponDamageText/
 * armorACFormulaText's format so a custom item's inventory notes read identically to an SRD one. */
export function customItemNotesText(item: CustomContent): string {
  const d = item.data as CustomItemData;
  if (d.kind === "weapon") {
    return d.damageDice ? `${d.damageDice} ${d.damageType.toLowerCase()}` : "";
  }
  if (d.kind === "armor") {
    if (!d.dexBonus) return `Base AC ${d.baseAC} (no Dex bonus)`;
    if (d.maxDexBonus !== undefined) return `Base AC ${d.baseAC} + Dex modifier (max ${d.maxDexBonus})`;
    return `Base AC ${d.baseAC} + Dex modifier`;
  }
  return "";
}

const monsterActionSchema = z.object({
  name: z.string().trim().max(60),
  desc: z.string().trim().max(500).default(""),
  attackBonus: z.number().int().min(-5).max(20).optional(),
  damageDice: z.string().trim().max(30).optional(),
  damageType: z.string().trim().max(30).optional(),
});

const monsterSpecialAbilitySchema = z.object({
  name: z.string().trim().max(60),
  desc: z.string().trim().max(500).default(""),
});

// Mirrors the Bestiary's SrdMonster field set exactly (srd-monsters.ts) -- so a homebrew
// monster shows in the Bestiary and fights in the Arena identically to an SRD one.
export const customMonsterDataSchema = z.object({
  size: z.string().trim().max(20).default("Medium"),
  type: z.string().trim().max(30).default("beast"),
  alignment: z.string().trim().max(40).default("unaligned"),
  cr: z.number().min(0).max(30),
  xp: z.number().int().min(0).max(999999).default(0),
  ac: z.number().int().min(0).max(30).default(10),
  hp: z.number().int().min(1).max(9999),
  hitDice: z.string().trim().max(20).default(""),
  speed: z.object({
    walk: z.number().int().min(0).max(200).optional(),
    fly: z.number().int().min(0).max(200).optional(),
    swim: z.number().int().min(0).max(200).optional(),
    climb: z.number().int().min(0).max(200).optional(),
    burrow: z.number().int().min(0).max(200).optional(),
  }).default({}),
  str: z.number().int().min(1).max(30),
  dex: z.number().int().min(1).max(30),
  con: z.number().int().min(1).max(30),
  int: z.number().int().min(1).max(30),
  wis: z.number().int().min(1).max(30),
  cha: z.number().int().min(1).max(30),
  passivePerception: z.number().int().min(0).max(30).default(10),
  languages: z.string().trim().max(200).default(""),
  damageVulnerabilities: z.array(z.string().trim().max(30)).max(10).default([]),
  damageResistances: z.array(z.string().trim().max(30)).max(10).default([]),
  damageImmunities: z.array(z.string().trim().max(30)).max(10).default([]),
  conditionImmunities: z.array(z.string().trim().max(30)).max(15).default([]),
  specialAbilities: z.array(monsterSpecialAbilitySchema).max(10).default([]),
  actions: z.array(monsterActionSchema).max(10).default([]),
});
export type CustomMonsterData = z.infer<typeof customMonsterDataSchema>;

/** Maps a "monster"-type custom-content row onto the SrdMonster shape, id-prefixed to avoid
 * colliding with real SRD monster ids -- lets the Bestiary and Arena treat an approved custom
 * monster identically to an SRD one. */
export function customMonsterToSrdShape(item: CustomContent): SrdMonster {
  const d = item.data as CustomMonsterData;
  return {
    id: `custom-${item.id}`,
    name: item.name,
    size: d.size,
    type: d.type,
    alignment: d.alignment,
    cr: d.cr,
    xp: d.xp,
    ac: d.ac,
    hp: d.hp,
    hitDice: d.hitDice,
    speed: d.speed,
    str: d.str,
    dex: d.dex,
    con: d.con,
    int: d.int,
    wis: d.wis,
    cha: d.cha,
    senses: { passivePerception: d.passivePerception },
    languages: d.languages,
    damageVulnerabilities: d.damageVulnerabilities,
    damageResistances: d.damageResistances,
    damageImmunities: d.damageImmunities,
    conditionImmunities: d.conditionImmunities,
    specialAbilities: d.specialAbilities,
    actions: d.actions,
  };
}

export const createCustomContentSchema = z.object({
  type: z.enum(["race", "class", "background", "subrace", "subclass", "feat", "spell", "item", "monster"]),
  system: z.enum(["generic", "dnd5e", "pf2e"]).default("dnd5e"),
  name: z.string().trim().min(1).max(60),
  data: z.unknown(),
});

// Which custom-content types are meaningful for each game system. PF2e/generic have no
// custom-content types yet (their sheets don't have the SRD-backed pickers 5e does) -- the
// manager UI uses this to show only the types that apply to the selected system.
export const CUSTOM_CONTENT_TYPES_BY_SYSTEM: Record<CustomContentSystem, CustomContentType[]> = {
  dnd5e: ["race", "subrace", "class", "subclass", "background", "feat", "spell", "item", "monster"],
  pf2e: [],
  generic: [],
};

export const updateCustomContentSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  data: z.unknown().optional(),
});

/** Finds the highest-level entry at or below `level`, same lookup rule as built-in classes. */
export function customClassLevelEntry(levels: ClassLevelEntry[], level: number): ClassLevelEntry | null {
  let best: ClassLevelEntry | null = null;
  for (const e of levels) {
    if (e.level <= level) best = e;
  }
  if (!best) return null;

  // Martial features (rage count, martial-arts dice, sneak attack, etc.) carry forward
  // independently of whichever row is the closest overall match -- mirrors how SRD classes
  // look up martial progression from a separate per-level table (martialLevelEntry in
  // class-progression.ts), so a homebrew class doesn't need to repeat unchanged martial values
  // on every level row, only the ones where something changes.
  let martial: ClassLevelEntry["martial"];
  for (const e of levels) {
    if (e.level <= level && e.martial) martial = e.martial;
  }
  return martial ? { ...best, martial } : best;
}

export type { ClassLevelEntry, CasterType };
