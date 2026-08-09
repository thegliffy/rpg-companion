import { z } from "zod";
import {
  DND5E_ABILITIES,
  DND5E_ABILITY_NAMES,
  DND5E_SKILLS,
  buffEffectSchema,
  hasBuffEffect,
  effectiveAbilityScore,
  abilityModifier,
  proficiencyBonus,
} from "./dnd5e.js";
import type { ClassLevelEntry, CasterType, MartialResourcePool } from "./class-progression.js";
import type { BuffEffect, Dnd5eSheetData, Dnd5eAbility } from "./dnd5e.js";
import { currencySchema } from "./dnd5e.js";
import type { SrdSpell } from "./srd-spells.js";
import { SRD_SPELL_EFFECTS } from "./srd-spell-effects.js";
import { SRD_SPELL_HEALING } from "./srd-spell-healing.js";
import type { SpellHealing } from "./srd-spell-healing.js";
import { SRD_SPELL_SCALING } from "./srd-spell-scaling.js";
import type { SpellScaling } from "./srd-spell-scaling.js";
import type { SrdMonster } from "./srd-monsters.js";
import { SRD_FEATS } from "./srd-feats.js";
import { SRD_WEAPONS, SRD_ARMOR, SRD_GEAR, weaponDamageText, armorACFormulaText, srdArmorToInventoryArmor } from "./srd-equipment.js";
import type { EquipmentEntry } from "./srd-class-equipment.js";
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
  // Flat bonus to every saving throw, always active -- e.g. a homebrew Resilient-alike feat or a
  // race trait like Warforged's Constructed Resilience. Mirrors dnd5e.ts's effectEntrySchema,
  // which this feeds once a feat/feature/trait is granted onto a sheet.
  saveBonus: z.number().int().min(-10).max(10).default(0),
  // Flat bonus to initiative (#175) -- e.g. Alert's +5. Initiative is a Dexterity check, so this
  // is deliberately separate from abilityBonuses.dex, which would also move every other Dex
  // check, save, and AC. Alert's other halves (can't be surprised, hidden attackers gain no
  // advantage) stay description text -- they aren't numbers.
  initiativeBonus: z.number().int().min(-10).max(10).default(0),
  // A Sharpshooter/GWM-style optional attack-roll-penalty-for-damage-bonus tradeoff (#167, #178).
  // Originally feat-only; moved up here so a subclass feature or race trait can carry one too
  // (a homebrew "reckless strike"-alike race trait, a subclass feature granting the same
  // tradeoff). Mirrors effectEntrySchema's field exactly (dnd5e.ts), which this seeds onto the
  // sheet when granted. Genuinely optional (no default): almost nothing has one, and making it
  // required would force every construction site in the codebase to specify "no tradeoff".
  optionalAttackModifier: z.object({ attackPenalty: z.number().int().min(0).max(10), damageBonus: z.number().int().min(0).max(20) }).optional(),
  // Adds this ability's modifier to damage on every hit (#167, #178) -- the generic version of
  // what Agonizing Blast already does specifically for Eldritch Blast.
  damageAbilityBonus: z.enum(DND5E_ABILITIES).optional(),
  // Extra max HP per character level (#182) -- Tough's +2/level. Multiplied by sheet.level at
  // read time (effectiveHpBonus, dnd5e.ts) rather than stored as a flat total, so it stays
  // correct through every future level-up without re-editing the granted entry.
  hpBonusPerLevel: z.number().int().min(-4).max(4).default(0),
  // Flat bonus to walking speed, always active (#182) -- Mobile's +10 ft. buffEffectSchema
  // already has the equivalent field for a *temporary* spell/item buff; feats/traits never got
  // the always-on version. Mobile's other half (no opportunity attacks against a creature you've
  // hit this turn) stays description text -- a per-attack situational trigger, same reasoning
  // advantageOn/optionalAttackModifier already use for anything the app can't evaluate itself.
  speedBonus: z.number().int().min(-30).max(30).default(0),
  // Saving-throw *proficiency* grants, not just a flat bonus (#182) -- Resilient's actual RAW
  // ("gain proficiency in <ability> saving throws"), which saveBonus above can't express since
  // proficiency adds the proficiency bonus, not a fixed amount. Aggregated the same way
  // skillProficiencies already is (effectSkillProficiencies, dnd5e.ts) rather than merged into
  // sheet.saveProficiencies, so removing the grant automatically un-grants it.
  savingThrowProficiencies: z.array(z.enum(DND5E_ABILITIES)).max(6).default([]),
  // Formula-based AC (#182) -- Natural Armor (Lizardfolk/Tortle's "13 + Dex") or a subclass's
  // ability-to-AC feature (Bladesong's "10 + Dex + Int"). Landing here rather than on
  // raceTraitSchema alone means the *same* field covers both cases -- a subclass feature can
  // grant it too, no separate mechanism needed. Only meaningful with no body armor equipped
  // (effectiveAC, dnd5e.ts) -- wearing armor always overrides natural armor by RAW, same as it
  // already overrides the plain unarmored sheet.ac fallback. Optional: almost nothing has one.
  naturalArmorBase: z.number().int().min(0).max(30).optional(),
  // The second ability added on top of Dex, if any (Bladesong's Int; Natural Armor has none --
  // just base + Dex). Real examples never use more than Dex + one other, so a single optional
  // field covers every known case rather than an open list.
  naturalArmorAbility: z.enum(DND5E_ABILITIES).optional(),
  // Grants a linked companion creature (#182) -- a Ranger's Beast Master companion, an Echo
  // Knight's Echo. Landing here (not just on subclass features) means a homebrew race could in
  // principle grant one too, same "one shared mechanism, not a subclass-only special case"
  // reasoning naturalArmorBase above already uses. Presence of the flag on ANY granted feat/
  // feature/trait unlocks the sheet's CompanionPanel -- it doesn't carry which creature (the
  // player picks that on the sheet, mirroring Wild Shape/Familiar).
  grantsCompanion: z.boolean().default(false),
  // Skill ids a feat/feature/trait grants proficiency in (e.g. a feat like Skilled, a Tortle's
  // Survival Instinct). Previously declared separately on subclassFeatureSchema and
  // customFeatDataSchema (each with its own copy), which meant raceTraitSchema and
  // backgroundFeatureSchema -- both of which only extend this shared base -- had nowhere to put
  // one at all. Aggregated via effectSkillProficiencies (dnd5e.ts) rather than merged into the
  // sheet's own skillProficiencies, so removing the grant automatically un-grants it.
  skillProficiencies: z.array(z.string().trim().max(40)).max(18).default([]),
  // Darkvision range in feet (#182) -- previously raceTraitSchema-only, so a subclass feature
  // (Twilight Domain's Eyes of Night) or a feat had nowhere to grant it. Optional (not `.default`)
  // since almost nothing besides a race trait has one; raceTraitSchema below overrides this with
  // its own `.default(0)` since a race trait always has a concrete value. Aggregated via
  // effectiveDarkvision (dnd5e.ts), which takes the max across every source the same way
  // naturalArmorBase/climbSpeed etc. already do "best wins," not summed.
  darkvisionFeet: z.number().int().min(0).max(300).optional(),
}).strict();
export type EffectBonuses = z.infer<typeof effectBonusesSchema>;

