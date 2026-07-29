import { z } from "zod";
import { DND5E_ABILITIES, DND5E_ABILITY_NAMES, DND5E_SKILLS, buffEffectSchema, hasBuffEffect } from "./dnd5e.js";
import type { ClassLevelEntry, CasterType, MartialResourcePool } from "./class-progression.js";
import type { BuffEffect } from "./dnd5e.js";
import type { SrdSpell } from "./srd-spells.js";
import { SRD_SPELL_EFFECTS } from "./srd-spell-effects.js";
import { SRD_SPELL_SCALING } from "./srd-spell-scaling.js";
import type { SpellScaling } from "./srd-spell-scaling.js";
import type { SrdMonster } from "./srd-monsters.js";
import { SRD_FEATS } from "./srd-feats.js";
import type { CustomContentType, CustomContentSystem, CustomContent } from "../types.js";
import { newEntityId } from "../id.js";

// Structured effect bonuses shared by feats and background features (#100). All manually
// entered; summed into the sheet's derived ability/AC/attack/spell values when active. Defined
// early since both customFeatDataSchema and the background feature schema below extend it.
export const effectBonusesSchema = z.object({
  abilityBonuses: z.record(z.enum(DND5E_ABILITIES), z.number().int().min(-10).max(10)).default({}),
  acBonus: z.number().int().min(-10).max(10).default(0),
  attackBonus: z.number().int().min(-10).max(10).default(0),
  damageBonus: z.number().int().min(-10).max(10).default(0),
  spellDCBonus: z.number().int().min(-10).max(10).default(0),
  spellAttackBonus: z.number().int().min(-10).max(10).default(0),
});
export type EffectBonuses = z.infer<typeof effectBonusesSchema>;

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

// A limited-use resource (#105, generalized to classes in #127) -- e.g. Hexblade's Curse 1/short
// rest, or an Artificer's infusions. `uses` is a fixed int on purpose: it covers the benchmark
// case exactly, and proficiency-bonus/ability-mod scaling is a later extension rather than
// speculative generality now. Named generically since #127 lifted this from subclass-only to
// also cover customClassDataSchema -- a homebrew resource belongs wherever its owner (class or
// subclass) is authored, same shape either way.
const homebrewResourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().max(40),
  level: z.number().int().min(1).max(20).default(1),
  uses: z.number().int().min(1).max(20).default(1),
  recharge: z.enum(["short", "long"]).default("long"),
  note: z.string().trim().max(80).default(""),
});
// Kept as "SubclassResource" (rather than renamed) since it's the established public name and
// every existing call site/import uses it -- ClassResource is a same-shape alias for clarity at
// the class-side call sites #127 adds.
export type SubclassResource = z.infer<typeof homebrewResourceSchema>;
export type ClassResource = SubclassResource;

export const customClassDataSchema = z.object({
  hitDie: z.number().int().refine((v) => [6, 8, 10, 12].includes(v), { message: "Hit die must be 6, 8, 10, or 12" }),
  casterType: z.enum(["none", "prepared", "known", "pact"]).default("none"),
  levels: z.array(classLevelEntrySchema).max(20).default([]),
  // Limited-use resources this class grants (#127) -- e.g. an Artificer's infusions or a Blood
  // Hunter's hemocraft die. Same shape and rest-handling as a subclass's resources (#105); the
  // asymmetry where only a subclass could carry one was never intentional.
  resources: z.array(homebrewResourceSchema).max(10).default([]),
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

// A background feature (#100) -- some SRD-parity backgrounds grant more than one distinct
// feature, so this is a repeatable array rather than the single {name, description} pair it
// used to be. Carries the same effect-bonus row a feat does, so a homebrew feature can grant a
// real mechanical bonus, not just reference text.
const backgroundFeatureSchema = effectBonusesSchema.extend({
  id: z.string().min(1),
  name: z.string().trim().max(60),
  description: z.string().trim().max(500).default(""),
});
export type BackgroundFeature = z.infer<typeof backgroundFeatureSchema>;

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
  // #100: repeatable so a background can grant more than one distinct feature, each with its own
  // effect bonuses -- was a single {name, description} pair (see the preprocess migration below).
  features: z.array(backgroundFeatureSchema).max(5).default([]),
  // "Lore boxes" -- a pick-one (or pick-N) set of themed flavor variants, e.g. which faction/
  // origin/god the background attaches to. v1 is flavor-only (title + description); a per-variant
  // mechanical tweak is a natural future extension once a concrete need shows up.
  variants: z.array(backgroundVariantSchema).max(20).default([]),
  variantPickCount: z.number().int().min(0).max(5).default(1),
  // Feats this background grants outright at character creation (#126) -- e.g. a homebrew
  // background paired with a homebrew bonus feat. References are an SRD feat id or `custom-${id}`,
  // the same SRD-then-custom convention #109 established for spell references, resolved via
  // resolveGrantedFeat() below. Deliberately just a fixed grant, not a picker: a feat with its own
  // spellChoices rows (#102) has those left unresolved when granted this way, since the character
  // creation wizard has no multi-step picker to resolve them through.
  grantedFeats: z.array(z.string().trim().max(100)).max(5).default([]),
});

