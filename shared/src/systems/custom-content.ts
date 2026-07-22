import { z } from "zod";
import { DND5E_ABILITIES, DND5E_ABILITY_NAMES, DND5E_SKILLS } from "./dnd5e.js";
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

// A skill grant can come from a fixed choice ("choose from this exact list"), an ability-group
// choice ("one Int/Wis/Cha skill of your choice"), or a fully open choice ("any skill").
const skillChoiceSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("list"), skillIds: z.array(z.string().trim().max(40)).max(18) }),
  z.object({ kind: z.literal("ability"), abilities: z.array(z.enum(DND5E_ABILITIES)).min(1).max(6) }),
  z.object({ kind: z.literal("any") }),
]);

const skillChoiceSchema = z.object({
  count: z.number().int().min(1).max(18),
  from: skillChoiceSourceSchema,
});

const toolChoiceSchema = z.object({
  count: z.number().int().min(1).max(10),
  from: z.array(z.string().trim().max(40)).max(20),
});

const backgroundVariantSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().max(60),
  description: z.string().trim().max(500).default(""),
});

const rawCustomBackgroundDataSchema = z.object({
  skills: z
    .object({
      fixed: z.array(z.string().trim().max(40)).max(18).default([]),
      choices: z.array(skillChoiceSchema).max(5).default([]),
    })
    .default({}),
  tools: z
    .object({
      fixed: z.array(z.string().trim().max(40)).max(20).default([]),
      choices: z.array(toolChoiceSchema).max(5).default([]),
    })
    .default({}),
  // "Two of your choice" = anyCount: 2. `fixed` covers a background that also grants a
  // specific language outright (rare, but some SRD-adjacent backgrounds do this).
  languages: z
    .object({
      fixed: z.array(z.string().trim().max(40)).max(10).default([]),
      anyCount: z.number().int().min(0).max(10).default(0),
    })
    .default({}),
  equipment: z
    .object({
      items: z.array(z.string().trim().max(100)).max(20).default([]),
      gold: z.number().min(0).max(9999).default(0),
    })
    .default({}),
  feature: z
    .object({
      name: z.string().trim().max(60).default(""),
      description: z.string().trim().max(500).default(""),
    })
    .default({}),
  // "Lore boxes" -- a pick-one (or pick-N) set of themed flavor variants, e.g. which faction/
  // origin/god the background attaches to. v1 is flavor-only (title + description); a per-variant
  // mechanical tweak is a natural future extension once a concrete need shows up.
  variants: z.array(backgroundVariantSchema).max(20).default([]),
  variantPickCount: z.number().int().min(0).max(5).default(1),
});

// Upgrades the legacy flat shape ({skillProficiencies, feature, toolProficiencies, equipmentText}
// -- what every background created before this structured redesign has stored) into the new
// fixed+choice shape, so old custom-content rows keep parsing without a data migration (the JSON
// blob in custom_content.data never changes; only how we read it does).
export const customBackgroundDataSchema = z.preprocess((raw) => {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const isLegacy =
    !("skills" in input) &&
    ("skillProficiencies" in input || "feature" in input || "toolProficiencies" in input || "equipmentText" in input);
  if (!isLegacy) return input;

  const legacy = input as {
    skillProficiencies?: string[];
    feature?: string;
    toolProficiencies?: string[];
    equipmentText?: string;
  };
  return {
    skills: { fixed: legacy.skillProficiencies ?? [], choices: [] },
    tools: { fixed: legacy.toolProficiencies ?? [], choices: [] },
    languages: { fixed: [], anyCount: 0 },
    equipment: { items: legacy.equipmentText ? [legacy.equipmentText] : [], gold: 0 },
    feature: { name: legacy.feature ?? "", description: "" },
    variants: [],
    variantPickCount: 1,
  };
}, rawCustomBackgroundDataSchema);
export type CustomBackgroundData = z.infer<typeof customBackgroundDataSchema>;
export type BackgroundSkillChoice = z.infer<typeof skillChoiceSchema>;
export type BackgroundToolChoice = z.infer<typeof toolChoiceSchema>;
export type BackgroundVariant = z.infer<typeof backgroundVariantSchema>;

const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** "a, b, and c" -- Oxford-comma English list join, "None" when empty. */
function joinEnglish(parts: string[], conjunction: "and" | "or" = "and"): string {
  if (parts.length === 0) return "None";
  if (parts.length === 1) return parts[0];
  if (parts.length === 2) return `${parts[0]} ${conjunction} ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, ${conjunction} ${parts[parts.length - 1]}`;
}

function skillLabel(id: string): string {
  return DND5E_SKILLS.find((s) => s.id === id)?.name ?? id;
}

/**
 * Renders a background's structured grants as PHB-style lines ("Skill Proficiencies: Insight
 * and one Intelligence, Wisdom, or Charisma skill of your choice", etc.) -- shared by the
 * custom-content manager's live preview and any read-only display (character sheet, wizard)
 * so the two never drift out of sync.
 */
export function formatBackgroundGrants(data: CustomBackgroundData): {
  skills: string;
  tools: string;
  languages: string;
  equipment: string;
  featureName: string;
  featureDescription: string;
  variants: BackgroundVariant[];
  variantPickCount: number;
} {
  const skillParts = data.skills.fixed.map(skillLabel);
  for (const choice of data.skills.choices) {
    const n = numberWord(choice.count);
    if (choice.from.kind === "list") {
      skillParts.push(`${n} of ${choice.from.skillIds.map(skillLabel).join(", ")} of your choice`);
    } else if (choice.from.kind === "ability") {
      const abilities = joinEnglish(choice.from.abilities.map((a) => DND5E_ABILITY_NAMES[a]), "or");
      skillParts.push(`${n} ${abilities} skill${choice.count > 1 ? "s" : ""} of your choice`);
    } else {
      skillParts.push(`${n} skill${choice.count > 1 ? "s" : ""} of your choice`);
    }
  }

  const toolParts = [...data.tools.fixed];
  for (const choice of data.tools.choices) {
    toolParts.push(`${numberWord(choice.count)} of ${choice.from.join(", ")} of your choice`);
  }

  const langParts = [...data.languages.fixed];
  if (data.languages.anyCount > 0) {
    const n = numberWord(data.languages.anyCount);
    langParts.push(`${n.charAt(0).toUpperCase()}${n.slice(1)} of your choice`);
  }

  const equipParts = [...data.equipment.items];
  if (data.equipment.gold > 0) equipParts.push(`a pouch containing ${data.equipment.gold} gp`);

  return {
    skills: joinEnglish(skillParts),
    tools: joinEnglish(toolParts),
    languages: joinEnglish(langParts),
    equipment: joinEnglish(equipParts),
    featureName: data.feature.name,
    featureDescription: data.feature.description,
    variants: data.variants,
    variantPickCount: data.variantPickCount,
  };
}

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