// A spell granted by a feat or race trait (e.g. Magic Initiate, or a Tiefling's Infernal Legacy)
// -- mirrors InvocationGrants' grantedSpells (srd-invocations.ts) since a granted spell is pushed
// onto sheet.spells the same way regardless of which of the three grants it.
export const grantedSpellSchema = z.object({
  name: z.string().trim().max(100),
  srdId: z.string().trim().max(80).optional(),
  level: z.number().int().min(0).max(9),
  atWill: z.boolean().default(false),
  // Character level required before this grant applies (#168) -- e.g. Infernal Legacy's Hellish
  // Rebuke unlocking at 3rd level, Darkness at 5th. Undefined/0 means "available from 1st level",
  // same as every grant before this field existed. Race-trait grants are seeded once at creation
  // (raceGrants()) but re-checked on every level-up (levelUp(), Dnd5eSheet.tsx) so a spell that
  // unlocks later actually gets added when the character reaches that level, not only at creation.
  minLevel: z.number().int().min(1).max(20).optional(),
  // Fixed slot level to cast this at when granted without expending a real slot (#168) -- e.g.
  // Infernal Legacy's Hellish Rebuke is "cast once... as a 2nd-level spell" regardless of
  // character level. Undefined means "cast at the spell's own level", the existing behavior.
  castAtLevel: z.number().int().min(0).max(9).optional(),
}).strict();
export type GrantedSpell = z.infer<typeof grantedSpellSchema>;

// A race/subrace trait (#124) -- was a bare display-only string, making darkvision, resistances
// and innate spells unrepresentable (a homebrew Tiefling was cosmetic). Extends effectBonusesSchema
// for the same reason feats/background features/subclass features do: a trait like Dwarven
// Resilience is a flat always-on bonus, not just flavor text.
export const raceTraitSchema = effectBonusesSchema.extend({
  id: z.string().min(1),
  name: z.string().trim().max(60),
  description: z.string().trim().max(1000).default(""),
  // 120 was the RAW ceiling for every SRD/PHB darkvision source (Drow, Duergar), but published
  // (non-SRD) lineages go further -- Wildemount's Twilight lineage grants 300 ft. Capped at 300
  // rather than left unbounded since that's the highest real published value.
  darkvisionFeet: z.number().int().min(0).max(300).default(0),
  // Damage type names (e.g. "fire", "poison"), same free-text shape customMonsterDataSchema
  // already uses for its damageResistances -- no fixed damage-type enum exists to validate against.
  damageResistances: z.array(z.string().trim().max(30)).max(10).default([]),
  // Movement types beyond walking (#182) -- Aarakocra's fly speed, a Triton's swim speed. Mirrors
  // dnd5eSheetSchema's fields exactly; seeded into the sheet the same way darkvisionFeet is
  // (raceGrants(), taking the max across every trait rather than summing, matching how
  // darkvisionFeet already resolves multiple traits).
  climbSpeed: z.number().int().min(0).max(200).optional(),
  swimSpeed: z.number().int().min(0).max(200).optional(),
  flySpeed: z.number().int().min(0).max(200).optional(),
  burrowSpeed: z.number().int().min(0).max(200).optional(),
  grantedSpells: z.array(grantedSpellSchema).max(5).default([]),
  // Extra weapon damage dice added (not doubled) on a crit (#144) -- e.g. a homebrew race's own
  // Savage-Attacks-alike. Sized off the weapon's own die at the point of use, same as SRD
  // Half-Orc's (srd-races.ts) -- see critDamageFormula() (crit.ts).
  extraCritDice: z.number().int().min(0).max(3).default(0),
});
export type RaceTrait = z.infer<typeof raceTraitSchema>;

/** Upgrades a legacy `string[]` traits array (name only) into the current rich-object shape --
 * same no-DB-migration shim pattern #100 used for background features. Already-structured entries
 * pass through untouched; the surrounding schema's `.default()`s fill in the rest for bare names. */
function upgradeTraitStrings(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((t) => (typeof t === "string" ? { id: newEntityId("trait"), name: t } : t));
}

const rawCustomRaceDataSchema = z.object({
  abilityBonuses: z.record(z.enum(DND5E_ABILITIES), z.number().int().min(-4).max(4)).default({}),
  // Flexible ASI (#124): "+2 to one ability of your choice, +1 to another" (the modern default,
  // e.g. Tasha's customized origins) can't be expressed by the fixed `abilityBonuses` record above
  // since it doesn't commit to *which* ability gets the bonus. Each entry is one "+amount to an
  // ability of your choice" slot; the character creation wizard prompts for a distinct ability per
  // slot and folds the result into the character's final ability scores alongside the fixed bonuses.
  abilityBonusChoices: z.array(z.object({ amount: z.number().int().min(1).max(4) })).max(3).default([]),
  speed: z.number().int().min(0).max(200).default(30),
  size: z.string().trim().max(20).default("Medium"),
  languages: z.array(z.string().trim().max(40)).max(20).default([]),
  traits: z.array(raceTraitSchema).max(20).default([]),
}).strict();
export const customRaceDataSchema = z.preprocess((raw) => {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { ...input, traits: upgradeTraitStrings(input.traits) };
}, rawCustomRaceDataSchema);
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
}).strict();