/** A legacy or pre-#100 singular {name, description} feature, upgraded into a one-element
 * features[] array; blank name upgrades to an empty array (nothing to migrate). */
function upgradeSingularFeature(feature: { name?: string; description?: string } | undefined): unknown[] {
  const name = feature?.name?.trim();
  if (!name) return [];
  return [
    {
      id: newEntityId("bg-feature-migrated"),
      name,
      description: feature?.description ?? "",
      abilityBonuses: {},
      acBonus: 0,
      attackBonus: 0,
      damageBonus: 0,
      spellDCBonus: 0,
      spellAttackBonus: 0,
    },
  ];
}

// Upgrades two prior shapes into the current one, so old custom-content rows keep parsing
// without a data migration (the JSON blob in custom_content.data never changes; only how we
// read it does):
//   1. The legacy flat shape ({skillProficiencies, feature: string, toolProficiencies,
//      equipmentText}) -- what every background created before the structured redesign stored.
//   2. The structured-but-pre-#100 shape (singular `feature: {name, description}` instead of
//      `features: [...]`) -- what every background created between the structured redesign and
//      #100 stored, including the SRD Acolyte background synthesized on the fly by the wizard.
export const customBackgroundDataSchema = z.preprocess((raw) => {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const isLegacyFlat =
    !("skills" in input) &&
    ("skillProficiencies" in input || "feature" in input || "toolProficiencies" in input || "equipmentText" in input);
  if (isLegacyFlat) {
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
      features: upgradeSingularFeature(legacy.feature ? { name: legacy.feature } : undefined),
      variants: [],
      variantPickCount: 1,
    };
  }

  if ("feature" in input && !("features" in input)) {
    const { feature, ...rest } = input as { feature?: { name?: string; description?: string } };
    return { ...rest, features: upgradeSingularFeature(feature) };
  }

  return input;
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
  features: BackgroundFeature[];
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
    features: data.features,
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

// A subclass feature with real rules text and mechanics (#103). Deliberately a parallel array
// rather than widening classLevelEntrySchema.features, which is `string[]` and shared with
// customClassDataSchema *and* the SRD ClassLevelEntry type -- legacy name-only entries keep
// working and are merged in by subclassFeaturesAt() below.
const subclassFeatureSchema = effectBonusesSchema.extend({
  id: z.string().min(1),
  level: z.number().int().min(1).max(20),
  name: z.string().trim().max(60),
  description: z.string().trim().max(1000).default(""),
  // Aggregated through effectSkillProficiencies (dnd5e.ts), same as a feat's.
  skillProficiencies: z.array(z.string().trim().max(40)).max(18).default([]),
  // Armor/weapon/tool proficiency is cosmetic in this app -- nothing computes off
  // proficienciesText -- so these are appended to that free-text field on level-up.
  armorProficiencies: z.array(z.string().trim().max(40)).max(10).default([]),
  weaponProficiencies: z.array(z.string().trim().max(40)).max(10).default([]),
  toolProficiencies: z.array(z.string().trim().max(40)).max(10).default([]),
});
export type SubclassFeature = z.infer<typeof subclassFeatureSchema>;

// A spell a subclass touches (#104). "list" widens what the spell pickers offer (a Warlock
// expanded spell list -- options, not handouts); "granted" pushes it straight onto the sheet
// (domain-style always-prepared spells), tagged so it can be cleaned up again.
const subclassSpellSchema = z.object({
  id: z.string().min(1),
  level: z.number().int().min(1).max(20),
  srdId: z.string().trim().max(80).default(""),
  name: z.string().trim().max(100),
  spellLevel: z.number().int().min(0).max(9).default(0),
  mode: z.enum(["list", "granted"]).default("list"),
  atWill: z.boolean().default(false),
});
export type SubclassSpell = z.infer<typeof subclassSpellSchema>;

export const customSubclassDataSchema = z.object({
  parentClass: z.string().trim().max(60).default(""),
  levels: z.array(classLevelEntrySchema).max(20).default([]),
  features: z.array(subclassFeatureSchema).max(30).default([]),
  spells: z.array(subclassSpellSchema).max(30).default([]),
  resources: z.array(homebrewResourceSchema).max(10).default([]),
});
export type CustomSubclassData = z.infer<typeof customSubclassDataSchema>;

/** A name-only subclass feature (SRD data, or a pre-#103 custom subclass) as a rich entry with
 * no mechanics -- exactly what level-up used to build inline. */
export function blankSubclassFeature(name: string, level: number): SubclassFeature {
  return {
    id: newEntityId("subclass-feature-legacy"),
    level,
    name,
    description: "",
    abilityBonuses: {},
    acBonus: 0,
    attackBonus: 0,
    damageBonus: 0,
    spellDCBonus: 0,
    spellAttackBonus: 0,
    skillProficiencies: [],
    armorProficiencies: [],
    weaponProficiencies: [],
    toolProficiencies: [],
  };
}

/** Subclass features granted at exactly `level`, merging the rich #103 array with legacy
 * name-only `levels[].features` entries (SRD subclasses, and custom ones authored before #103).
 * A legacy name already covered by a rich entry is dropped so re-authoring doesn't double up. */
export function subclassFeaturesAt(
  levels: { level: number; features?: string[] }[],
  richFeatures: SubclassFeature[],
  level: number,
): SubclassFeature[] {
  const rich = richFeatures.filter((f) => f.level === level);
  const covered = new Set(rich.map((f) => f.name.trim().toLowerCase()));
  const legacy = (levels.find((e) => e.level === level)?.features ?? [])
    .filter((name) => !covered.has(name.trim().toLowerCase()))
    .map((name) => blankSubclassFeature(name, level));
  return [...rich, ...legacy];
}

/** Every subclass spell unlocked at or below `level`. `mode` splits them: "list" widens the
 * spell pickers, "granted" is pushed onto the sheet. */
export function subclassSpellsUpTo(spells: SubclassSpell[], level: number, mode: "list" | "granted"): SubclassSpell[] {
  return spells.filter((s) => s.level <= level && s.mode === mode);
}

/** Resources unlocked at or below `level`. */
export function subclassResourcesUpTo(resources: SubclassResource[], level: number): SubclassResource[] {
  return resources.filter((r) => r.level <= level);
}

/** Prefixes for homebrew-contributed martialUsed keys -- namespaced per source so a class
 * resource, a subclass resource, and the base-class "rage"/"ki"/etc. pools they sit alongside
 * can never collide even if two happen to share an id. */
export const SUBCLASS_RESOURCE_PREFIX = "subclass:";
export const CLASS_RESOURCE_PREFIX = "class:";

/** Maps a homebrew resource list onto the same MartialResourcePool shape the sheet already
 * renders and rests already reset (#105). Because longRest/shortRest clear via
 * martialResetKeys(pools, restType), pools returned here need no separate rest handling. */
function homebrewResourcePools(resources: SubclassResource[], level: number, prefix: string): MartialResourcePool[] {
  return subclassResourcesUpTo(resources, level).map((r) => ({
    key: `${prefix}${r.id}`,
    label: r.name,
    max: r.uses,
    resetOn: r.recharge,
    note: r.note || undefined,
  }));
}

export function subclassResourcePools(resources: SubclassResource[], level: number): MartialResourcePool[] {
  return homebrewResourcePools(resources, level, SUBCLASS_RESOURCE_PREFIX);
}

/** Same as subclassResourcePools, for a homebrew *class*'s own resources (#127) -- e.g. an
 * Artificer's infusions, tracked the same way a subclass's Hexblade's Curse is. Distinct prefix
 * so a class and its subclass can each define a same-named/same-id resource without colliding. */
export function classResourcePools(resources: ClassResource[], level: number): MartialResourcePool[] {
  return homebrewResourcePools(resources, level, CLASS_RESOURCE_PREFIX);
}

// A spell granted by a feat (e.g. Magic Initiate) -- mirrors InvocationGrants' grantedSpells
// (srd-invocations.ts) since a granted spell is pushed onto sheet.spells the same way regardless
// of whether it came from an invocation or a feat.
export const grantedSpellSchema = z.object({
  name: z.string().trim().max(100),
  srdId: z.string().trim().max(80).optional(),
  level: z.number().int().min(0).max(9),
  atWill: z.boolean().default(false),
});
export type GrantedSpell = z.infer<typeof grantedSpellSchema>;

// A feat's spell choice slot (e.g. Magic Initiate's "2 cantrips + 1 1st-level spell from a class
// you choose") -- resolved in FeatPickerModal via WizardSpellbookPicker before the feat is added,
// separately from the fixed grantedSpells above (several feats grant both).
export const spellChoiceSchema = z.object({
  count: z.number().int().min(1).max(6),
  from: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("class"), classId: z.string().trim().toLowerCase().max(30) }),
    z.object({ kind: z.literal("list"), srdIds: z.array(z.string().trim().max(80)).min(1).max(20) }),
    z.object({ kind: z.literal("any") }),
  ]),
  maxLevel: z.number().int().min(0).max(9),
  atWill: z.boolean().default(false),
});
export type SpellChoice = z.infer<typeof spellChoiceSchema>;