const classLevelEntrySchema = z.object({
  level: z.number().int().min(1).max(20),
  cantripsKnown: z.number().int().min(0).max(20).optional(),
  spellsKnown: z.number().int().min(0).max(40).optional(),
  slots: z.record(z.string(), z.number().int().min(0).max(20)).optional(),
  features: z.array(z.string().trim().max(60)).max(10).optional(),
  martial: martialLevelEntrySchema.optional(),
}).strict();

// A limited-use resource (#105, generalized to classes in #127) -- e.g. Hexblade's Curse 1/short
// rest, or an Artificer's infusions. Named generically since #127 lifted this from subclass-only
// to also cover customClassDataSchema -- a homebrew resource belongs wherever its owner (class or
// subclass) is authored, same shape either way.
//
// `uses` was fixed-int only until #165 -- real current-edition mechanics scale with a formula
// (2024 Bardic Inspiration = Charisma modifier uses, Second Wind scales with level), so
// `usesFormula` picks which of `uses` (fixed) / proficiency bonus / an ability modifier applies;
// see resourceMaxUses() below for where this is actually computed.
const homebrewResourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().max(40),
  level: z.number().int().min(1).max(20).default(1),
  uses: z.number().int().min(1).max(20).default(1),
  usesFormula: z.enum(["fixed", "proficiencyBonus", "abilityModifier"]).default("fixed"),
  // Which ability's modifier scales uses when usesFormula is "abilityModifier" -- e.g. Bardic
  // Inspiration's Charisma. Unused (and unvalidated as required) for the other two formulas.
  usesAbility: z.enum(DND5E_ABILITIES).optional(),
  recharge: z.enum(["short", "long"]).default("long"),
  note: z.string().trim().max(80).default(""),
  // Names another resource pool this one draws from instead of minting its own counter (#179) --
  // e.g. Way of Mercy's Hand of Healing/Harm spending the monk's existing Ki Points rather than
  // getting a second tracker. Matched case-insensitively against every other pool's label
  // (resolveSpendsFromPools, class-progression.ts) at render time, once every base/class/subclass
  // pool a character actually has is known -- authoring time has no such list to validate against,
  // so this is unresolved-tolerant like every other name reference in this file (feat/spell
  // names): an unmatched name just leaves the resource with its own independent counter rather
  // than erroring. `uses`/`usesFormula`/`recharge` above are ignored when this resolves, since the
  // target pool's own numbers apply instead.
  spendsFrom: z.string().trim().max(40).optional(),
  // Named choices sharing this one counter (#179) -- e.g. Channel Divinity: Turn Undead vs. a
  // domain-specific option. Display-only (the "use" is still just spending the one shared use);
  // names only, no separate mechanics per option, since nothing here differs between them besides
  // flavor.
  options: z.array(z.string().trim().max(60)).max(6).default([]),
}).strict();
// Kept as "SubclassResource" (rather than renamed) since it's the established public name and
// every existing call site/import uses it -- ClassResource is a same-shape alias for clarity at
// the class-side call sites #127 adds.
export type SubclassResource = z.infer<typeof homebrewResourceSchema>;
export type ClassResource = SubclassResource;

// A single granted/grantable item -- itemId is an SRD weapon/armor/gear id, or `custom-${id}`
// referencing a visible custom "item" content record (same SRD-then-custom convention as
// grantedFeats/grantedSpells). Mirrors shared/systems/srd-class-equipment.ts's EquipmentEntry
// exactly, so the same resolver (resolveEquipmentEntry, #159) reads both without a shim.
const equipmentEntrySchema = z.object({
  itemId: z.string().trim().min(1).max(80),
  quantity: z.number().int().min(1).max(99).default(1),
}).strict();

const equipmentOptionSchema = z.object({
  label: z.string().trim().max(80),
  items: z.array(equipmentEntrySchema).max(10),
}).strict();

const equipmentChoiceSchema = z.object({
  options: z.array(equipmentOptionSchema).min(1).max(60),
}).strict();

// Starting equipment a class grants at level 1, IN ADDITION to the character's background
// (#156-161) -- e.g. "(a) a rapier or (b) a shortsword" is one choice with two options. Optional
// with an empty default so classes authored before this existed keep parsing unchanged.
export const classStartingEquipmentSchema = z.object({
  fixed: z.array(equipmentEntrySchema).max(20).default([]),
  choices: z.array(equipmentChoiceSchema).max(6).default([]),
}).strict();
export type ClassStartingEquipmentData = z.infer<typeof classStartingEquipmentSchema>;

export const customClassDataSchema = z.object({
  hitDie: z.number().int().refine((v) => [6, 8, 10, 12].includes(v), { message: "Hit die must be 6, 8, 10, or 12" }),
  casterType: z.enum(["none", "prepared", "known", "pact"]).default("none"),
  levels: z.array(classLevelEntrySchema).max(20).default([]),
  // Limited-use resources this class grants (#127) -- e.g. an Artificer's infusions or a Blood
  // Hunter's hemocraft die. Same shape and rest-handling as a subclass's resources (#105); the
  // asymmetry where only a subclass could carry one was never intentional.
  resources: z.array(homebrewResourceSchema).max(10).default([]),
  startingEquipment: classStartingEquipmentSchema.default({}),
}).strict();
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
}).strict();

const toolChoiceSchema = z.object({
  count: z.number().int().min(1).max(10),
  from: z.array(z.string().trim().max(40)).max(20),
}).strict();

const backgroundVariantSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().max(60),
  description: z.string().trim().max(500).default(""),
}).strict();

// A titled "lore box" table (#180) -- e.g. Far Traveler's two *independent* tables (reason for
// travelling, homeland), where a single flat variants[] + one pick count couldn't express "pick
// one from table A AND one from table B" at all. `pickCount: 0` is a pure-reference table with no
// selection at all (oath tenets, Mercy's masks) -- shown as flavor text, nothing to pick, nothing
// granted.
const backgroundVariantTableSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().max(60).default(""),
  pickCount: z.number().int().min(0).max(5).default(1),
  variants: z.array(backgroundVariantSchema).max(20).default([]),
}).strict();
export type BackgroundVariantTable = z.infer<typeof backgroundVariantTableSchema>;

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
      // 100 was too tight for a real multi-clause equipment line (e.g. a full pack description
      // spelled out inline rather than referencing #156's pack ids).
      items: z.array(z.string().trim().max(200)).max(20).default([]),
      // Deprecated (#182 soft-gap round) in favor of startingCurrency below, kept for backward
      // compatibility -- old rows still have it, and the preprocess migration folds it into
      // startingCurrency.gp. Author-facing forms should write startingCurrency instead.
      gold: z.number().min(0).max(9999).default(0),
      // Real starting-gold tables aren't always gold-only (a background's "5 sp" doesn't fit a
      // gold-only field without an awkward fractional value) -- reuses dnd5e.ts's sheet-side
      // currency shape exactly rather than redefining it, so formatBackgroundGrants()/the wizard
      // can set the sheet's full currency object instead of just `.gp`.
      startingCurrency: currencySchema.default({}),
    })
    .default({}),
  // #100: repeatable so a background can grant more than one distinct feature, each with its own
  // effect bonuses -- was a single {name, description} pair (see the preprocess migration below).
  features: z.array(backgroundFeatureSchema).max(5).default([]),
  // "Lore box" tables (#180) -- independent pick-one/pick-N sets of themed flavor variants, e.g.
  // Far Traveler's separate "reason for travelling" and "homeland" tables. Flavor-only (title +
  // description per variant); a per-variant mechanical tweak is a natural future extension once a
  // concrete need shows up.
  variantTables: z.array(backgroundVariantTableSchema).max(5).default([]),
  // Feats this background grants outright at character creation (#126) -- e.g. a homebrew
  // background paired with a homebrew bonus feat. References are an SRD feat id or `custom-${id}`,
  // the same SRD-then-custom convention #109 established for spell references, resolved via
  // resolveGrantedFeat() below. Deliberately just a fixed grant, not a picker: a feat with its own
  // spellChoices rows (#102) has those left unresolved when granted this way, since the character
  // creation wizard has no multi-step picker to resolve them through.
  grantedFeats: z.array(z.string().trim().max(100)).max(5).default([]),
}).strict();

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

// Upgrades three prior shapes into the current one, so old custom-content rows keep parsing
// without a data migration (the JSON blob in custom_content.data never changes; only how we
// read it does):
//   1. The legacy flat shape ({skillProficiencies, feature: string, toolProficiencies,
//      equipmentText}) -- what every background created before the structured redesign stored.
//   2. The structured-but-pre-#100 shape (singular `feature: {name, description}` instead of
//      `features: [...]`) -- what every background created between the structured redesign and
//      #100 stored, including the SRD Acolyte background synthesized on the fly by the wizard.
//   3. The pre-#180 shape (flat `variants[]` + one `variantPickCount`, instead of the current
//      `variantTables[]`) -- wrapped into a single untitled table, the same one pick-N list it
//      always was, just in the shape that now supports more than one independent table.
export const customBackgroundDataSchema = z.preprocess((raw) => {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const isLegacyFlat =
    !("skills" in input) &&
    ("skillProficiencies" in input || "feature" in input || "toolProficiencies" in input || "equipmentText" in input);

  let upgraded: Record<string, unknown>;
  if (isLegacyFlat) {
    const legacy = input as {
      skillProficiencies?: string[];
      feature?: string;
      toolProficiencies?: string[];
      equipmentText?: string;
    };
    upgraded = {
      skills: { fixed: legacy.skillProficiencies ?? [], choices: [] },
      tools: { fixed: legacy.toolProficiencies ?? [], choices: [] },
      languages: { fixed: [], anyCount: 0 },
      equipment: { items: legacy.equipmentText ? [legacy.equipmentText] : [], gold: 0 },
      features: upgradeSingularFeature(legacy.feature ? { name: legacy.feature } : undefined),
    };
  } else if ("feature" in input && !("features" in input)) {
    const { feature, ...rest } = input as { feature?: { name?: string; description?: string } };
    upgraded = { ...rest, features: upgradeSingularFeature(feature) };
  } else {
    upgraded = input;
  }

  if ("variants" in upgraded && !("variantTables" in upgraded)) {
    const { variants, variantPickCount, ...rest } = upgraded as { variants?: unknown[]; variantPickCount?: number };
    upgraded = {
      ...rest,
      variantTables:
        Array.isArray(variants) && variants.length > 0
          ? [{ id: newEntityId("bg-variant-table-migrated"), title: "", pickCount: variantPickCount ?? 1, variants }]
          : [],
    };
  }

  // 4. Pre-#182 equipment shape had only a flat `gold: number` -- folded into startingCurrency.gp
  // so every old row keeps working through the new field without a data migration.
  const equipment = (upgraded as { equipment?: { gold?: number; startingCurrency?: unknown } }).equipment;
  if (equipment && typeof equipment.gold === "number" && !("startingCurrency" in equipment)) {
    upgraded = { ...upgraded, equipment: { ...equipment, startingCurrency: { gp: equipment.gold } } };
  }

  return upgraded;
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
  variantTables: BackgroundVariantTable[];
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
  const currencyText = (
    Object.entries(data.equipment.startingCurrency) as [keyof typeof data.equipment.startingCurrency, number][]
  )
    .filter(([, amount]) => amount > 0)
    .map(([denom, amount]) => `${amount} ${denom}`)
    .join(", ");
  if (currencyText) equipParts.push(`a pouch containing ${currencyText}`);

  return {
    skills: joinEnglish(skillParts),
    tools: joinEnglish(toolParts),
    languages: joinEnglish(langParts),
    equipment: joinEnglish(equipParts),
    features: data.features,
    variantTables: data.variantTables,
  };
}

const rawCustomSubraceDataSchema = z.object({
  parentRace: z.string().trim().max(60).default(""),
  abilityBonuses: z.record(z.enum(DND5E_ABILITIES), z.number().int().min(-4).max(4)).default({}),
  // Optional speed override; 0/unset means "inherit parent race's speed".
  speed: z.number().int().min(0).max(200).default(0),
  // Rich trait objects (#124) -- same shape and same migration as customRaceDataSchema.traits;
  // a subrace (Drow's Superior Darkvision, Duergar's resistances/innate spells) needs the exact
  // same mechanics a race trait does, not a lesser version of them.
  traits: z.array(raceTraitSchema).max(20).default([]),
}).strict();
export const customSubraceDataSchema = z.preprocess((raw) => {
  const input = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return { ...input, traits: upgradeTraitStrings(input.traits) };
}, rawCustomSubraceDataSchema);
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
  // Armor/weapon/tool proficiency is cosmetic in this app -- nothing computes off
  // proficienciesText -- so these are appended to that free-text field on level-up.
  armorProficiencies: z.array(z.string().trim().max(40)).max(10).default([]),
  weaponProficiencies: z.array(z.string().trim().max(40)).max(10).default([]),
  toolProficiencies: z.array(z.string().trim().max(40)).max(10).default([]),
  // Lowers the natural-d20 crit threshold once this feature is gained (#143) -- e.g. a homebrew
  // Champion-alike's own "Improved Critical" at level 3. Optional and per-feature rather than one
  // flat field on the subclass, since RAW grants it at a specific level, not from level 1.
  // suggestedCritThreshold() (crit.ts) takes the lowest across every feature up to the character's
  // level; unset means this feature doesn't touch it.
  critThreshold: z.number().int().min(2).max(20).optional(),
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
}).strict();
export type SubclassSpell = z.infer<typeof subclassSpellSchema>;