export const customFeatDataSchema = effectBonusesSchema.extend({
  // 2000, not 500 -- feat rules text (e.g. Magic Initiate's full spell-list caveat, Polearm
  // Master's three riders) routinely runs long. Coupled to effectEntrySchema.description
  // (dnd5e.ts) since FeatPickerModal.pickCustom copies this straight onto a sheet entry --
  // raised together in the same change, see #122.
  description: z.string().trim().max(2000).default(""),
  // Skill ids this feat grants proficiency in (e.g. Skilled) -- aggregated via
  // effectSkillProficiencies (dnd5e.ts) rather than merged into skillProficiencies, so removing
  // the feat automatically un-grants it.
  skillProficiencies: z.array(z.string().trim().max(40)).default([]),
  // Spells this feat grants (e.g. Magic Initiate) -- pushed onto sheet.spells on pick, tagged
  // with the feat entry's id so removing the feat also removes the granted spells.
  grantedSpells: z.array(grantedSpellSchema).max(10).default([]),
  // Spell choice slots resolved at pick time (alongside the fixed grantedSpells above).
  spellChoices: z.array(spellChoiceSchema).max(3).default([]),
  // Prerequisites -- shown as a hint in FeatPickerModal (red when unmet), never enforced, same
  // house rule as SRD_INVOCATIONS' prereqLevel/prereqPact (srd-invocations.ts).
  prereqAbility: z.record(z.enum(DND5E_ABILITIES), z.number().int().min(1).max(30)).default({}),
  prereqLevel: z.number().int().min(0).max(20).default(0),
  prereqText: z.string().trim().max(120).default(""),
});
export type CustomFeatData = z.infer<typeof customFeatDataSchema>;