export const customSubclassDataSchema = z.object({
  parentClass: z.string().trim().max(60).default(""),
  levels: z.array(classLevelEntrySchema).max(20).default([]),
  features: z.array(subclassFeatureSchema).max(30).default([]),
  spells: z.array(subclassSpellSchema).max(30).default([]),
  resources: z.array(homebrewResourceSchema).max(10).default([]),
}).strict();
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
    saveBonus: 0,
    initiativeBonus: 0,
    hpBonusPerLevel: 0,
    speedBonus: 0,
    savingThrowProficiencies: [],
    grantsCompanion: false,
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
/** The resource's actual max uses for this character (#165) -- `uses` verbatim for "fixed", or
 * computed live from the sheet for the other two formulas. Ability-modifier scaling floors at 1
 * (never 0 or negative), matching every RAW resource that scales this way -- e.g. a Charisma 8
 * Bard still gets at least 1 Bardic Inspiration use, not a resource that's unusable by design. */
export function resourceMaxUses(sheet: Dnd5eSheetData, resource: SubclassResource): number {
  if (resource.usesFormula === "proficiencyBonus") return proficiencyBonus(sheet.level);
  if (resource.usesFormula === "abilityModifier") {
    return Math.max(1, abilityModifier(effectiveAbilityScore(sheet, resource.usesAbility ?? "cha")));
  }
  return resource.uses;
}

function homebrewResourcePools(resources: SubclassResource[], sheet: Dnd5eSheetData, prefix: string): MartialResourcePool[] {
  return subclassResourcesUpTo(resources, sheet.level).map((r) => ({
    key: `${prefix}${r.id}`,
    label: r.name,
    max: resourceMaxUses(sheet, r),
    resetOn: r.recharge,
    note: r.note || undefined,
    // Resolved against the full pool list (base martial + class + subclass) by the caller, once
    // every pool a character has is known -- see resolveSpendsFromPools (class-progression.ts).
    spendsFrom: r.spendsFrom,
    options: r.options.length > 0 ? r.options : undefined,
  }));
}

export function subclassResourcePools(resources: SubclassResource[], sheet: Dnd5eSheetData): MartialResourcePool[] {
  return homebrewResourcePools(resources, sheet, SUBCLASS_RESOURCE_PREFIX);
}

/** Same as subclassResourcePools, for a homebrew *class*'s own resources (#127) -- e.g. an
 * Artificer's infusions, tracked the same way a subclass's Hexblade's Curse is. Distinct prefix
 * so a class and its subclass can each define a same-named/same-id resource without colliding. */
export function classResourcePools(resources: ClassResource[], sheet: Dnd5eSheetData): MartialResourcePool[] {
  return homebrewResourcePools(resources, sheet, CLASS_RESOURCE_PREFIX);
}

// A feat's spell choice slot (e.g. Magic Initiate's "2 cantrips + 1 1st-level spell from a class
// you choose") -- resolved in FeatPickerModal via WizardSpellbookPicker before the feat is added,
// separately from the fixed grantedSpells above (several feats grant both).
export const spellChoiceSchema = z.object({
  count: z.number().int().min(1).max(6),
  from: z.discriminatedUnion("kind", [
    // classId omitted (#168) means "the player picks a class when they take the feat" -- real
    // Magic Initiate ("choose a class: Wizard, Cleric, or Druid...") can't be expressed with a
    // fixed classId, since the author of the custom feat isn't the one taking it. A fixed
    // classId is still supported for the narrower "always this class" case.
    z.object({ kind: z.literal("class"), classId: z.string().trim().toLowerCase().max(30).optional() }),
    z.object({ kind: z.literal("list"), srdIds: z.array(z.string().trim().max(80)).min(1).max(20) }),
    z.object({ kind: z.literal("any") }),
  ]),
  maxLevel: z.number().int().min(0).max(9),
  atWill: z.boolean().default(false),
}).strict();
export type SpellChoice = z.infer<typeof spellChoiceSchema>;