/** What a background's grantedFeats resolves to -- everything backgroundGrants() (the character
 * creation wizard) needs to build a FeatEntry plus any spells the feat fixedly grants. */
export interface ResolvedGrantedFeat {
  name: string;
  description: string;
  abilityBonuses: Partial<Record<string, number>>;
  acBonus: number;
  attackBonus: number;
  damageBonus: number;
  spellDCBonus: number;
  spellAttackBonus: number;
  skillProficiencies: string[];
  grantedSpells: GrantedSpell[];
}

/** Resolves a background's granted-feat reference (an SRD feat id, or `custom-${id}`) to the
 * feat's full data -- SRD-then-custom, the same order resolveSpellBuff/resolveSpellScaling use.
 * SRD_FEATS carries name only (no mechanical data, matching how FeatPickerModal's own SRD pick
 * builds a blank-bonus entry), so an SRD grant is a name-only feat; a custom one carries its real
 * bonuses and fixed grantedSpells. spellChoices are deliberately not included -- see the
 * grantedFeats field comment on why those aren't resolved through this path. */
export function resolveGrantedFeat(ref: string, customFeats: CustomContent[]): ResolvedGrantedFeat | null {
  const srd = SRD_FEATS.find((f) => f.id === ref);
  if (srd) {
    return {
      name: srd.name,
      description: "",
      abilityBonuses: {},
      acBonus: 0,
      attackBonus: 0,
      damageBonus: 0,
      spellDCBonus: 0,
      spellAttackBonus: 0,
      skillProficiencies: [],
      grantedSpells: [],
    };
  }
  if (!ref.startsWith("custom-")) return null;
  const customId = Number(ref.slice("custom-".length));
  const item = customFeats.find((c) => c.id === customId);
  if (!item) return null;
  const d = item.data as CustomFeatData;
  return {
    name: item.name,
    description: d.description,
    abilityBonuses: d.abilityBonuses,
    acBonus: d.acBonus,
    attackBonus: d.attackBonus,
    damageBonus: d.damageBonus,
    spellDCBonus: d.spellDCBonus,
    spellAttackBonus: d.spellAttackBonus,
    skillProficiencies: d.skillProficiencies,
    grantedSpells: d.grantedSpells,
  };
}