export const customFeatDataSchema = effectBonusesSchema.extend({
  // 2000, not 500 -- feat rules text (e.g. Magic Initiate's full spell-list caveat, Polearm
  // Master's three riders) routinely runs long. Coupled to effectEntrySchema.description
  // (dnd5e.ts) since FeatPickerModal.pickCustom copies this straight onto a sheet entry --
  // raised together in the same change, see #122.
  description: z.string().trim().max(2000).default(""),
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
  // optionalAttackModifier/damageAbilityBonus (#167) now live on effectBonusesSchema (#178), so
  // every feat already has them via the extend() below without repeating the fields here.
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
  saveBonus: number;
  initiativeBonus: number;
  skillProficiencies: string[];
  hpBonusPerLevel: number;
  speedBonus: number;
  savingThrowProficiencies: Dnd5eAbility[];
  grantsCompanion: boolean;
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
      saveBonus: 0,
      initiativeBonus: 0,
      skillProficiencies: [],
      hpBonusPerLevel: 0,
      speedBonus: 0,
      savingThrowProficiencies: [],
      grantsCompanion: false,
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
    saveBonus: d.saveBonus,
    initiativeBonus: d.initiativeBonus,
    skillProficiencies: d.skillProficiencies,
    hpBonusPerLevel: d.hpBonusPerLevel,
    speedBonus: d.speedBonus,
    savingThrowProficiencies: d.savingThrowProficiencies,
    grantsCompanion: d.grantsCompanion,
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
  // 60 rejected real SRD text -- Counterspell's reaction trigger ("1 reaction, which you take
  // when you see a creature within 60 feet of you casting a spell") alone runs to 88 chars.
  castingTime: z.string().trim().max(120).default(""),
  range: z.string().trim().max(60).default(""),
  duration: z.string().trim().max(60).default(""),
  requiresAttackRoll: z.boolean().default(false),
  saveAbility: z.enum(DND5E_ABILITIES).optional(),
  damageDice: z.string().trim().max(30).optional(),
  damageType: z.string().trim().max(30).optional(),
  // Verbal/Somatic/Material components (#182 soft-gap round) -- previously only expressible in
  // free-text description. materialCost/materialConsumed only matter when material is true (a
  // costly-and-consumed spell like Revivify's 300gp diamond vs. a free material component no
  // one tracks) -- left populatable regardless of `material` rather than cross-validated, same
  // "author can leave stray data, nothing downstream trusts it without checking the flag first"
  // convention `optionalAttackModifier` etc. already follow.
  components: z
    .object({
      verbal: z.boolean().default(false),
      somatic: z.boolean().default(false),
      material: z.boolean().default(false),
      materialConsumed: z.boolean().default(false),
      materialCost: z.string().trim().max(120).default(""),
    })
    .default({}),
  // First-class healing (#182) -- mirrors damageDice/damageType's shape exactly, kept as a
  // separate pair rather than repurposing damageDice so a spell can't be "damage" and "healing"
  // at once by accident. Revivify's "target returns with 1 hit point" is a fixed value, not a
  // roll -- expressed as healingBonus: 1, healingDice left blank, the same fixed-value pattern
  // buffEffectSchema's damageBonus (no dice) already covers.
  healingDice: z.string().trim().max(30).optional(),
  healingBonus: z.number().int().min(0).max(100).optional(),
  // Lightweight structured save-effect riders (#182) -- enough to answer "does a successful
  // save avoid this entirely or just halve it" and name an imposed condition/area without
  // simulating who's affected or when it's removed (the same "hint, not enforcement" register
  // advantageOn/optionalAttackModifier already use for anything the app can't evaluate on its
  // own). Independent of damageDice: a save-negates utility spell (Hold Person) has no damage
  // at all but still wants saveEffect: "negates" and conditionImposed: "paralyzed".
  saveEffect: z.enum(["none", "half", "negates"]).default("none"),
  conditionImposed: z.string().trim().max(60).default(""),
  areaOfEffect: z.string().trim().max(60).default(""),
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
}).strict();
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
    components: d.components,
    saveEffect: d.saveEffect === "none" ? undefined : d.saveEffect,
    conditionImposed: d.conditionImposed || undefined,
    areaOfEffect: d.areaOfEffect || undefined,
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

/** Resolves a spell id (SRD or `custom-${id}`) to the healing it deals on cast, checking the
 * curated SRD_SPELL_HEALING table first and then a visible custom spell's own authored
 * healingDice/healingBonus -- mirrors resolveSpellBuff() exactly. Null when the spell heals
 * nothing (an all-zero/blank custom spell reads the same as "no healing", same convention
 * hasBuffEffect() uses for buffs). */
export function resolveSpellHealing(spellId: string, customSpells: CustomContent[]): SpellHealing | null {
  const curated = SRD_SPELL_HEALING[spellId];
  if (curated) return curated;
  if (!spellId.startsWith("custom-")) return null;
  const customId = Number(spellId.slice("custom-".length));
  const item = customSpells.find((c) => c.id === customId);
  if (!item) return null;
  const d = item.data as CustomSpellData;
  const dice = d.healingDice?.trim() ?? "";
  const bonus = d.healingBonus ?? 0;
  return dice !== "" || bonus !== 0 ? { dice, bonus } : null;
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
  // Magic item reference fields (informational, like SrdMagicItem). 30 rejected real SRD text --
  // "Wondrous item (requires attunement by a spellcaster)" alone runs to 48 chars.
  category: z.string().trim().max(60).default(""),
  rarity: z.string().trim().max(30).default(""),
  // Effect bonuses applied to the inventory entry when picked (mirrors equipped-item bonuses).
  abilityBonuses: z.record(z.enum(DND5E_ABILITIES), z.number().int().min(-10).max(10)).default({}),
  // Sets an ability score to a fixed value while equipped (#182) -- Amulet of Health-style.
  // Mirrors inventoryItemSchema.abilityScoreSetTo exactly, which this seeds when the item is
  // picked.
  abilityScoreSetTo: z.record(z.enum(DND5E_ABILITIES), z.number().int().min(1).max(30)).default({}),
  acBonus: z.number().int().min(-10).max(10).default(0),
  // Flat bonus to every saving throw while equipped -- e.g. a Cloak of Protection's +1. Mirrors
  // inventoryItemSchema.saveBonus (dnd5e.ts), which this seeds when the item is picked.
  saveBonus: z.number().int().min(-10).max(10).default(0),
  // A weapon's flat magic bonus (e.g. +1/+2/+3), applied equally to attack and damage rolls per
  // RAW for the vast majority of magic weapons. Mirrors the sheet's own per-attack `magicBonus`
  // field (attackSchema, dnd5e.ts) -- auto-generated Attacks rows (resolveEquipmentEntry, "Add to
  // Attacks") seed it from here instead of leaving the player to notice and type it in by hand.
  magicBonus: z.number().int().min(-5).max(5).default(0),
  // SRD magic item data has no attunement info at all (name/category/rarity only), so a custom
  // item is the only source that CAN carry this -- without it, a custom item can never seed
  // InventoryItem.requiresAttunement (dnd5e.ts) when picked, and the player has to notice and
  // check the box manually every time.
  requiresAttunement: z.boolean().default(false),
  // Damage types this item grants resistance to while equipped (#166) -- e.g. Dragon Scale
  // Mail's fire resistance. Mirrors inventoryItemSchema.grantedResistances (dnd5e.ts), which
  // this seeds when the item is picked; summed live by effectiveDamageResistances().
  grantedResistances: z.array(z.string().trim().max(30)).max(10).default([]),
  // A toggleable magic effect (#166) -- e.g. Flame Tongue's activatable +2d6 fire, switched on
  // and off via the sheet's Activate button rather than always-on like acBonus/saveBonus above.
  // Mirrors inventoryItemSchema.toggledEffect exactly, including the "always a full object,
  // hasBuffEffect() decides if it's meaningful" convention customSpellDataSchema.buff also uses.
  toggledEffect: buffEffectSchema.default({}),
  // Charge/usage tracking (#182) -- Wand of Magic Missiles-style "N total charges, each use costs
  // M, recharges on a rest." Scoped to a flat cost per use, not a variable spend or "cast a
  // specific leveled spell from the item" (that needs a slot-cost simulation this pass doesn't
  // build -- see TODO.md). maxCharges: 0 means "no charge tracking", so every existing item keeps
  // working unchanged. Tracked on the sheet via the same martialUsed counter class/subclass
  // resources already share (key `item-charges-${item.id}`), not a parallel mechanism.
  maxCharges: z.number().int().min(0).max(50).default(0),
  chargeCost: z.number().int().min(1).max(10).default(1),
  chargeRecharge: z.enum(["short", "long"]).default("long"),
}).strict();
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

export interface ResolvedInventoryItem {
  name: string;
  quantity: number;
  // Per-unit weight, matching InventoryItem.weight's existing convention (see the SRD weapon/
  // armor/gear pickers in Dnd5eSheet.tsx) -- NOT pre-multiplied by quantity.
  weight: number;
  value: number;
  notes: string;
  // Flat saving-throw bonus while equipped (e.g. a Cloak of Protection's +1) -- 0 for every SRD
  // item, since none of SRD_WEAPONS/SRD_ARMOR/SRD_GEAR carry structured bonuses at all.
  saveBonus: number;
  // Always false for an SRD item (SrdMagicItem has no attunement data); real only for a custom
  // "magic" item that authored requiresAttunement: true.
  requiresAttunement: boolean;
  // Damage types granted while equipped (#166) -- empty for every SRD item, same "only a custom
  // item can carry this" reasoning as requiresAttunement above.
  grantedResistances: string[];
  // A toggleable magic effect template (#166) -- always a full BuffEffect (zero/no-op for SRD
  // items and custom items that didn't author one); the caller checks hasBuffEffect() before
  // treating it as real, same convention buff-bearing spells already use.
  toggledEffect: BuffEffect;
  // Sets an ability score to a fixed value while equipped (#182, Amulet of Health-style) --
  // empty for every SRD item, same "only a custom item can carry this" reasoning as
  // requiresAttunement/grantedResistances above.
  abilityScoreSetTo: Partial<Record<Dnd5eAbility, number>>;
  // Charge/usage tracking (#182) -- 0/1/"long" (no tracking) for every SRD item, same "only a
  // custom item can carry this" reasoning as the fields above.
  maxCharges: number;
  chargeCost: number;
  chargeRecharge: "short" | "long";
  armor?: ReturnType<typeof srdArmorToInventoryArmor>;
  // Present only for a resolved weapon -- lets the caller auto-generate an Attacks row (#161)
  // without re-deriving these from the item's name. `range` is undefined for a custom weapon
  // (CustomItemData has no melee/ranged distinction) -- callers pass "" to weaponDefaultAbility
  // in that case, same as the sheet's own "Add to Attacks" button already does. `magicBonus` is
  // the weapon's flat +X, applied to the generated attack's own magicBonus field.
  weapon?: { damageDice: string; damageType: string; properties: string[]; range?: "Melee" | "Ranged"; magicBonus: number };
}

/** Resolves one EquipmentEntry (an SRD weapon/armor/gear id, or `custom-${id}`) into one or more
 * inventory-ready items -- more than one only when the id is a pack, which expands into its real
 * contents (#156) instead of landing as a single opaque "Burglar's Pack" row. Packs never nest, so
 * this recurses at most once. Unresolved ids fall back to an inert item using the raw id as its
 * name, so a bad reference is visibly wrong on the sheet rather than silently dropped -- the same
 * convention resolveFeatId's `?? name` fallback uses elsewhere in this file.
 *
 * `findCustomItem` looks up a visible custom "item" CustomContent by its bare (unprefixed) id;
 * shared has no notion of "currently visible content", so callers (the wizard, the sheet's "Add
 * to Attacks") pass their own visibleItems lookup. */