// Mirrors the SRD SrdSpell field set exactly (srd-spells.ts) -- name/level come from the
// custom-content row's own name/nothing-special-needed level field, so this schema keeps
// `level` too (spells need it outside a class-progression context) plus every mechanical field.
export const customSpellDataSchema = z.object({
  // Display-only (#121) -- never copied onto a sheet entry, unlike a feat/feature description,
  // so it's exempt from the effectEntrySchema coupling that governs those caps (see #116).
  description: z.string().trim().max(4000).default(""),
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
  concentration: z.boolean().default(false),
  // SRD class ids (lowercase) that can cast this spell -- same convention as SrdSpell.classes.
  classes: z.array(z.string().trim().toLowerCase().max(30)).max(12).default([]),
  // Attack/damage buff this spell grants on cast (#110-113) -- e.g. Wrathful Smite's next-hit
  // 1d6 psychic. Distinct from damageDice/damageType above, which is damage the spell itself
  // deals when cast (Magic Missile); this is damage/bonus applied to the *caster's own later
  // weapon attack*. All-default (hasBuffEffect false) means "no buff", the common case.
  buff: buffEffectSchema.default({}),
  // "At Higher Levels" scaling (#117-120), mirroring SRD_SPELL_SCALING's shape so
  // resolveSpellScaling() can treat an authored spell and a curated SRD one identically.
  // `scalingDicePerLevel` is the rollable part (appended per slot level above the spell's own
  // level); `scalingNote` covers upcasts that aren't extra dice on one roll.
  scalingDicePerLevel: z.string().trim().max(20).default(""),
  scalingNote: z.string().trim().max(300).default(""),
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
    concentration: d.concentration,
    classes: d.classes,
    description: d.description || undefined,
  };
}

/** Resolves a spell id (SRD or `custom-${id}`) to the BuffEffect it grants on cast, checking the
 * curated SRD_SPELL_EFFECTS table first and then the spell's own authored buff if it's a visible
 * custom spell -- null when the spell has no buff. Centralized here so SpellCastControl's cast
 * handler and any future caller resolve identically rather than re-deriving the custom-id
 * unwrapping and hasBuffEffect check at each call site. */