// No-op BuffEffect for SRD items and the unresolved fallback, none of which can carry a
// toggleable effect -- avoids repeating the same all-defaults literal at every return site below.
const NO_TOGGLE: BuffEffect = {
  attackBonus: 0,
  attackDice: "",
  damageBonus: 0,
  damageDice: "",
  damageType: "",
  saveDice: "",
  consumption: "per-hit",
  appliesToSpellAttacks: false,
  acBonus: 0,
  speedBonus: 0,
  speedMultiplier: 1,
  damageTypeOptions: [],
  flySpeed: 0,
};

export function resolveEquipmentEntry(entry: EquipmentEntry, findCustomItem: (id: string) => CustomContent | undefined): ResolvedInventoryItem[] {
  const { itemId, quantity } = entry;

  if (itemId.startsWith("custom-")) {
    const custom = findCustomItem(itemId.slice("custom-".length));
    if (!custom) {
      return [{ name: itemId, quantity, weight: 0, value: 0, notes: "", saveBonus: 0, requiresAttunement: false, grantedResistances: [], toggledEffect: NO_TOGGLE, abilityScoreSetTo: {}, maxCharges: 0, chargeCost: 1, chargeRecharge: "long" as const }];
    }
    const d = custom.data as CustomItemData;
    return [
      {
        name: custom.name,
        quantity,
        weight: d.weight,
        value: d.value,
        notes: customItemNotesText(custom),
        saveBonus: d.saveBonus,
        requiresAttunement: d.requiresAttunement,
        grantedResistances: d.grantedResistances,
        toggledEffect: d.toggledEffect,
        abilityScoreSetTo: d.abilityScoreSetTo,
        maxCharges: d.maxCharges,
        chargeCost: d.chargeCost,
        chargeRecharge: d.chargeRecharge,
        armor: d.kind === "armor" ? customItemArmorPayload(d) : undefined,
        weapon:
          d.kind === "weapon" ? { damageDice: d.damageDice, damageType: d.damageType, properties: d.properties, magicBonus: d.magicBonus } : undefined,
      },
    ];
  }

  const weapon = SRD_WEAPONS.find((w) => w.id === itemId);
  if (weapon) {
    return [
      {
        name: weapon.name,
        quantity,
        weight: weapon.weight,
        value: 0,
        notes: weaponDamageText(weapon),
        saveBonus: 0,
        requiresAttunement: false,
        grantedResistances: [],
        toggledEffect: NO_TOGGLE,
        abilityScoreSetTo: {},
        maxCharges: 0,
        chargeCost: 1,
        chargeRecharge: "long" as const,
        weapon: { damageDice: weapon.damageDice, damageType: weapon.damageType, properties: weapon.properties, range: weapon.range, magicBonus: 0 },
      },
    ];
  }

  const armor = SRD_ARMOR.find((a) => a.id === itemId);
  if (armor) {
    return [
      {
        name: armor.name,
        quantity,
        weight: armor.weight,
        value: 0,
        notes: armorACFormulaText(armor),
        saveBonus: 0,
        requiresAttunement: false,
        grantedResistances: [],
        toggledEffect: NO_TOGGLE,
        abilityScoreSetTo: {},
        maxCharges: 0,
        chargeCost: 1,
        chargeRecharge: "long" as const,
        armor: srdArmorToInventoryArmor(armor),
      },
    ];
  }

  const gear = SRD_GEAR.find((g) => g.id === itemId);
  if (gear) {
    if (gear.contents && gear.contents.length > 0) {
      return gear.contents.flatMap((c) => resolveEquipmentEntry({ itemId: c.itemId, quantity: c.quantity * quantity }, findCustomItem));
    }
    return [{ name: gear.name, quantity, weight: gear.weight, value: 0, notes: "", saveBonus: 0, requiresAttunement: false, grantedResistances: [], toggledEffect: NO_TOGGLE, abilityScoreSetTo: {}, maxCharges: 0, chargeCost: 1, chargeRecharge: "long" as const }];
  }

  return [{ name: itemId, quantity, weight: 0, value: 0, notes: "", saveBonus: 0, requiresAttunement: false, grantedResistances: [], toggledEffect: NO_TOGGLE, abilityScoreSetTo: {}, maxCharges: 0, chargeCost: 1, chargeRecharge: "long" as const }];
}

const monsterActionSchema = z.object({
  name: z.string().trim().max(60),
  desc: z.string().trim().max(500).default(""),
  attackBonus: z.number().int().min(-5).max(20).optional(),
  damageDice: z.string().trim().max(30).optional(),
  damageType: z.string().trim().max(30).optional(),
}).strict();

const monsterSpecialAbilitySchema = z.object({
  name: z.string().trim().max(60),
  desc: z.string().trim().max(500).default(""),
}).strict();

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
}).strict();

const monsterSkillSchema = z.object({
  name: z.string().trim().max(30),
  bonus: z.number().int().min(-5).max(20),
}).strict();

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
}).strict();
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

// The single per-type schema lookup every write path (create, PATCH, import) already needs --
// moved here from customContent.routes.ts so the frontend can reuse it too (#181). A stored
// row's `data` is never re-validated on GET (customContent.service.ts does a plain JSON.parse),
// so a row written before a field existed -- e.g. a feat from before #101 added prereqAbility --
// is missing it at runtime even though every schema *default*s it. Every frontend consumer casts
// `item.data as SomeData` with no runtime check, so a component that does `Object.entries
// (d.prereqAbility)` throws on that `undefined` with nothing to catch it, blanking the whole app
// (no error boundary above it). Re-parsing through this at the one real choke point
// (useCustomContent.ts) backfills every missing field's default exactly once, for every content
// type, rather than teaching each consumer to tolerate partial data individually.
export function customContentDataSchemaFor(type: CustomContentType) {
  switch (type) {
    case "race":
      return customRaceDataSchema;
    case "class":
      return customClassDataSchema;
    case "background":
      return customBackgroundDataSchema;
    case "subrace":
      return customSubraceDataSchema;
    case "subclass":
      return customSubclassDataSchema;
    case "feat":
      return customFeatDataSchema;
    case "spell":
      return customSpellDataSchema;
    case "item":
      return customItemDataSchema;
    case "monster":
      return customMonsterDataSchema;
  }
}

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