export function resolveSpellBuff(spellId: string, customSpells: CustomContent[]): BuffEffect | null {
  const curated = SRD_SPELL_EFFECTS[spellId];
  if (curated) return curated;
  if (!spellId.startsWith("custom-")) return null;
  const customId = Number(spellId.slice("custom-".length));
  const item = customSpells.find((c) => c.id === customId);
  if (!item) return null;
  const buff = (item.data as CustomSpellData).buff;
  return hasBuffEffect(buff) ? buff : null;
}

/** Resolves a spell id (SRD or `custom-${id}`) to its upcast scaling -- the curated
 * SRD_SPELL_SCALING table first, then a visible custom spell's own authored fields. Mirrors
 * resolveSpellBuff() so both spell-metadata lookups share one convention. Null when the spell
 * has no scaling of either kind. */
export function resolveSpellScaling(spellId: string, customSpells: CustomContent[]): SpellScaling | null {
  const curated = SRD_SPELL_SCALING[spellId];
  if (curated) return curated;
  if (!spellId.startsWith("custom-")) return null;
  const customId = Number(spellId.slice("custom-".length));
  const item = customSpells.find((c) => c.id === customId);
  if (!item) return null;
  const d = item.data as CustomSpellData;
  const dicePerLevel = d.scalingDicePerLevel?.trim() ?? "";
  const note = d.scalingNote?.trim() ?? "";
  if (!dicePerLevel && !note) return null;
  return { dicePerLevel: dicePerLevel || undefined, note: note || undefined };
}

// Spans the SRD weapon/armor/gear/magic-item shape via a `kind` discriminator, plus the same
// structured effect bonuses an equipped item already applies (#34) -- so a homebrew +1 sword or
// bespoke armor drives AC/attack/damage exactly like an SRD item, which plain SRD gear/weapons
// (no bonuses) and SRD magic items (name/category/rarity only, no mechanical stats) cannot.
export const customItemDataSchema = z.object({
  // Display-only (#121), same exemption as customSpellDataSchema.description -- never copied
  // onto a sheet entry (an inventory item's own `notes` field is separate, player-editable text).
  description: z.string().trim().max(4000).default(""),
  kind: z.enum(["weapon", "armor", "gear", "magic"]),
  weight: z.number().min(0).max(9999).default(0),
  // Sell value in gp -- same unit as the sheet's InventoryItem.value, used by the campaign shop.
  value: z.number().min(0).max(999999).default(0),
  // Weapon fields
  damageDice: z.string().trim().max(30).default(""),
  damageType: z.string().trim().max(30).default(""),
  properties: z.array(z.string().trim().max(40)).max(10).default([]),
  // Armor fields. armorCategory distinguishes a shield (stacks with body armor) from body armor
  // (light/medium/heavy, one equipped counts toward AC) -- needed so effectiveAC() (dnd5e.ts) can
  // tell a custom shield apart from a custom breastplate; defaults to "medium" for legacy rows.
  baseAC: z.number().int().min(0).max(30).default(0),
  dexBonus: z.boolean().default(false),
  maxDexBonus: z.number().int().min(0).max(10).optional(),
  stealthDisadvantage: z.boolean().default(false),
  armorCategory: z.enum(["light", "medium", "heavy", "shield"]).default("medium"),
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

/** Converts a custom armor item's data into the structured `armor` payload an inventory item
 * stores, mirroring srdArmorToInventoryArmor (srd-equipment.ts) for the custom-content source. */
export function customItemArmorPayload(d: CustomItemData): {
  baseAC: number;
  addDex: boolean;
  maxDex?: number;
  category: "light" | "medium" | "heavy" | "shield";
  stealthDisadvantage: boolean;
} {
  return {
    baseAC: d.baseAC,
    addDex: d.dexBonus,
    maxDex: d.maxDexBonus,
    category: d.armorCategory,
    stealthDisadvantage: d.stealthDisadvantage,
  };
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

// Same shape as monsterActionSchema plus the action-point cost (#125) -- see the
// MonsterLegendaryAction comment in srd-monsters.ts for why this isn't monsterActionSchema with
// an optional cost tacked on.
const monsterLegendaryActionSchema = z.object({
  name: z.string().trim().max(60),
  desc: z.string().trim().max(500).default(""),
  cost: z.number().int().min(1).max(3).default(1),
  attackBonus: z.number().int().min(-5).max(20).optional(),
  damageDice: z.string().trim().max(30).optional(),
  damageType: z.string().trim().max(30).optional(),
});

const monsterSkillSchema = z.object({
  name: z.string().trim().max(30),
  bonus: z.number().int().min(-5).max(20),
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
  // #125: previously only passivePerception existed here, so customMonsterToSrdShape's senses
  // mapping silently dropped darkvision/blindsight/tremorsense/truesight for every custom
  // monster -- a homebrew dragon could not have darkvision. SrdMonster.senses already models
  // all four; this just gives the authoring side the fields to fill them.
  darkvision: z.number().int().min(0).max(240).optional(),
  blindsight: z.number().int().min(0).max(240).optional(),
  tremorsense: z.number().int().min(0).max(240).optional(),
  truesight: z.number().int().min(0).max(240).optional(),
  languages: z.string().trim().max(200).default(""),
  damageVulnerabilities: z.array(z.string().trim().max(30)).max(10).default([]),
  damageResistances: z.array(z.string().trim().max(30)).max(10).default([]),
  damageImmunities: z.array(z.string().trim().max(30)).max(10).default([]),
  conditionImmunities: z.array(z.string().trim().max(30)).max(15).default([]),
  skills: z.array(monsterSkillSchema).max(10).default([]),
  specialAbilities: z.array(monsterSpecialAbilitySchema).max(10).default([]),
  actions: z.array(monsterActionSchema).max(10).default([]),
  legendaryActions: z.array(monsterLegendaryActionSchema).max(10).default([]),
  // Only meaningful when legendaryActions is non-empty; 3 is the near-universal 5e default.
  legendaryActionsPerRound: z.number().int().min(1).max(5).default(3),
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
    senses: {
      passivePerception: d.passivePerception,
      darkvision: d.darkvision,
      blindsight: d.blindsight,
      tremorsense: d.tremorsense,
      truesight: d.truesight,
    },
    languages: d.languages,
    damageVulnerabilities: d.damageVulnerabilities,
    damageResistances: d.damageResistances,
    damageImmunities: d.damageImmunities,
    conditionImmunities: d.conditionImmunities,
    skills: d.skills.length > 0 ? d.skills : undefined,
    specialAbilities: d.specialAbilities,
    actions: d.actions,
    legendaryActions: d.legendaryActions.length > 0 ? d.legendaryActions : undefined,
    legendaryActionsPerRound: d.legendaryActions.length > 0 ? d.legendaryActionsPerRound : undefined,
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

// Bulk upload (#123) -- one system per pack, since a homebrew pack realistically targets one
// game system; each row is validated per-type through the same per-type schemas the single-item
// create route already uses (dataSchemaFor in customContent.routes.ts), so an import can never
// create anything the manager forms couldn't. Capped at 200 rows -- generous for a homebrew
// pack, small enough that one request can't wedge the server.
export const importCustomContentSchema = z.object({
  system: z.enum(["generic", "dnd5e", "pf2e"]).default("dnd5e"),
  items: z
    .array(
      z.object({
        type: z.enum(["race", "class", "background", "subrace", "subclass", "feat", "spell", "item", "monster"]),
        name: z.string().trim().min(1).max(60),
        data: z.unknown(),
      }),
    )
    .min(1)
    .max(200),
});
export type ImportCustomContentInput = z.infer<typeof importCustomContentSchema>;

/** One row's outcome from an import (#123) -- reported per-row rather than aborting the whole
 * batch on the first bad row, since a 60-item pack with one typo shouldn't lose the other 59. */
export interface ImportCustomContentResult {
  index: number;
  name: string;
  type: CustomContentType;
  status: "created" | "updated" | "error";
  id?: number;
  error?: string;
  issues?: { path: (string | number)[]; message: string }[];
}

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
