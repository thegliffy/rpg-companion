import { useEffect, useMemo, useState } from "react";
import type {
  CustomContent,
  CustomContentType,
  CustomContentSystem,
  Dnd5eAbility,
  CustomBackgroundData,
  SpellChoice,
  SubclassFeature,
  SubclassSpell,
  SubclassResource,
  RaceTrait,
  ImportCustomContentResult,
  AdminContentSummary,
} from "shared";
import {
  DND5E_ABILITIES,
  DND5E_ABILITY_NAMES,
  DND5E_CLASSES,
  DND5E_SKILLS,
  DND5E_LANGUAGES,
  SRD_BACKGROUNDS,
  SRD_RACES,
  SRD_SPELLS,
  SRD_FEATS,
  CUSTOM_CONTENT_TYPES_BY_SYSTEM,
  SYSTEM_IDS,
  customBackgroundDataSchema,
  customRaceDataSchema,
  customSubraceDataSchema,
  formatBackgroundGrants,
  formatModifier,
} from "shared";
import * as customContentApi from "../api/customContent";
import * as adminApi from "../api/admin";
import { useAuth } from "../context/AuthContext";
import { panelSpaced as box } from "../styles";

// Exported for AdminPanel's content tab (#130), so the two admin-facing item lists can't drift.
export const TYPE_LABELS: Record<CustomContentType, string> = {
  race: "Race",
  subrace: "Subrace",
  class: "Class",
  subclass: "Subclass",
  background: "Background",
  feat: "Feat",
  spell: "Spell",
  item: "Item",
  monster: "Monster",
};

export const SYSTEM_LABELS: Record<CustomContentSystem, string> = {
  dnd5e: "D&D 5e",
  pf2e: "Pathfinder 2e",
  generic: "Generic",
};

interface LevelRow {
  level: string;
  cantripsKnown: string;
  spellsKnown: string;
  slotsText: string;
  featuresText: string;
  martialText: string;
}

const emptyLevelRow = (level: number): LevelRow => ({
  level: String(level),
  cantripsKnown: "",
  spellsKnown: "",
  slotsText: "",
  featuresText: "",
  martialText: "",
});

const MARTIAL_NUMERIC_KEYS = [
  "extraAttacks",
  "actionSurges",
  "indomitableUses",
  "rageCount",
  "rageDamageBonus",
  "brutalCriticalDice",
  "kiPoints",
  "unarmoredMovement",
  "auraRange",
  "favoredEnemies",
  "favoredTerrain",
] as const;
const MARTIAL_DICE_KEYS = ["sneakAttack", "martialArts"] as const;

interface ParsedMartial {
  extraAttacks?: number;
  actionSurges?: number;
  indomitableUses?: number;
  rageCount?: number;
  rageDamageBonus?: number;
  brutalCriticalDice?: number;
  kiPoints?: number;
  unarmoredMovement?: number;
  auraRange?: number;
  favoredEnemies?: number;
  favoredTerrain?: number;
  sneakAttack?: { diceCount: number; diceValue: number };
  martialArts?: { diceCount: number; diceValue: number };
}

// Compact "key:value" text editor for martial features, matching this form's existing
// slots/features text-shorthand convention rather than one input per field. Dice fields
// (sneakAttack, martialArts) use "NdM" shorthand, e.g. "sneakAttack:1d6".
function parseMartialText(text: string): ParsedMartial | undefined {
  const result: ParsedMartial = {};
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const [rawKey, rawValue] = pair.split(":").map((s) => s.trim());
      if (!rawKey || !rawValue) return;
      if ((MARTIAL_NUMERIC_KEYS as readonly string[]).includes(rawKey)) {
        (result as Record<string, number>)[rawKey] = Number(rawValue) || 0;
      } else if ((MARTIAL_DICE_KEYS as readonly string[]).includes(rawKey)) {
        const [count, value] = rawValue.split(/d/i).map((s) => Number(s.trim()));
        if (count && value) (result as Record<string, { diceCount: number; diceValue: number }>)[rawKey] = { diceCount: count, diceValue: value };
      }
    });
  return Object.keys(result).length > 0 ? result : undefined;
}

function martialToText(martial: ParsedMartial | undefined): string {
  if (!martial) return "";
  const parts: string[] = [];
  for (const k of MARTIAL_NUMERIC_KEYS) {
    if (martial[k] !== undefined) parts.push(`${k}:${martial[k]}`);
  }
  for (const k of MARTIAL_DICE_KEYS) {
    const d = martial[k];
    if (d) parts.push(`${k}:${d.diceCount}d${d.diceValue}`);
  }
  return parts.join(", ");
}

interface MonsterAction {
  name: string;
  desc: string;
  attackBonus?: number;
  damageDice?: string;
  damageType?: string;
}
interface MonsterSpecialAbility {
  name: string;
  desc: string;
}
interface MonsterLegendaryAction {
  name: string;
  desc: string;
  cost?: number;
  attackBonus?: number;
  damageDice?: string;
  damageType?: string;
}
interface MonsterSkill {
  name: string;
  bonus: number;
}

// One skill per line: "Name: +bonus" (#125).
function parseSkillsText(text: string): MonsterSkill[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(":");
      if (idx === -1) return { name: line, bonus: 0 };
      return { name: line.slice(0, idx).trim(), bonus: Number(line.slice(idx + 1).trim()) || 0 };
    });
}
function skillsToText(skills: MonsterSkill[]): string {
  return skills.map((s) => `${s.name}: +${s.bonus}`).join("\n");
}

// One legendary action per line: "Name | cost | attackBonus | damageDice | damageType | description"
// -- same convention as parseActionsText below, with cost inserted after name (#125). Cost blank
// means 1, matching MonsterLegendaryAction.cost's "undefined means 1" convention.
function parseLegendaryActionsText(text: string): MonsterLegendaryAction[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, cost, attackBonus, damageDice, damageType, desc] = line.split("|").map((s) => s.trim());
      return {
        name: name || "",
        desc: desc || "",
        cost: cost ? Number(cost) : undefined,
        attackBonus: attackBonus ? Number(attackBonus) : undefined,
        damageDice: damageDice || undefined,
        damageType: damageType || undefined,
      };
    });
}
function legendaryActionsToText(actions: MonsterLegendaryAction[]): string {
  return actions
    .map((a) => [a.name, a.cost ?? "", a.attackBonus ?? "", a.damageDice ?? "", a.damageType ?? "", a.desc].join(" | "))
    .join("\n");
}

// A race/subrace trait row (#124) -- shared by both the race and subrace editors, same as
// abilityBonuses. A trait's own granted spells (e.g. a Tiefling's Infernal Legacy) are authored as
// pipe-delimited text nested inside the card rather than a third level of repeatable rows, the same
// one-more-level-flat convention monster legendary actions use above.
interface TraitRow {
  id: string;
  name: string;
  description: string;
  darkvisionFeet: string;
  damageResistancesText: string; // comma-separated
  grantedSpellsText: string; // one per line: "Name | atWill(yes/no)"
  extraCritDice: string; // #144 -- e.g. a homebrew Savage-Attacks-alike
}
const emptyTraitRow = (): TraitRow => ({
  id: `trait-${crypto.randomUUID()}`,
  name: "",
  description: "",
  darkvisionFeet: "0",
  damageResistancesText: "",
  grantedSpellsText: "",
  extraCritDice: "0",
});

// "Name | atWill(yes/no)" per line -- atWill defaults to yes when omitted, since most racial
// innate cantrips (e.g. a High Elf's bonus cantrip) are at-will; "no" marks a once-per-rest grant
// like the higher tiers of Infernal Legacy.
function parseTraitGrantedSpellsText(text: string): { name: string; atWill: boolean }[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, atWillText] = line.split("|").map((s) => s.trim());
      return { name: name || "", atWill: (atWillText ?? "yes").toLowerCase() !== "no" };
    });
}
function traitGrantedSpellsToText(spells: { name: string; atWill: boolean }[]): string {
  return spells.map((s) => `${s.name} | ${s.atWill ? "yes" : "no"}`).join("\n");
}

function dataToTraitRows(traits: RaceTrait[]): TraitRow[] {
  return traits.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    darkvisionFeet: String(t.darkvisionFeet),
    damageResistancesText: t.damageResistances.join(", "),
    grantedSpellsText: traitGrantedSpellsToText(t.grantedSpells),
    extraCritDice: String(t.extraCritDice),
  }));
}

// One special ability per line: "Name: description".
function parseSpecialAbilitiesText(text: string): MonsterSpecialAbility[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const idx = line.indexOf(":");
      return idx === -1
        ? { name: line, desc: "" }
        : { name: line.slice(0, idx).trim(), desc: line.slice(idx + 1).trim() };
    });
}
function specialAbilitiesToText(abilities: MonsterSpecialAbility[]): string {
  return abilities.map((a) => `${a.name}: ${a.desc}`).join("\n");
}

// One action per line: "Name | attackBonus | damageDice | damageType | description" -- the
// last three attack fields may be left blank for non-attack actions (e.g. Multiattack).
function parseActionsText(text: string): MonsterAction[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, attackBonus, damageDice, damageType, desc] = line.split("|").map((s) => s.trim());
      return {
        name: name || "",
        desc: desc || "",
        attackBonus: attackBonus ? Number(attackBonus) : undefined,
        damageDice: damageDice || undefined,
        damageType: damageType || undefined,
      };
    });
}
function actionsToText(actions: MonsterAction[]): string {
  return actions.map((a) => [a.name, a.attackBonus ?? "", a.damageDice ?? "", a.damageType ?? "", a.desc].join(" | ")).join("\n");
}

// Speed as "walk:30, fly:60" text, matching the slots/martial shorthand convention.
function parseSpeedText(text: string): Record<string, number> {
  const result: Record<string, number> = {};
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const [k, v] = pair.split(":").map((s) => s.trim());
      if (k && v) result[k] = Number(v) || 0;
    });
  return result;
}
function speedToText(speed: Record<string, number | undefined>): string {
  return Object.entries(speed)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}:${v}`)
    .join(", ");
}

// Background skill-choice row editor state ("choose N from [a specific list | an ability group
// | any skill]"). `skillIds`/`abilities` are only meaningful for the matching `kind`.
interface BgSkillChoiceRow {
  count: string;
  kind: "list" | "ability" | "any";
  skillIds: string[];
  abilities: Dnd5eAbility[];
}
const emptyBgSkillChoiceRow = (): BgSkillChoiceRow => ({ count: "1", kind: "ability", skillIds: [], abilities: [] });

interface BgToolChoiceRow {
  count: string;
  from: string; // comma-separated tool names
}
const emptyBgToolChoiceRow = (): BgToolChoiceRow => ({ count: "1", from: "" });

interface BgVariantRow {
  id: string;
  title: string;
  description: string;
}
const emptyBgVariantRow = (): BgVariantRow => ({ id: `variant-${crypto.randomUUID()}`, title: "", description: "" });

// #100: a background can grant more than one feature, each carrying the same effect-bonus row a
// feat does. Numbers are kept as form-input strings, same convention as every other numeric field
// in this manager (parsed with Number(...) || 0 at submit time in buildBackgroundData()).
interface BgFeatureRow {
  id: string;
  name: string;
  description: string;
  abilityBonuses: Partial<Record<Dnd5eAbility, string>>;
  acBonus: string;
  attackBonus: string;
  damageBonus: string;
  spellDCBonus: string;
  spellAttackBonus: string;
}
const emptyBgFeatureRow = (): BgFeatureRow => ({
  id: `bg-feature-${crypto.randomUUID()}`,
  name: "",
  description: "",
  abilityBonuses: {},
  acBonus: "0",
  attackBonus: "0",
  damageBonus: "0",
  spellDCBonus: "0",
  spellAttackBonus: "0",
});

interface FeatGrantedSpellRow {
  name: string;
  level: string;
  atWill: boolean;
}
const emptyFeatGrantedSpellRow = (): FeatGrantedSpellRow => ({ name: "", level: "0", atWill: true });

// A spellChoices row (e.g. Magic Initiate's "2 cantrips from a class you choose"), edited as
// form-input strings same as everything else here. `kind` picks which of `classId`/`srdIdsText`
// is used to build the schema's discriminated-union `from` field on save.
interface FeatSpellChoiceRow {
  id: string;
  count: string;
  kind: "class" | "list" | "any";
  classId: string;
  srdIdsText: string; // comma-separated SRD spell ids, only used when kind === "list"
  maxLevel: string;
  atWill: boolean;
}
const splitCsv = (text: string): string[] => text.split(",").map((s) => s.trim()).filter(Boolean);

// Shared by the class (#127) and subclass (#105) save paths -- same row shape, same filter/map.
function resourceRowsToData(rows: ResourceRow[]): SubclassResource[] {
  return rows
    .filter((r) => r.name.trim() !== "")
    .map((r) => ({
      id: r.id,
      name: r.name.trim(),
      level: Number(r.level) || 1,
      uses: Number(r.uses) || 1,
      recharge: r.recharge,
      note: r.note.trim(),
    }));
}

// Subclass sub-editors (#103-105). Same form-input-strings convention as every other row type
// here; numbers are parsed on save.
interface SubclassFeatureRow {
  id: string;
  level: string;
  name: string;
  description: string;
  abilityBonuses: Partial<Record<Dnd5eAbility, string>>;
  acBonus: string;
  attackBonus: string;
  damageBonus: string;
  spellDCBonus: string;
  spellAttackBonus: string;
  skillProficiencies: string[];
  armorText: string; // comma-separated -- appended to the sheet's free-text proficiencies line
  weaponText: string;
  toolText: string;
}
const emptySubclassFeatureRow = (level: number): SubclassFeatureRow => ({
  id: `subclass-feature-${crypto.randomUUID()}`,
  level: String(level),
  name: "",
  description: "",
  abilityBonuses: {},
  acBonus: "0",
  attackBonus: "0",
  damageBonus: "0",
  spellDCBonus: "0",
  spellAttackBonus: "0",
  skillProficiencies: [],
  armorText: "",
  weaponText: "",
  toolText: "",
});

interface SubclassSpellRow {
  id: string;
  level: string; // character level the spell becomes available
  name: string; // matched to an SRD spell by exact name, same as a feat's granted spells
  mode: "list" | "granted";
  atWill: boolean;
}
const emptySubclassSpellRow = (level: number): SubclassSpellRow => ({
  id: `subclass-spell-${crypto.randomUUID()}`,
  level: String(level),
  name: "",
  mode: "list",
  atWill: false,
});

// Shared by class (#127) and subclass (#105) resource editors -- same shape either way, so one
// row type covers both rather than two identical interfaces.
interface ResourceRow {
  id: string;
  name: string;
  level: string;
  uses: string;
  recharge: "short" | "long";
  note: string;
}
const emptyResourceRow = (idPrefix: "class" | "subclass"): ResourceRow => ({
  id: `${idPrefix}-resource-${crypto.randomUUID()}`,
  name: "",
  level: "1",
  uses: "1",
  recharge: "long",
  note: "",
});

const emptyFeatSpellChoiceRow = (): FeatSpellChoiceRow => ({
  id: `feat-spell-choice-${crypto.randomUUID()}`,
  count: "1",
  kind: "class",
  classId: "wizard",
  srdIdsText: "",
  maxLevel: "0",
  atWill: false,
});

function rowsToLevels(rows: LevelRow[]) {
  return rows
    .filter((r) => r.level.trim() !== "")
    .map((r) => {
      const slots: Record<string, number> = {};
      r.slotsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((pair) => {
          const [lvl, count] = pair.split(":").map((s) => s.trim());
          if (lvl && count) slots[lvl] = Number(count) || 0;
        });
      const features = r.featuresText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const level = Number(r.level) || 1;
      const martial = parseMartialText(r.martialText);
      return {
        level,
        cantripsKnown: r.cantripsKnown ? Number(r.cantripsKnown) : undefined,
        spellsKnown: r.spellsKnown ? Number(r.spellsKnown) : undefined,
        slots: Object.keys(slots).length > 0 ? slots : undefined,
        features: features.length > 0 ? features : undefined,
        martial: martial ? { level, ...martial } : undefined,
      };
    })
    .sort((a, b) => a.level - b.level);
}

function levelsToRows(
  levels: {
    level: number;
    cantripsKnown?: number;
    spellsKnown?: number;
    slots?: Record<string, number>;
    features?: string[];
    martial?: ParsedMartial;
  }[],
): LevelRow[] {
  if (levels.length === 0) return [emptyLevelRow(1)];
  return levels.map((l) => ({
    level: String(l.level),
    cantripsKnown: l.cantripsKnown !== undefined ? String(l.cantripsKnown) : "",
    spellsKnown: l.spellsKnown !== undefined ? String(l.spellsKnown) : "",
    slotsText: l.slots ? Object.entries(l.slots).map(([k, v]) => `${k}:${v}`).join(", ") : "",
    featuresText: l.features ? l.features.join(", ") : "",
    martialText: martialToText(l.martial),
  }));
}

export function CustomContentManager({
  onBack,
  editContentId,
}: {
  onBack: () => void;
  // Opens straight into editing this item on mount (#134) -- how the admin portal's content tab
  // links here for editing instead of duplicating a second editor for every content type.
  editContentId?: number;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [items, setItems] = useState<CustomContent[]>([]);
  // Site-wide, every item regardless of owner/status (#134) -- admin-only, lean (no `data`), backs
  // the "All items" list in place of the own-items-only `items` above. Edit still fetches the full
  // item by id (getCustomContent) since this summary shape doesn't carry it.
  const [allContentSummaries, setAllContentSummaries] = useState<AdminContentSummary[]>([]);
  const [visibleSpells, setVisibleSpells] = useState<CustomContent[]>([]);
  const [visibleFeats, setVisibleFeats] = useState<CustomContent[]>([]);
  // Same "visible, not just own" convention, backing the parentClass/parentRace dropdowns (#114/
  // #115) so a subclass/subrace author picks from classes/races a character can actually have.
  const [visibleClasses, setVisibleClasses] = useState<CustomContent[]>([]);
  const [visibleRaces, setVisibleRaces] = useState<CustomContent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [system, setSystem] = useState<CustomContentSystem>("dnd5e");
  const [type, setType] = useState<CustomContentType>("race");
  const [name, setName] = useState("");

  // JSON pack import (#123).
  const [importText, setImportText] = useState("");
  const [importBusy, setImportBusy] = useState(false);
  const [importResults, setImportResults] = useState<ImportCustomContentResult[] | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const validTypes = CUSTOM_CONTENT_TYPES_BY_SYSTEM[system];

  function changeSystem(next: CustomContentSystem) {
    setSystem(next);
    const nextValidTypes = CUSTOM_CONTENT_TYPES_BY_SYSTEM[next];
    if (!nextValidTypes.includes(type) && nextValidTypes.length > 0) {
      setType(nextValidTypes[0]);
    }
  }

  // Race fields
  const [abilityBonuses, setAbilityBonuses] = useState<Partial<Record<Dnd5eAbility, string>>>({});
  // Flexible ASI (#124) -- comma-separated bonus amounts, e.g. "2, 1" for "+2 to one ability of
  // your choice, +1 to another" (the modern default). Race only; subraces keep fixed bonuses.
  const [raceAbilityChoicesText, setRaceAbilityChoicesText] = useState("");
  const [speed, setSpeed] = useState("30");
  const [size, setSize] = useState("Medium");
  const [languages, setLanguages] = useState("");
  // Traits (#124) -- shared between the race and subrace editors, same as abilityBonuses above.
  const [traitRows, setTraitRows] = useState<TraitRow[]>([]);

  // Class fields
  const [hitDie, setHitDie] = useState("8");
  const [casterType, setCasterType] = useState<"none" | "prepared" | "known" | "pact">("none");
  const [classResourceRows, setClassResourceRows] = useState<ResourceRow[]>([]);
  const [levelRows, setLevelRows] = useState<LevelRow[]>([emptyLevelRow(1)]);

  // Background fields
  const [bgSkillsFixed, setBgSkillsFixed] = useState<string[]>([]);
  const [bgSkillChoices, setBgSkillChoices] = useState<BgSkillChoiceRow[]>([]);
  const [bgToolsFixed, setBgToolsFixed] = useState(""); // comma-separated -- no fixed SRD tool list to check against
  const [bgToolChoices, setBgToolChoices] = useState<BgToolChoiceRow[]>([]);
  const [bgLanguagesFixed, setBgLanguagesFixed] = useState<string[]>([]);
  const [bgLanguagesAnyCount, setBgLanguagesAnyCount] = useState("0");
  const [bgEquipmentItems, setBgEquipmentItems] = useState(""); // comma-separated
  const [bgGold, setBgGold] = useState("0");
  const [bgFeatures, setBgFeatures] = useState<BgFeatureRow[]>([]);
  const [bgVariants, setBgVariants] = useState<BgVariantRow[]>([]);
  const [bgVariantPickCount, setBgVariantPickCount] = useState("1");
  const [bgCloneFrom, setBgCloneFrom] = useState("");
  const [bgGrantedFeatsText, setBgGrantedFeatsText] = useState(""); // comma-separated feat names (#126)

  // Subrace / subclass parent (ability bonuses, traits, and level rows are reused from above).
  const [parentRace, setParentRace] = useState("");
  const [parentClass, setParentClass] = useState("");
  const [subclassFeatureRows, setSubclassFeatureRows] = useState<SubclassFeatureRow[]>([]);
  const [subclassSpellRows, setSubclassSpellRows] = useState<SubclassSpellRow[]>([]);
  const [subclassResourceRows, setSubclassResourceRows] = useState<ResourceRow[]>([]);

  // Feat fields (ability bonuses reused from above).
  const [featDescription, setFeatDescription] = useState("");
  const [featAc, setFeatAc] = useState("0");
  const [featAtk, setFeatAtk] = useState("0");
  const [featDmg, setFeatDmg] = useState("0");
  const [featDC, setFeatDC] = useState("0");
  const [featSpellAtk, setFeatSpellAtk] = useState("0");
  const [featSkillProficiencies, setFeatSkillProficiencies] = useState<string[]>([]);
  const [featGrantedSpells, setFeatGrantedSpells] = useState<FeatGrantedSpellRow[]>([]);
  const [featSpellChoices, setFeatSpellChoices] = useState<FeatSpellChoiceRow[]>([]);
  const [featPrereqAbility, setFeatPrereqAbility] = useState<Partial<Record<Dnd5eAbility, string>>>({});
  const [featPrereqLevel, setFeatPrereqLevel] = useState("0");
  const [featPrereqText, setFeatPrereqText] = useState("");

  // Spell fields
  const [spellDescription, setSpellDescription] = useState("");
  const [spellLevel, setSpellLevel] = useState("0");
  const [spellSchool, setSpellSchool] = useState("");
  const [spellCastingTime, setSpellCastingTime] = useState("1 action");
  const [spellRange, setSpellRange] = useState("");
  const [spellDuration, setSpellDuration] = useState("");
  const [spellRequiresAttackRoll, setSpellRequiresAttackRoll] = useState(false);
  const [spellSaveAbility, setSpellSaveAbility] = useState<Dnd5eAbility | "">("");
  const [spellDamageDice, setSpellDamageDice] = useState("");
  const [spellDamageType, setSpellDamageType] = useState("");
  const [spellRitual, setSpellRitual] = useState(false);
  const [spellConcentration, setSpellConcentration] = useState(false);
  const [spellClasses, setSpellClasses] = useState("");
  // Attack/damage buff this spell grants on cast (#110-113) -- distinct from spellDamageDice/
  // spellDamageType above, which is damage the spell itself deals (Magic Missile); this is
  // bonus applied to the caster's own later weapon attack (Wrathful Smite, Bless).
  const [spellBuffAttackBonus, setSpellBuffAttackBonus] = useState("0");
  const [spellBuffAttackDice, setSpellBuffAttackDice] = useState("");
  const [spellBuffDamageBonus, setSpellBuffDamageBonus] = useState("0");
  const [spellBuffDamageDice, setSpellBuffDamageDice] = useState("");
  const [spellBuffDamageType, setSpellBuffDamageType] = useState("");
  const [spellBuffConsumption, setSpellBuffConsumption] = useState<"per-hit" | "once">("per-hit");
  // "At Higher Levels" scaling (#117-120) -- dice appended per slot level above the spell's own
  // level, plus a freeform note for upcasts that aren't extra dice on one roll.
  const [spellScalingDicePerLevel, setSpellScalingDicePerLevel] = useState("");
  const [spellScalingNote, setSpellScalingNote] = useState("");

  // Item fields (abilityBonuses reused from above; kind drives which fields apply)
  const [itemDescription, setItemDescription] = useState("");
  const [itemKind, setItemKind] = useState<"weapon" | "armor" | "gear" | "magic">("weapon");
  const [itemWeight, setItemWeight] = useState("0");
  const [itemValue, setItemValue] = useState("0");
  const [itemDamageDice, setItemDamageDice] = useState("");
  const [itemDamageType, setItemDamageType] = useState("");
  const [itemProperties, setItemProperties] = useState("");
  const [itemBaseAC, setItemBaseAC] = useState("10");
  const [itemDexBonus, setItemDexBonus] = useState(false);
  const [itemMaxDexBonus, setItemMaxDexBonus] = useState("");
  const [itemStealthDisadvantage, setItemStealthDisadvantage] = useState(false);
  const [itemArmorCategory, setItemArmorCategory] = useState<"light" | "medium" | "heavy" | "shield">("medium");
  const [itemCategory, setItemCategory] = useState("");
  const [itemRarity, setItemRarity] = useState("");
  const [itemAcBonus, setItemAcBonus] = useState("0");

  // Monster fields
  const [monsterSize, setMonsterSize] = useState("Medium");
  const [monsterType, setMonsterType] = useState("beast");
  const [monsterAlignment, setMonsterAlignment] = useState("unaligned");
  const [monsterCr, setMonsterCr] = useState("1");
  const [monsterXp, setMonsterXp] = useState("0");
  const [monsterAc, setMonsterAc] = useState("10");
  const [monsterHp, setMonsterHp] = useState("10");
  const [monsterHitDice, setMonsterHitDice] = useState("");
  const [monsterSpeedText, setMonsterSpeedText] = useState("walk:30");
  const [monsterStr, setMonsterStr] = useState("10");
  const [monsterDex, setMonsterDex] = useState("10");
  const [monsterCon, setMonsterCon] = useState("10");
  const [monsterInt, setMonsterInt] = useState("10");
  const [monsterWis, setMonsterWis] = useState("10");
  const [monsterCha, setMonsterCha] = useState("10");
  const [monsterPassivePerception, setMonsterPassivePerception] = useState("10");
  // #125: darkvision/blindsight/tremorsense/truesight -- previously only passivePerception
  // existed, so a custom monster could never have darkvision (see customMonsterToSrdShape).
  const [monsterDarkvision, setMonsterDarkvision] = useState("");
  const [monsterBlindsight, setMonsterBlindsight] = useState("");
  const [monsterTremorsense, setMonsterTremorsense] = useState("");
  const [monsterTruesight, setMonsterTruesight] = useState("");
  const [monsterLanguages, setMonsterLanguages] = useState("");
  const [monsterVulnerabilities, setMonsterVulnerabilities] = useState("");
  const [monsterResistances, setMonsterResistances] = useState("");
  const [monsterImmunities, setMonsterImmunities] = useState("");
  const [monsterConditionImmunities, setMonsterConditionImmunities] = useState("");
  const [monsterSkillsText, setMonsterSkillsText] = useState("");
  const [monsterSpecialAbilitiesText, setMonsterSpecialAbilitiesText] = useState("");
  const [monsterActionsText, setMonsterActionsText] = useState("");
  const [monsterLegendaryActionsText, setMonsterLegendaryActionsText] = useState("");
  const [monsterLegendaryActionsPerRound, setMonsterLegendaryActionsPerRound] = useState("3");

  function refresh() {
    customContentApi
      .listCustomContent()
      .then((all) => {
        setItems(all.filter((i) => i.createdByUserId === user?.id));
        // Every custom spell *visible* to this user, not just their own -- these feed both the
        // spell-name autocompletes and the unresolved-name warning, and the sheet resolves against
        // the same set, so anything narrower would suggest too little and warn too much.
        setVisibleSpells(all.filter((i) => i.type === "spell"));
        // Same "visible, not just own" convention for feats (#126) -- backs the background
        // editor's grantedFeats autocomplete/warning, and the wizard resolves grants against the
        // same set.
        setVisibleFeats(all.filter((i) => i.type === "feat"));
        setVisibleClasses(all.filter((i) => i.type === "class"));
        setVisibleRaces(all.filter((i) => i.type === "race"));
      })
      .catch((err) => setError(err.message));
    if (isAdmin) {
      adminApi.listAllContent().then(setAllContentSummaries).catch((err) => setError(err.message));
    }
  }

  useEffect(refresh, [user?.id]);

  // Opens straight into the editor for editContentId (#134) once on mount -- the full item is
  // fetched separately since the admin summary list it was clicked from doesn't carry `data`.
  useEffect(() => {
    if (editContentId === undefined) return;
    customContentApi
      .getCustomContent(editContentId)
      .then(startEdit)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load item"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editContentId]);

  /** Parses and uploads a JSON pack against the currently selected System -- each row is
   * validated server-side through the same per-type schema the New Item form uses, so nothing an
   * import creates could not also have been hand-entered. Errors are per-row (#123): one bad row
   * in a 60-item pack doesn't lose the other 59. */
  async function handleImport() {
    setImportError(null);
    setImportResults(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setImportError("Not valid JSON.");
      return;
    }
    if (!Array.isArray(parsed)) {
      setImportError('Expected a JSON array of { "type", "name", "data" } objects.');
      return;
    }
    setImportBusy(true);
    try {
      const results = await customContentApi.importCustomContent(system, parsed as { type: CustomContentType; name: string; data: unknown }[]);
      setImportResults(results);
      refresh();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImportBusy(false);
    }
  }

  function handleImportFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setImportText(String(reader.result ?? ""));
      setImportResults(null);
      setImportError(null);
    };
    reader.readAsText(file);
  }

  // SRD plus every visible custom spell, deduped by name (a homebrew spell may deliberately
  // shadow an SRD one). Backs both spell-name autocompletes and the unresolved-name check, so
  // the thing suggested and the thing accepted can't drift apart.
  const spellNameOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of [...SRD_SPELLS.map((s) => s.name), ...visibleSpells.map((i) => i.name.trim())]) {
      const key = name.trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push(name);
      }
    }
    return out;
  }, [visibleSpells]);
  const knownSpellNames = useMemo(
    () => new Set(spellNameOptions.map((n) => n.toLowerCase())),
    [spellNameOptions],
  );

  /** Resolves a typed spell name to the id and level stored on the sheet: an SRD spell, else a
   * visible custom one (`custom-${id}`, matching customSpellToSrdShape). Without the custom leg a
   * homebrew spell saves with an empty id and renders on the sheet as a bare name. */
  function resolveSpellName(name: string): { srdId: string; level: number } | null {
    const key = name.trim().toLowerCase();
    if (!key) return null;
    const srd = SRD_SPELLS.find((sp) => sp.name.toLowerCase() === key);
    if (srd) return { srdId: srd.id, level: srd.level };
    const custom = visibleSpells.find((i) => i.name.trim().toLowerCase() === key);
    if (custom) return { srdId: `custom-${custom.id}`, level: (custom.data as { level?: number }).level ?? 0 };
    return null;
  }

  // SRD plus every visible custom feat, deduped by name -- same convention as spellNameOptions,
  // backing the background editor's grantedFeats (#126) autocomplete and unresolved-name check.
  const featNameOptions = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const name of [...SRD_FEATS.map((f) => f.name), ...visibleFeats.map((i) => i.name.trim())]) {
      const key = name.trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push(name);
      }
    }
    return out;
  }, [visibleFeats]);

  /** Resolves a typed feat name to the reference id a background's grantedFeats stores -- an SRD
   * feat id, or `custom-${id}` matching resolveGrantedFeat's (custom-content.ts) expectation. */
  function resolveFeatId(name: string): string | null {
    const key = name.trim().toLowerCase();
    if (!key) return null;
    const srd = SRD_FEATS.find((f) => f.name.toLowerCase() === key);
    if (srd) return srd.id;
    const custom = visibleFeats.find((i) => i.name.trim().toLowerCase() === key);
    if (custom) return `custom-${custom.id}`;
    return null;
  }

  // Shared by the race and subrace save paths (#124) -- a closure (not a top-level helper) since
  // resolving a trait's granted spell names needs resolveSpellName's visibleSpells lookup, the
  // same resolver a feat's grantedSpells already uses.
  function traitRowsToData(rows: TraitRow[]): RaceTrait[] {
    return rows
      .filter((r) => r.name.trim() !== "")
      .map((r) => ({
        id: r.id,
        name: r.name.trim(),
        description: r.description.trim(),
        darkvisionFeet: Number(r.darkvisionFeet) || 0,
        damageResistances: splitCsv(r.damageResistancesText),
        grantedSpells: parseTraitGrantedSpellsText(r.grantedSpellsText)
          .filter((s) => s.name !== "")
          .map((s) => {
            const resolved = resolveSpellName(s.name);
            return { name: s.name, srdId: resolved?.srdId, level: resolved?.level ?? 0, atWill: s.atWill };
          }),
        extraCritDice: Number(r.extraCritDice) || 0,
        abilityBonuses: {},
        acBonus: 0,
        attackBonus: 0,
        damageBonus: 0,
        spellDCBonus: 0,
        spellAttackBonus: 0,
      }));
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setAbilityBonuses({});
    setRaceAbilityChoicesText("");
    setSpeed("30");
    setSize("Medium");
    setLanguages("");
    setTraitRows([]);
    setHitDie("8");
    setCasterType("none");
    setClassResourceRows([]);
    setLevelRows([emptyLevelRow(1)]);
    setBgSkillsFixed([]);
    setBgSkillChoices([]);
    setBgToolsFixed("");
    setBgToolChoices([]);
    setBgLanguagesFixed([]);
    setBgLanguagesAnyCount("0");
    setBgEquipmentItems("");
    setBgGold("0");
    setBgFeatures([]);
    setBgVariants([]);
    setBgVariantPickCount("1");
    setBgCloneFrom("");
    setBgGrantedFeatsText("");
    setParentRace("");
    setParentClass("");
    setSubclassFeatureRows([]);
    setSubclassSpellRows([]);
    setSubclassResourceRows([]);
    setFeatDescription("");
    setFeatAc("0");
    setFeatAtk("0");
    setFeatDmg("0");
    setFeatDC("0");
    setFeatSpellAtk("0");
    setFeatSkillProficiencies([]);
    setFeatGrantedSpells([]);
    setFeatSpellChoices([]);
    setFeatPrereqAbility({});
    setFeatPrereqLevel("0");
    setFeatPrereqText("");
    setSpellDescription("");
    setSpellLevel("0");
    setSpellSchool("");
    setSpellCastingTime("1 action");
    setSpellRange("");
    setSpellDuration("");
    setSpellRequiresAttackRoll(false);
    setSpellSaveAbility("");
    setSpellDamageDice("");
    setSpellDamageType("");
    setSpellRitual(false);
    setSpellConcentration(false);
    setSpellClasses("");
    setSpellBuffAttackBonus("0");
    setSpellBuffAttackDice("");
    setSpellBuffDamageBonus("0");
    setSpellBuffDamageDice("");
    setSpellBuffDamageType("");
    setSpellBuffConsumption("per-hit");
    setSpellScalingDicePerLevel("");
    setSpellScalingNote("");
    setItemDescription("");
    setItemKind("weapon");
    setItemWeight("0");
    setItemValue("0");
    setItemDamageDice("");
    setItemDamageType("");
    setItemProperties("");
    setItemBaseAC("10");
    setItemDexBonus(false);
    setItemMaxDexBonus("");
    setItemStealthDisadvantage(false);
    setItemArmorCategory("medium");
    setItemCategory("");
    setItemRarity("");
    setItemAcBonus("0");
    setMonsterSize("Medium");
    setMonsterType("beast");
    setMonsterAlignment("unaligned");
    setMonsterCr("1");
    setMonsterXp("0");
    setMonsterAc("10");
    setMonsterHp("10");
    setMonsterHitDice("");
    setMonsterSpeedText("walk:30");
    setMonsterStr("10");
    setMonsterDex("10");
    setMonsterCon("10");
    setMonsterInt("10");
    setMonsterWis("10");
    setMonsterCha("10");
    setMonsterPassivePerception("10");
    setMonsterDarkvision("");
    setMonsterBlindsight("");
    setMonsterTremorsense("");
    setMonsterTruesight("");
    setMonsterLanguages("");
    setMonsterVulnerabilities("");
    setMonsterResistances("");
    setMonsterImmunities("");
    setMonsterConditionImmunities("");
    setMonsterSkillsText("");
    setMonsterSpecialAbilitiesText("");
    setMonsterActionsText("");
    setMonsterLegendaryActionsText("");
    setMonsterLegendaryActionsPerRound("3");
  }

  function startEdit(item: CustomContent) {
    setEditingId(item.id);
    setSystem(item.system);
    setType(item.type);
    setName(item.name);
    if (item.type === "race") {
      // Normalizes legacy string[] traits through the same schema the backend validates
      // against (upgradeTraitStrings), same as the background parse below.
      const d = customRaceDataSchema.parse(item.data);
      const bonuses: Partial<Record<Dnd5eAbility, string>> = {};
      for (const [k, v] of Object.entries(d.abilityBonuses)) bonuses[k as Dnd5eAbility] = String(v);
      setAbilityBonuses(bonuses);
      setRaceAbilityChoicesText(d.abilityBonusChoices.map((c) => c.amount).join(", "));
      setSpeed(String(d.speed));
      setSize(d.size);
      setLanguages(d.languages.join(", "));
      setTraitRows(dataToTraitRows(d.traits));
    } else if (item.type === "class") {
      const d = item.data as {
        hitDie: number;
        casterType: "none" | "prepared" | "known" | "pact";
        levels: { level: number; cantripsKnown?: number; spellsKnown?: number; slots?: Record<string, number>; features?: string[]; martial?: ParsedMartial }[];
        resources?: SubclassResource[];
      };
      setHitDie(String(d.hitDie));
      setCasterType(d.casterType);
      setLevelRows(levelsToRows(d.levels));
      setClassResourceRows(
        (d.resources ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          level: String(r.level),
          uses: String(r.uses),
          recharge: r.recharge,
          note: r.note,
        })),
      );
    } else if (item.type === "background") {
      // Normalizes both legacy flat rows and the new structured shape through the same schema
      // the backend validates against, so the builder never needs its own duplicate shim.
      const d = customBackgroundDataSchema.parse(item.data);
      setBgSkillsFixed(d.skills.fixed);
      setBgSkillChoices(
        d.skills.choices.map((c) => ({
          count: String(c.count),
          kind: c.from.kind,
          skillIds: c.from.kind === "list" ? c.from.skillIds : [],
          abilities: c.from.kind === "ability" ? c.from.abilities : [],
        })),
      );
      setBgToolsFixed(d.tools.fixed.join(", "));
      setBgToolChoices(d.tools.choices.map((c) => ({ count: String(c.count), from: c.from.join(", ") })));
      setBgLanguagesFixed(d.languages.fixed);
      setBgLanguagesAnyCount(String(d.languages.anyCount));
      setBgEquipmentItems(d.equipment.items.join(", "));
      setBgGold(String(d.equipment.gold));
      setBgFeatures(
        d.features.map((f) => ({
          id: f.id,
          name: f.name,
          description: f.description,
          abilityBonuses: Object.fromEntries(
            Object.entries(f.abilityBonuses).map(([k, v]) => [k, String(v)]),
          ) as Partial<Record<Dnd5eAbility, string>>,
          acBonus: String(f.acBonus),
          attackBonus: String(f.attackBonus),
          damageBonus: String(f.damageBonus),
          spellDCBonus: String(f.spellDCBonus),
          spellAttackBonus: String(f.spellAttackBonus),
        })),
      );
      setBgVariants(d.variants);
      setBgVariantPickCount(String(d.variantPickCount));
      // Stored as reference ids; shown as names to edit, matching every other name-typed field
      // here. A ref that no longer resolves (SRD id typo'd, custom feat deleted) is shown as the
      // raw stored string rather than silently dropped, so re-saving the background doesn't lose
      // it -- the unresolved-name warning below will flag it for the author to fix or remove.
      setBgGrantedFeatsText(
        d.grantedFeats
          .map((ref) => {
            if (ref.startsWith("custom-")) {
              const id = Number(ref.slice("custom-".length));
              return visibleFeats.find((f) => f.id === id)?.name ?? ref;
            }
            return SRD_FEATS.find((f) => f.id === ref)?.name ?? ref;
          })
          .join(", "),
      );
    } else if (item.type === "subrace") {
      const d = customSubraceDataSchema.parse(item.data);
      setParentRace(d.parentRace);
      const bonuses: Partial<Record<Dnd5eAbility, string>> = {};
      for (const [k, v] of Object.entries(d.abilityBonuses)) bonuses[k as Dnd5eAbility] = String(v);
      setAbilityBonuses(bonuses);
      setTraitRows(dataToTraitRows(d.traits));
    } else if (item.type === "subclass") {
      const d = item.data as {
        parentClass: string;
        levels: { level: number; features?: string[]; martial?: ParsedMartial }[];
        features?: SubclassFeature[];
        spells?: SubclassSpell[];
        resources?: SubclassResource[];
      };
      setParentClass(d.parentClass);
      setLevelRows(levelsToRows(d.levels));
      setSubclassFeatureRows(
        (d.features ?? []).map((f) => ({
          id: f.id,
          level: String(f.level),
          name: f.name,
          description: f.description,
          abilityBonuses: Object.fromEntries(
            Object.entries(f.abilityBonuses).map(([k, v]) => [k, String(v)]),
          ) as Partial<Record<Dnd5eAbility, string>>,
          acBonus: String(f.acBonus),
          attackBonus: String(f.attackBonus),
          damageBonus: String(f.damageBonus),
          spellDCBonus: String(f.spellDCBonus),
          spellAttackBonus: String(f.spellAttackBonus),
          skillProficiencies: f.skillProficiencies,
          armorText: f.armorProficiencies.join(", "),
          weaponText: f.weaponProficiencies.join(", "),
          toolText: f.toolProficiencies.join(", "),
        })),
      );
      setSubclassSpellRows(
        (d.spells ?? []).map((s) => ({
          id: s.id,
          level: String(s.level),
          name: s.name,
          mode: s.mode,
          atWill: s.atWill,
        })),
      );
      setSubclassResourceRows(
        (d.resources ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          level: String(r.level),
          uses: String(r.uses),
          recharge: r.recharge,
          note: r.note,
        })),
      );
    } else if (item.type === "feat") {
      const d = item.data as {
        description: string;
        abilityBonuses: Partial<Record<Dnd5eAbility, number>>;
        acBonus: number;
        attackBonus: number;
        damageBonus: number;
        spellDCBonus: number;
        spellAttackBonus: number;
        skillProficiencies?: string[];
        grantedSpells?: { name: string; level: number; atWill: boolean }[];
        spellChoices?: SpellChoice[];
        prereqAbility?: Partial<Record<Dnd5eAbility, number>>;
        prereqLevel?: number;
        prereqText?: string;
      };
      setFeatDescription(d.description);
      const bonuses: Partial<Record<Dnd5eAbility, string>> = {};
      for (const [k, v] of Object.entries(d.abilityBonuses)) bonuses[k as Dnd5eAbility] = String(v);
      setAbilityBonuses(bonuses);
      setFeatAc(String(d.acBonus));
      setFeatAtk(String(d.attackBonus));
      setFeatDmg(String(d.damageBonus));
      setFeatDC(String(d.spellDCBonus));
      setFeatSpellAtk(String(d.spellAttackBonus));
      setFeatSkillProficiencies(d.skillProficiencies ?? []);
      setFeatGrantedSpells(
        (d.grantedSpells ?? []).map((gs) => ({ name: gs.name, level: String(gs.level), atWill: gs.atWill })),
      );
      setFeatSpellChoices(
        (d.spellChoices ?? []).map((sc) => ({
          id: `feat-spell-choice-${crypto.randomUUID()}`,
          count: String(sc.count),
          kind: sc.from.kind,
          classId: sc.from.kind === "class" ? sc.from.classId : "wizard",
          srdIdsText: sc.from.kind === "list" ? sc.from.srdIds.join(", ") : "",
          maxLevel: String(sc.maxLevel),
          atWill: sc.atWill,
        })),
      );
      const prereqBonuses: Partial<Record<Dnd5eAbility, string>> = {};
      for (const [k, v] of Object.entries(d.prereqAbility ?? {})) prereqBonuses[k as Dnd5eAbility] = String(v);
      setFeatPrereqAbility(prereqBonuses);
      setFeatPrereqLevel(String(d.prereqLevel ?? 0));
      setFeatPrereqText(d.prereqText ?? "");
    } else if (item.type === "spell") {
      const d = item.data as {
        description?: string;
        level: number;
        school: string;
        castingTime: string;
        range: string;
        duration: string;
        requiresAttackRoll: boolean;
        saveAbility?: Dnd5eAbility;
        damageDice?: string;
        damageType?: string;
        ritual: boolean;
        concentration?: boolean;
        classes: string[];
        buff?: {
          attackBonus: number;
          attackDice: string;
          damageBonus: number;
          damageDice: string;
          damageType: string;
          consumption: "per-hit" | "once";
        };
        scalingDicePerLevel?: string;
        scalingNote?: string;
      };
      setSpellDescription(d.description ?? "");
      setSpellLevel(String(d.level));
      setSpellSchool(d.school);
      setSpellCastingTime(d.castingTime);
      setSpellRange(d.range);
      setSpellDuration(d.duration);
      setSpellRequiresAttackRoll(d.requiresAttackRoll);
      setSpellSaveAbility(d.saveAbility ?? "");
      setSpellDamageDice(d.damageDice ?? "");
      setSpellDamageType(d.damageType ?? "");
      setSpellRitual(d.ritual);
      setSpellConcentration(d.concentration ?? false);
      setSpellClasses(d.classes.join(", "));
      setSpellBuffAttackBonus(String(d.buff?.attackBonus ?? 0));
      setSpellBuffAttackDice(d.buff?.attackDice ?? "");
      setSpellBuffDamageBonus(String(d.buff?.damageBonus ?? 0));
      setSpellBuffDamageDice(d.buff?.damageDice ?? "");
      setSpellBuffDamageType(d.buff?.damageType ?? "");
      setSpellBuffConsumption(d.buff?.consumption ?? "per-hit");
      setSpellScalingDicePerLevel(d.scalingDicePerLevel ?? "");
      setSpellScalingNote(d.scalingNote ?? "");
    } else if (item.type === "item") {
      const d = item.data as {
        description?: string;
        kind: "weapon" | "armor" | "gear" | "magic";
        weight: number;
        value: number;
        damageDice: string;
        damageType: string;
        properties: string[];
        baseAC: number;
        dexBonus: boolean;
        maxDexBonus?: number;
        stealthDisadvantage: boolean;
        armorCategory?: "light" | "medium" | "heavy" | "shield";
        category: string;
        rarity: string;
        abilityBonuses: Partial<Record<Dnd5eAbility, number>>;
        acBonus: number;
      };
      setItemDescription(d.description ?? "");
      setItemKind(d.kind);
      setItemWeight(String(d.weight));
      setItemValue(String(d.value));
      setItemDamageDice(d.damageDice);
      setItemDamageType(d.damageType);
      setItemProperties(d.properties.join(", "));
      setItemBaseAC(String(d.baseAC));
      setItemDexBonus(d.dexBonus);
      setItemMaxDexBonus(d.maxDexBonus !== undefined ? String(d.maxDexBonus) : "");
      setItemStealthDisadvantage(d.stealthDisadvantage);
      setItemArmorCategory(d.armorCategory ?? "medium");
      setItemCategory(d.category);
      setItemRarity(d.rarity);
      const bonuses: Partial<Record<Dnd5eAbility, string>> = {};
      for (const [k, v] of Object.entries(d.abilityBonuses)) bonuses[k as Dnd5eAbility] = String(v);
      setAbilityBonuses(bonuses);
      setItemAcBonus(String(d.acBonus));
    } else {
      const d = item.data as {
        size: string;
        type: string;
        alignment: string;
        cr: number;
        xp: number;
        ac: number;
        hp: number;
        hitDice: string;
        speed: Record<string, number | undefined>;
        str: number;
        dex: number;
        con: number;
        int: number;
        wis: number;
        cha: number;
        passivePerception: number;
        darkvision?: number;
        blindsight?: number;
        tremorsense?: number;
        truesight?: number;
        languages: string;
        damageVulnerabilities: string[];
        damageResistances: string[];
        damageImmunities: string[];
        conditionImmunities: string[];
        skills?: MonsterSkill[];
        specialAbilities: MonsterSpecialAbility[];
        actions: MonsterAction[];
        legendaryActions?: MonsterLegendaryAction[];
        legendaryActionsPerRound?: number;
      };
      setMonsterSize(d.size);
      setMonsterType(d.type);
      setMonsterAlignment(d.alignment);
      setMonsterCr(String(d.cr));
      setMonsterXp(String(d.xp));
      setMonsterAc(String(d.ac));
      setMonsterHp(String(d.hp));
      setMonsterHitDice(d.hitDice);
      setMonsterSpeedText(speedToText(d.speed));
      setMonsterStr(String(d.str));
      setMonsterDex(String(d.dex));
      setMonsterCon(String(d.con));
      setMonsterInt(String(d.int));
      setMonsterWis(String(d.wis));
      setMonsterCha(String(d.cha));
      setMonsterPassivePerception(String(d.passivePerception));
      setMonsterDarkvision(d.darkvision !== undefined ? String(d.darkvision) : "");
      setMonsterBlindsight(d.blindsight !== undefined ? String(d.blindsight) : "");
      setMonsterTremorsense(d.tremorsense !== undefined ? String(d.tremorsense) : "");
      setMonsterTruesight(d.truesight !== undefined ? String(d.truesight) : "");
      setMonsterLanguages(d.languages);
      setMonsterVulnerabilities(d.damageVulnerabilities.join(", "));
      setMonsterResistances(d.damageResistances.join(", "));
      setMonsterImmunities(d.damageImmunities.join(", "));
      setMonsterConditionImmunities(d.conditionImmunities.join(", "));
      setMonsterSkillsText(skillsToText(d.skills ?? []));
      setMonsterSpecialAbilitiesText(specialAbilitiesToText(d.specialAbilities));
      setMonsterActionsText(actionsToText(d.actions));
      setMonsterLegendaryActionsText(legendaryActionsToText(d.legendaryActions ?? []));
      setMonsterLegendaryActionsPerRound(String(d.legendaryActionsPerRound ?? 3));
    }
  }

  // Builds the structured background payload from the form fields -- shared by handleSubmit
  // (to save) and the live preview (to render), so the two can never drift apart.
  function buildBackgroundData(): CustomBackgroundData {
    return {
      skills: {
        fixed: bgSkillsFixed,
        choices: bgSkillChoices
          .filter((c) => c.kind === "any" || (c.kind === "list" ? c.skillIds.length > 0 : c.abilities.length > 0))
          .map((c) => ({
            count: Number(c.count) || 1,
            from:
              c.kind === "list"
                ? { kind: "list" as const, skillIds: c.skillIds }
                : c.kind === "ability"
                  ? { kind: "ability" as const, abilities: c.abilities }
                  : { kind: "any" as const },
          })),
      },
      tools: {
        fixed: bgToolsFixed.split(",").map((s) => s.trim()).filter(Boolean),
        choices: bgToolChoices
          .filter((c) => c.from.trim() !== "")
          .map((c) => ({ count: Number(c.count) || 1, from: c.from.split(",").map((s) => s.trim()).filter(Boolean) })),
      },
      languages: { fixed: bgLanguagesFixed, anyCount: Number(bgLanguagesAnyCount) || 0 },
      equipment: {
        items: bgEquipmentItems.split(",").map((s) => s.trim()).filter(Boolean),
        gold: Number(bgGold) || 0,
      },
      features: bgFeatures
        .filter((f) => f.name.trim() !== "")
        .map((f) => ({
          id: f.id,
          name: f.name.trim(),
          description: f.description.trim(),
          abilityBonuses: Object.fromEntries(
            Object.entries(f.abilityBonuses)
              .map(([k, v]) => [k, Number(v) || 0])
              .filter(([, v]) => v !== 0),
          ),
          acBonus: Number(f.acBonus) || 0,
          attackBonus: Number(f.attackBonus) || 0,
          damageBonus: Number(f.damageBonus) || 0,
          spellDCBonus: Number(f.spellDCBonus) || 0,
          spellAttackBonus: Number(f.spellAttackBonus) || 0,
        })),
      variants: bgVariants.filter((v) => v.title.trim() !== ""),
      variantPickCount: Number(bgVariantPickCount) || 1,
      grantedFeats: bgGrantedFeatsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((name) => resolveFeatId(name) ?? name),
    };
  }

  // Clones an SRD background's fixed grants into the form fields as a starting point to tweak.
  function cloneSrdBackground(name: string) {
    const src = SRD_BACKGROUNDS.find((b) => b.name === name);
    if (!src) return;
    setBgSkillsFixed(src.skillProficiencies);
    setBgSkillChoices([]);
    setBgFeatures([{ ...emptyBgFeatureRow(), name: src.feature }]);
  }

  async function handleSubmit() {
    setError(null);
    try {
      const abilityBonusesObj = Object.fromEntries(
        Object.entries(abilityBonuses).filter(([, v]) => v && v.trim() !== "").map(([k, v]) => [k, Number(v)]),
      );
      const traitsArr = traitRowsToData(traitRows);

      let data: unknown;
      if (type === "race") {
        data = {
          abilityBonuses: abilityBonusesObj,
          abilityBonusChoices: splitCsv(raceAbilityChoicesText)
            .map((s) => Number(s))
            .filter((n) => Number.isFinite(n) && n > 0)
            .map((amount) => ({ amount })),
          speed: Number(speed) || 30,
          size,
          languages: languages.split(",").map((s) => s.trim()).filter(Boolean),
          traits: traitsArr,
        };
      } else if (type === "class") {
        data = {
          hitDie: Number(hitDie),
          casterType,
          levels: rowsToLevels(levelRows),
          resources: resourceRowsToData(classResourceRows),
        };
      } else if (type === "background") {
        data = buildBackgroundData();
      } else if (type === "subrace") {
        data = { parentRace: parentRace.trim(), abilityBonuses: abilityBonusesObj, speed: 0, traits: traitsArr };
      } else if (type === "subclass") {
        data = {
          parentClass: parentClass.trim(),
          levels: rowsToLevels(levelRows),
          features: subclassFeatureRows
            .filter((f) => f.name.trim() !== "")
            .map((f) => ({
              id: f.id,
              level: Number(f.level) || 1,
              name: f.name.trim(),
              description: f.description.trim(),
              abilityBonuses: Object.fromEntries(
                Object.entries(f.abilityBonuses)
                  .map(([k, v]) => [k, Number(v) || 0])
                  .filter(([, v]) => v !== 0),
              ),
              acBonus: Number(f.acBonus) || 0,
              attackBonus: Number(f.attackBonus) || 0,
              damageBonus: Number(f.damageBonus) || 0,
              spellDCBonus: Number(f.spellDCBonus) || 0,
              spellAttackBonus: Number(f.spellAttackBonus) || 0,
              skillProficiencies: f.skillProficiencies,
              armorProficiencies: splitCsv(f.armorText),
              weaponProficiencies: splitCsv(f.weaponText),
              toolProficiencies: splitCsv(f.toolText),
            })),
          spells: subclassSpellRows
            .filter((s) => s.name.trim() !== "")
            .map((s) => {
              const resolved = resolveSpellName(s.name);
              return {
                id: s.id,
                level: Number(s.level) || 1,
                srdId: resolved?.srdId ?? "",
                name: s.name.trim(),
                spellLevel: resolved?.level ?? 0,
                mode: s.mode,
                atWill: s.atWill,
              };
            }),
          resources: resourceRowsToData(subclassResourceRows),
        };
      } else if (type === "feat") {
        data = {
          description: featDescription.trim(),
          abilityBonuses: abilityBonusesObj,
          acBonus: Number(featAc) || 0,
          attackBonus: Number(featAtk) || 0,
          damageBonus: Number(featDmg) || 0,
          spellDCBonus: Number(featDC) || 0,
          spellAttackBonus: Number(featSpellAtk) || 0,
          skillProficiencies: featSkillProficiencies,
          grantedSpells: featGrantedSpells
            .filter((r) => r.name.trim() !== "")
            .map((r) => {
              const resolved = resolveSpellName(r.name);
              return {
                name: r.name.trim(),
                srdId: resolved?.srdId,
                level: resolved?.level ?? (Number(r.level) || 0),
                atWill: r.atWill,
              };
            }),
          spellChoices: featSpellChoices
            .filter((r) => Number(r.count) > 0 && (r.kind !== "list" || r.srdIdsText.trim() !== ""))
            .map((r) => ({
              count: Number(r.count) || 1,
              from:
                r.kind === "class"
                  ? { kind: "class" as const, classId: r.classId.trim().toLowerCase() }
                  : r.kind === "list"
                    ? {
                        kind: "list" as const,
                        srdIds: r.srdIdsText
                          .split(",")
                          .map((s) => s.trim())
                          .filter((s) => s !== ""),
                      }
                    : { kind: "any" as const },
              maxLevel: Number(r.maxLevel) || 0,
              atWill: r.atWill,
            })),
          prereqAbility: Object.fromEntries(
            Object.entries(featPrereqAbility).map(([k, v]) => [k, Number(v) || 0]).filter(([, v]) => v !== 0),
          ),
          prereqLevel: Number(featPrereqLevel) || 0,
          prereqText: featPrereqText.trim(),
        };
      } else if (type === "spell") {
        data = {
          description: spellDescription.trim(),
          level: Number(spellLevel) || 0,
          school: spellSchool.trim(),
          castingTime: spellCastingTime.trim(),
          range: spellRange.trim(),
          duration: spellDuration.trim(),
          requiresAttackRoll: spellRequiresAttackRoll,
          saveAbility: spellSaveAbility || undefined,
          damageDice: spellDamageDice.trim() || undefined,
          damageType: spellDamageType.trim() || undefined,
          ritual: spellRitual,
          concentration: spellConcentration,
          classes: spellClasses.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
          buff: {
            attackBonus: Number(spellBuffAttackBonus) || 0,
            attackDice: spellBuffAttackDice.trim(),
            damageBonus: Number(spellBuffDamageBonus) || 0,
            damageDice: spellBuffDamageDice.trim(),
            damageType: spellBuffDamageType.trim(),
            consumption: spellBuffConsumption,
          },
          scalingDicePerLevel: spellScalingDicePerLevel.trim(),
          scalingNote: spellScalingNote.trim(),
        };
      } else if (type === "item") {
        data = {
          description: itemDescription.trim(),
          kind: itemKind,
          weight: Number(itemWeight) || 0,
          value: Number(itemValue) || 0,
          damageDice: itemDamageDice.trim(),
          damageType: itemDamageType.trim(),
          properties: itemProperties.split(",").map((s) => s.trim()).filter(Boolean),
          baseAC: Number(itemBaseAC) || 0,
          dexBonus: itemDexBonus,
          maxDexBonus: itemMaxDexBonus.trim() ? Number(itemMaxDexBonus) : undefined,
          stealthDisadvantage: itemStealthDisadvantage,
          armorCategory: itemArmorCategory,
          category: itemCategory.trim(),
          rarity: itemRarity.trim(),
          abilityBonuses: abilityBonusesObj,
          acBonus: Number(itemAcBonus) || 0,
        };
      } else {
        data = {
          size: monsterSize.trim(),
          type: monsterType.trim(),
          alignment: monsterAlignment.trim(),
          cr: Number(monsterCr) || 0,
          xp: Number(monsterXp) || 0,
          ac: Number(monsterAc) || 10,
          hp: Number(monsterHp) || 1,
          hitDice: monsterHitDice.trim(),
          speed: parseSpeedText(monsterSpeedText),
          str: Number(monsterStr) || 10,
          dex: Number(monsterDex) || 10,
          con: Number(monsterCon) || 10,
          int: Number(monsterInt) || 10,
          wis: Number(monsterWis) || 10,
          cha: Number(monsterCha) || 10,
          passivePerception: Number(monsterPassivePerception) || 10,
          darkvision: monsterDarkvision.trim() ? Number(monsterDarkvision) : undefined,
          blindsight: monsterBlindsight.trim() ? Number(monsterBlindsight) : undefined,
          tremorsense: monsterTremorsense.trim() ? Number(monsterTremorsense) : undefined,
          truesight: monsterTruesight.trim() ? Number(monsterTruesight) : undefined,
          languages: monsterLanguages.trim(),
          damageVulnerabilities: monsterVulnerabilities.split(",").map((s) => s.trim()).filter(Boolean),
          damageResistances: monsterResistances.split(",").map((s) => s.trim()).filter(Boolean),
          damageImmunities: monsterImmunities.split(",").map((s) => s.trim()).filter(Boolean),
          conditionImmunities: monsterConditionImmunities.split(",").map((s) => s.trim()).filter(Boolean),
          skills: parseSkillsText(monsterSkillsText),
          specialAbilities: parseSpecialAbilitiesText(monsterSpecialAbilitiesText),
          actions: parseActionsText(monsterActionsText),
          legendaryActions: parseLegendaryActionsText(monsterLegendaryActionsText),
          legendaryActionsPerRound: Number(monsterLegendaryActionsPerRound) || 3,
        };
      }

      if (editingId !== null) {
        await customContentApi.updateCustomContent(editingId, { name, data });
      } else {
        await customContentApi.createCustomContent(type, system, name, data);
      }
      resetForm();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function handleDelete(id: number) {
    setError(null);
    try {
      await customContentApi.deleteCustomContent(id);
      if (editingId === id) resetForm();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  // Admin "All items" row Edit (#134) -- the row only carries the lean AdminContentSummary shape,
  // so the full item (with `data`) is fetched by id before handing it to the normal startEdit path.
  async function startEditById(id: number) {
    setError(null);
    try {
      const item = await customContentApi.getCustomContent(id);
      startEdit(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load item");
    }
  }

  // Repeatable trait-card editor (#124) -- shared by the race and subrace forms, same as
  // abilityBonuses, since traitRows is one state array reused between them.
  function renderTraitRows() {
    return (
      <div style={{ marginTop: "0.5rem" }}>
        <h4 style={{ marginBottom: "0.25rem" }}>Traits</h4>
        {traitRows.map((row, i) => (
          <div key={row.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "0.5rem", marginBottom: "0.4rem" }}>
            <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
              <input
                placeholder="Trait name, e.g. Darkvision"
                value={row.name}
                onChange={(e) => setTraitRows((prev) => prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                style={{ flex: 1, minWidth: "10rem" }}
              />
              <label title="Darkvision range in feet, 0 = none">
                Darkvision{" "}
                <input
                  type="number"
                  min={0}
                  max={120}
                  value={row.darkvisionFeet}
                  onChange={(e) =>
                    setTraitRows((prev) => prev.map((r, j) => (j === i ? { ...r, darkvisionFeet: e.target.value } : r)))
                  }
                  style={{ width: "4rem" }}
                />{" "}
                ft
              </label>
              <label title="Extra weapon damage dice added (not doubled) on a crit, e.g. a Savage-Attacks-alike">
                Extra crit dice{" "}
                <input
                  type="number"
                  min={0}
                  max={3}
                  value={row.extraCritDice}
                  onChange={(e) =>
                    setTraitRows((prev) => prev.map((r, j) => (j === i ? { ...r, extraCritDice: e.target.value } : r)))
                  }
                  style={{ width: "3rem" }}
                />
              </label>
              <button type="button" onClick={() => setTraitRows((prev) => prev.filter((_, j) => j !== i))}>
                Remove
              </button>
            </div>
            <textarea
              placeholder="Description"
              value={row.description}
              onChange={(e) => setTraitRows((prev) => prev.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))}
              rows={2}
              style={{ width: "100%", marginTop: "0.3rem" }}
            />
            <input
              placeholder="Damage resistances (comma-separated, e.g. fire, poison)"
              value={row.damageResistancesText}
              onChange={(e) =>
                setTraitRows((prev) => prev.map((r, j) => (j === i ? { ...r, damageResistancesText: e.target.value } : r)))
              }
              style={{ width: "100%", marginTop: "0.3rem" }}
            />
            <textarea
              placeholder={"Granted spells, one per line: Name | atWill(yes/no) -- e.g.\nThaumaturgy | yes\nHellish Rebuke | no"}
              value={row.grantedSpellsText}
              onChange={(e) =>
                setTraitRows((prev) => prev.map((r, j) => (j === i ? { ...r, grantedSpellsText: e.target.value } : r)))
              }
              rows={2}
              style={{ width: "100%", marginTop: "0.3rem" }}
            />
          </div>
        ))}
        <button type="button" onClick={() => setTraitRows((prev) => [...prev, emptyTraitRow()])}>
          Add trait
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "1rem" }}>
      <button onClick={onBack}>← Back</button>
      <h2>My custom content (races, subraces, classes, subclasses, backgrounds, feats)</h2>
      <p>
        <small>
          Usable on your own characters and any campaign you DM right away. An admin must approve an item before
          everyone else can use it too.
        </small>
      </p>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div style={box}>
        <h3>{isAdmin ? "All items" : "My items"}</h3>
        {isAdmin ? (
          <>
            {allContentSummaries.length === 0 && <p>None yet.</p>}
            {allContentSummaries.map((item) => (
              <div
                key={item.id}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.3rem 0", borderBottom: "1px solid var(--border-faint)" }}
              >
                <span>
                  <strong>{item.name}</strong> ({SYSTEM_LABELS[item.system]} {TYPE_LABELS[item.type]}) — {item.status} — by{" "}
                  {item.createdByUsername}
                </span>
                <span>
                  <button type="button" onClick={() => startEditById(item.id)}>
                    Edit
                  </button>{" "}
                  <button type="button" onClick={() => handleDelete(item.id)}>
                    Delete
                  </button>
                </span>
              </div>
            ))}
          </>
        ) : (
          <>
            {items.length === 0 && <p>None yet.</p>}
            {items.map((item) => (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.3rem 0", borderBottom: "1px solid var(--border-faint)" }}>
                <span>
                  <strong>{item.name}</strong> ({SYSTEM_LABELS[item.system]} {TYPE_LABELS[item.type]}) — {item.status}
                </span>
                <span>
                  <button type="button" onClick={() => startEdit(item)}>
                    Edit
                  </button>{" "}
                  <button type="button" onClick={() => handleDelete(item.id)}>
                    Delete
                  </button>
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      <div style={box}>
        <h3>Import a pack</h3>
        <p style={{ margin: "0 0 0.5rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Upload or paste a JSON array of <code>{"{ type, name, data }"}</code> objects, validated against the same
          per-type rules as the form below. All rows import into the <strong>System</strong> selected below (currently{" "}
          <strong>{SYSTEM_LABELS[system]}</strong>). Re-importing a corrected pack updates rows that match an
          existing item of yours by name instead of duplicating them.
        </p>
        <input
          type="file"
          accept="application/json"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
            e.target.value = "";
          }}
        />
        <div style={{ marginTop: "0.4rem" }}>
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            rows={6}
            style={{ width: "100%", fontFamily: "monospace", fontSize: "0.85rem" }}
            placeholder='[&#10;  { "type": "spell", "name": "Wrathful Smite", "data": { "level": 1, ... } }&#10;]'
          />
        </div>
        <button type="button" onClick={handleImport} disabled={importBusy || !importText.trim()} style={{ marginTop: "0.4rem" }}>
          {importBusy ? "Importing…" : "Import"}
        </button>
        {importError && <p style={{ color: "var(--danger)" }}>{importError}</p>}
        {importResults && (
          <div style={{ marginTop: "0.5rem" }}>
            <p>
              <small>
                {importResults.filter((r) => r.status === "created").length} created,{" "}
                {importResults.filter((r) => r.status === "updated").length} updated,{" "}
                {importResults.filter((r) => r.status === "error").length} failed.
              </small>
            </p>
            {importResults.map((r) => (
              <div key={r.index} style={{ fontSize: "0.85rem", padding: "0.15rem 0" }}>
                {r.status === "error" ? (
                  <span style={{ color: "var(--danger)" }}>
                    ✗ Row {r.index + 1} ({r.name || "unnamed"}): {r.error}
                    {r.issues && r.issues.length > 0 && (
                      <> — {r.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}</>
                    )}
                  </span>
                ) : (
                  <span style={{ color: "var(--success)" }}>
                    ✓ Row {r.index + 1} ({r.name}): {r.status}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={box}>
        <h3>{editingId !== null ? "Edit item" : "New item"}</h3>
        {editingId === null && (
          <>
            <label>
              System{" "}
              <select value={system} onChange={(e) => changeSystem(e.target.value as CustomContentSystem)}>
                {SYSTEM_IDS.map((s) => (
                  <option key={s} value={s}>
                    {SYSTEM_LABELS[s as CustomContentSystem]}
                  </option>
                ))}
              </select>
            </label>{" "}
            {validTypes.length > 0 && (
              <label>
                Type{" "}
                <select value={type} onChange={(e) => setType(e.target.value as CustomContentType)}>
                  {validTypes.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </>
        )}

        {validTypes.length === 0 ? (
          <p style={{ marginTop: "0.75rem", color: "var(--text-muted)" }}>
            No custom content types are available for {SYSTEM_LABELS[system]} yet.
          </p>
        ) : (
          <>
            <div style={{ marginTop: "0.5rem" }}>
              <label>
                Name <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
            </div>

            {type === "race" ? (
          <>
            <h4>Ability score bonuses (race)</h4>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {DND5E_ABILITIES.map((a) => (
                <label key={a}>
                  {DND5E_ABILITY_NAMES[a]}{" "}
                  <input
                    type="number"
                    style={{ width: "3rem" }}
                    value={abilityBonuses[a] ?? ""}
                    onChange={(e) => setAbilityBonuses((prev) => ({ ...prev, [a]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <div style={{ marginTop: "0.5rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <label>
                Speed <input type="number" style={{ width: "4rem" }} value={speed} onChange={(e) => setSpeed(e.target.value)} />
              </label>
              <label>
                Size <input value={size} onChange={(e) => setSize(e.target.value)} style={{ width: "6rem" }} />
              </label>
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              <label style={{ display: "block" }}>
                Languages (comma-separated)
                <br />
                <input value={languages} onChange={(e) => setLanguages(e.target.value)} style={{ width: "100%" }} />
              </label>
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              <label style={{ display: "block" }} title='"+2 to one ability of your choice, +1 to another" -- each amount is a separate slot resolved during character creation, on top of the fixed bonuses above'>
                Flexible ability bonuses (comma-separated amounts, e.g. "2, 1")
                <br />
                <input
                  value={raceAbilityChoicesText}
                  onChange={(e) => setRaceAbilityChoicesText(e.target.value)}
                  style={{ width: "100%" }}
                />
              </label>
            </div>
            {renderTraitRows()}
          </>
        ) : type === "class" ? (
          <>
            <div style={{ marginTop: "0.5rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <label>
                Hit die{" "}
                <select value={hitDie} onChange={(e) => setHitDie(e.target.value)}>
                  <option value="6">d6</option>
                  <option value="8">d8</option>
                  <option value="10">d10</option>
                  <option value="12">d12</option>
                </select>
              </label>
              <label>
                Caster type{" "}
                <select value={casterType} onChange={(e) => setCasterType(e.target.value as typeof casterType)}>
                  <option value="none">None</option>
                  <option value="prepared">Prepared (like Cleric/Druid)</option>
                  <option value="known">Known (like Bard/Sorcerer)</option>
                  <option value="pact">Pact (like Warlock)</option>
                </select>
              </label>
            </div>

            <h4 style={{ marginTop: "1rem" }}>Level progression</h4>
            <p>
              <small>
                Slots format: "1:4, 2:3" (slot level : total). Features: comma-separated names. Martial: key:value
                pairs — extraAttacks, actionSurges, indomitableUses, rageCount, rageDamageBonus, brutalCriticalDice,
                kiPoints, unarmoredMovement, auraRange, favoredEnemies, favoredTerrain (numbers), sneakAttack /
                martialArts (dice, e.g. "sneakAttack:1d6").
              </small>
            </p>
            {levelRows.map((row, i) => (
              <div key={i} style={{ display: "flex", gap: "0.4rem", marginBottom: "0.3rem", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="number"
                  min={1}
                  max={20}
                  placeholder="Lvl"
                  value={row.level}
                  onChange={(e) => setLevelRows((prev) => prev.map((r, j) => (j === i ? { ...r, level: e.target.value } : r)))}
                  style={{ width: "3rem" }}
                  title="Level"
                />
                <input
                  type="number"
                  placeholder="Cantrips"
                  value={row.cantripsKnown}
                  onChange={(e) => setLevelRows((prev) => prev.map((r, j) => (j === i ? { ...r, cantripsKnown: e.target.value } : r)))}
                  style={{ width: "4.5rem" }}
                  title="Cantrips known"
                />
                <input
                  type="number"
                  placeholder="Spells"
                  value={row.spellsKnown}
                  onChange={(e) => setLevelRows((prev) => prev.map((r, j) => (j === i ? { ...r, spellsKnown: e.target.value } : r)))}
                  style={{ width: "4.5rem" }}
                  title="Spells known"
                />
                <input
                  placeholder="Slots e.g. 1:4, 2:3"
                  value={row.slotsText}
                  onChange={(e) => setLevelRows((prev) => prev.map((r, j) => (j === i ? { ...r, slotsText: e.target.value } : r)))}
                  style={{ width: "9rem" }}
                />
                <input
                  placeholder="Features (comma-separated)"
                  value={row.featuresText}
                  onChange={(e) => setLevelRows((prev) => prev.map((r, j) => (j === i ? { ...r, featuresText: e.target.value } : r)))}
                  style={{ flex: 1, minWidth: "10rem" }}
                />
                <input
                  placeholder="Martial e.g. rageCount:2, rageDamageBonus:2"
                  value={row.martialText}
                  onChange={(e) => setLevelRows((prev) => prev.map((r, j) => (j === i ? { ...r, martialText: e.target.value } : r)))}
                  style={{ flex: 1, minWidth: "14rem" }}
                  title="Martial features"
                />
                <button type="button" onClick={() => setLevelRows((prev) => prev.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const nextLevel = levelRows.length > 0 ? Math.max(...levelRows.map((r) => Number(r.level) || 0)) + 1 : 1;
                setLevelRows((prev) => [...prev, emptyLevelRow(Math.min(20, nextLevel))]);
              }}
            >
              Add level
            </button>

            <h4 style={{ marginTop: "1.2rem" }}>Limited-use resources</h4>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Gets a spend/reset counter on the sheet that clears on the matching rest, alongside Rage and Ki -- e.g.
              an Artificer's infusions or a Blood Hunter's hemocraft die.
            </p>
            {classResourceRows.map((row, i) => (
              <div key={row.id} style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.4rem" }}>
                <label>
                  Lvl{" "}
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={row.level}
                    onChange={(e) => setClassResourceRows((prev) => prev.map((r, j) => (j === i ? { ...r, level: e.target.value } : r)))}
                    style={{ width: "3rem" }}
                  />
                </label>
                <input
                  placeholder="Resource name (e.g. Infusions)"
                  value={row.name}
                  onChange={(e) => setClassResourceRows((prev) => prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                  style={{ flex: 1, minWidth: "10rem" }}
                />
                <label>
                  Uses{" "}
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={row.uses}
                    onChange={(e) => setClassResourceRows((prev) => prev.map((r, j) => (j === i ? { ...r, uses: e.target.value } : r)))}
                    style={{ width: "3rem" }}
                  />
                </label>
                <select
                  value={row.recharge}
                  onChange={(e) =>
                    setClassResourceRows((prev) =>
                      prev.map((r, j) => (j === i ? { ...r, recharge: e.target.value as ResourceRow["recharge"] } : r)),
                    )
                  }
                >
                  <option value="short">Per short rest</option>
                  <option value="long">Per long rest</option>
                </select>
                <input
                  placeholder="Note (optional)"
                  value={row.note}
                  onChange={(e) => setClassResourceRows((prev) => prev.map((r, j) => (j === i ? { ...r, note: e.target.value } : r)))}
                  style={{ flex: 1, minWidth: "8rem" }}
                />
                <button type="button" onClick={() => setClassResourceRows((prev) => prev.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setClassResourceRows((prev) => [...prev, emptyResourceRow("class")])}
              style={{ marginTop: "0.4rem" }}
            >
              Add resource
            </button>
          </>
        ) : type === "background" ? (
          <>
            {editingId === null && (
              <div style={{ marginTop: "0.5rem" }}>
                <label>
                  Start from an SRD background (optional){" "}
                  <select
                    value={bgCloneFrom}
                    onChange={(e) => {
                      setBgCloneFrom(e.target.value);
                      if (e.target.value) cloneSrdBackground(e.target.value);
                    }}
                  >
                    <option value="">— none —</option>
                    {SRD_BACKGROUNDS.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            <h4 style={{ marginTop: "1rem" }}>Skill proficiencies</h4>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", fontSize: "0.9rem" }}>
              {DND5E_SKILLS.map((s) => (
                <label key={s.id}>
                  <input
                    type="checkbox"
                    checked={bgSkillsFixed.includes(s.id)}
                    onChange={(e) =>
                      setBgSkillsFixed((prev) => (e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)))
                    }
                  />{" "}
                  {s.name}
                </label>
              ))}
            </div>
            {bgSkillChoices.map((row, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start", flexWrap: "wrap", marginTop: "0.4rem" }}>
                <span>Choose</span>
                <input
                  type="number"
                  min={1}
                  value={row.count}
                  onChange={(e) => setBgSkillChoices((prev) => prev.map((r, j) => (j === i ? { ...r, count: e.target.value } : r)))}
                  style={{ width: "3rem" }}
                />
                <select
                  value={row.kind}
                  onChange={(e) =>
                    setBgSkillChoices((prev) =>
                      prev.map((r, j) => (j === i ? { ...r, kind: e.target.value as BgSkillChoiceRow["kind"] } : r)),
                    )
                  }
                >
                  <option value="ability">from an ability group</option>
                  <option value="list">from a specific list</option>
                  <option value="any">any skill</option>
                </select>
                {row.kind === "ability" && (
                  <span style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
                    {DND5E_ABILITIES.map((a) => (
                      <label key={a} style={{ fontSize: "0.85rem" }}>
                        <input
                          type="checkbox"
                          checked={row.abilities.includes(a)}
                          onChange={(e) =>
                            setBgSkillChoices((prev) =>
                              prev.map((r, j) =>
                                j === i
                                  ? { ...r, abilities: e.target.checked ? [...r.abilities, a] : r.abilities.filter((x) => x !== a) }
                                  : r,
                              ),
                            )
                          }
                        />{" "}
                        {DND5E_ABILITY_NAMES[a]}
                      </label>
                    ))}
                  </span>
                )}
                {row.kind === "list" && (
                  <span style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", maxWidth: "24rem" }}>
                    {DND5E_SKILLS.map((s) => (
                      <label key={s.id} style={{ fontSize: "0.85rem" }}>
                        <input
                          type="checkbox"
                          checked={row.skillIds.includes(s.id)}
                          onChange={(e) =>
                            setBgSkillChoices((prev) =>
                              prev.map((r, j) =>
                                j === i
                                  ? { ...r, skillIds: e.target.checked ? [...r.skillIds, s.id] : r.skillIds.filter((x) => x !== s.id) }
                                  : r,
                              ),
                            )
                          }
                        />{" "}
                        {s.name}
                      </label>
                    ))}
                  </span>
                )}
                <button type="button" onClick={() => setBgSkillChoices((prev) => prev.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setBgSkillChoices((prev) => [...prev, emptyBgSkillChoiceRow()])} style={{ marginTop: "0.4rem" }}>
              Add skill choice
            </button>

            <h4 style={{ marginTop: "1rem" }}>Tool proficiencies</h4>
            <label style={{ display: "block" }}>
              Fixed (comma-separated, e.g. "Thieves' tools") — leave blank for "None"
              <input value={bgToolsFixed} onChange={(e) => setBgToolsFixed(e.target.value)} style={{ width: "100%" }} />
            </label>
            {bgToolChoices.map((row, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.4rem" }}>
                <span>Choose</span>
                <input
                  type="number"
                  min={1}
                  value={row.count}
                  onChange={(e) => setBgToolChoices((prev) => prev.map((r, j) => (j === i ? { ...r, count: e.target.value } : r)))}
                  style={{ width: "3rem" }}
                />
                <span>from</span>
                <input
                  placeholder="comma-separated, e.g. one type of gaming set, one musical instrument"
                  value={row.from}
                  onChange={(e) => setBgToolChoices((prev) => prev.map((r, j) => (j === i ? { ...r, from: e.target.value } : r)))}
                  style={{ flex: 1 }}
                />
                <button type="button" onClick={() => setBgToolChoices((prev) => prev.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setBgToolChoices((prev) => [...prev, emptyBgToolChoiceRow()])} style={{ marginTop: "0.4rem" }}>
              Add tool choice
            </button>

            <h4 style={{ marginTop: "1rem" }}>Languages</h4>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", fontSize: "0.9rem" }}>
              {DND5E_LANGUAGES.map((lang) => (
                <label key={lang}>
                  <input
                    type="checkbox"
                    checked={bgLanguagesFixed.includes(lang)}
                    onChange={(e) =>
                      setBgLanguagesFixed((prev) => (e.target.checked ? [...prev, lang] : prev.filter((l) => l !== lang)))
                    }
                  />{" "}
                  {lang}
                </label>
              ))}
            </div>
            <label style={{ marginTop: "0.4rem", display: "inline-block" }}>
              Plus{" "}
              <input
                type="number"
                min={0}
                value={bgLanguagesAnyCount}
                onChange={(e) => setBgLanguagesAnyCount(e.target.value)}
                style={{ width: "3rem" }}
              />{" "}
              of your choice
            </label>

            <h4 style={{ marginTop: "1rem" }}>Equipment</h4>
            <label style={{ display: "block" }}>
              Items (comma-separated)
              <input value={bgEquipmentItems} onChange={(e) => setBgEquipmentItems(e.target.value)} style={{ width: "100%" }} />
            </label>
            <label style={{ marginTop: "0.4rem", display: "inline-block" }}>
              Starting gold <input type="number" min={0} value={bgGold} onChange={(e) => setBgGold(e.target.value)} style={{ width: "5rem" }} />
            </label>

            <h4 style={{ marginTop: "1rem" }}>Granted feats (optional)</h4>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Feats this background grants outright at character creation -- comma-separated names, matching an SRD
              feat or one of your own custom feats. A feat with its own spell choices (Magic Initiate-style) grants
              only its fixed effects this way; the choices themselves aren't resolved.
            </p>
            <datalist id="feat-name-list-background">
              {featNameOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            <input
              list="feat-name-list-background"
              value={bgGrantedFeatsText}
              onChange={(e) => setBgGrantedFeatsText(e.target.value)}
              placeholder="e.g. Tough"
              style={{ width: "100%" }}
            />
            {(() => {
              const unresolved = bgGrantedFeatsText
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .filter((n) => !featNameOptions.some((o) => o.toLowerCase() === n.toLowerCase()));
              return (
                unresolved.length > 0 && (
                  <div style={{ color: "var(--danger)", fontSize: "0.85rem", marginTop: "0.2rem" }}>
                    No SRD or custom feat named {unresolved.map((n) => `“${n}”`).join(", ")} — this background won't
                    grant {unresolved.length === 1 ? "it" : "them"}. Create the feat under Type → Feat first, then it
                    will resolve by name.
                  </div>
                )
              );
            })()}

            <h4 style={{ marginTop: "1rem" }}>Features</h4>
            <p>
              <small>Some backgrounds grant more than one distinct feature -- add a row per feature. Bonuses are optional.</small>
            </p>
            {bgFeatures.map((f, i) => (
              <div key={f.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "0.5rem", marginBottom: "0.4rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    placeholder="Name"
                    value={f.name}
                    onChange={(e) => setBgFeatures((prev) => prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                    style={{ flex: 1 }}
                  />
                  <button type="button" onClick={() => setBgFeatures((prev) => prev.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </div>
                <textarea
                  placeholder="Description"
                  value={f.description}
                  onChange={(e) => setBgFeatures((prev) => prev.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))}
                  rows={2}
                  style={{ width: "100%", marginTop: "0.3rem" }}
                />
                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.4rem", fontSize: "0.85rem" }}>
                  {DND5E_ABILITIES.map((a) => (
                    <label key={a}>
                      {a.toUpperCase()}{" "}
                      <input
                        type="number"
                        style={{ width: "2.6rem" }}
                        value={f.abilityBonuses[a] ?? ""}
                        onChange={(e) =>
                          setBgFeatures((prev) =>
                            prev.map((r, j) =>
                              j === i ? { ...r, abilityBonuses: { ...r.abilityBonuses, [a]: e.target.value } } : r,
                            ),
                          )
                        }
                      />
                    </label>
                  ))}
                  <label>
                    AC{" "}
                    <input
                      type="number"
                      style={{ width: "2.6rem" }}
                      value={f.acBonus}
                      onChange={(e) => setBgFeatures((prev) => prev.map((r, j) => (j === i ? { ...r, acBonus: e.target.value } : r)))}
                    />
                  </label>
                  <label>
                    Attack{" "}
                    <input
                      type="number"
                      style={{ width: "2.6rem" }}
                      value={f.attackBonus}
                      onChange={(e) =>
                        setBgFeatures((prev) => prev.map((r, j) => (j === i ? { ...r, attackBonus: e.target.value } : r)))
                      }
                    />
                  </label>
                  <label>
                    Damage{" "}
                    <input
                      type="number"
                      style={{ width: "2.6rem" }}
                      value={f.damageBonus}
                      onChange={(e) =>
                        setBgFeatures((prev) => prev.map((r, j) => (j === i ? { ...r, damageBonus: e.target.value } : r)))
                      }
                    />
                  </label>
                  <label>
                    Spell DC{" "}
                    <input
                      type="number"
                      style={{ width: "2.6rem" }}
                      value={f.spellDCBonus}
                      onChange={(e) =>
                        setBgFeatures((prev) => prev.map((r, j) => (j === i ? { ...r, spellDCBonus: e.target.value } : r)))
                      }
                    />
                  </label>
                  <label>
                    Spell attack{" "}
                    <input
                      type="number"
                      style={{ width: "2.6rem" }}
                      value={f.spellAttackBonus}
                      onChange={(e) =>
                        setBgFeatures((prev) => prev.map((r, j) => (j === i ? { ...r, spellAttackBonus: e.target.value } : r)))
                      }
                    />
                  </label>
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setBgFeatures((prev) => [...prev, emptyBgFeatureRow()])}>
              Add feature
            </button>

            <h4 style={{ marginTop: "1rem" }}>Variants ("lore boxes")</h4>
            <p>
              <small>
                A pick-one (or pick-N) set of themed flavor options -- e.g. which faction, origin, or patron the
                background attaches to.
              </small>
            </p>
            {bgVariants.map((v, i) => (
              <div key={v.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "0.5rem", marginBottom: "0.4rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <input
                    placeholder="Title"
                    value={v.title}
                    onChange={(e) => setBgVariants((prev) => prev.map((r, j) => (j === i ? { ...r, title: e.target.value } : r)))}
                    style={{ flex: 1 }}
                  />
                  <button type="button" onClick={() => setBgVariants((prev) => prev.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </div>
                <textarea
                  placeholder="Description"
                  value={v.description}
                  onChange={(e) => setBgVariants((prev) => prev.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))}
                  rows={2}
                  style={{ width: "100%", marginTop: "0.3rem" }}
                />
              </div>
            ))}
            <button type="button" onClick={() => setBgVariants((prev) => [...prev, emptyBgVariantRow()])}>
              Add variant
            </button>
            {bgVariants.length > 0 && (
              <label style={{ marginLeft: "1rem" }}>
                Player picks{" "}
                <input
                  type="number"
                  min={0}
                  value={bgVariantPickCount}
                  onChange={(e) => setBgVariantPickCount(e.target.value)}
                  style={{ width: "3rem" }}
                />
              </label>
            )}

            {(() => {
              const preview = formatBackgroundGrants(buildBackgroundData());
              return (
                <div style={{ marginTop: "1rem", background: "var(--surface-sunken)", border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "0.75rem" }}>
                  <h4 style={{ marginTop: 0 }}>Preview</h4>
                  <p style={{ margin: "0.2rem 0" }}>
                    <strong>Skill Proficiencies:</strong> {preview.skills}
                  </p>
                  <p style={{ margin: "0.2rem 0" }}>
                    <strong>Tool Proficiencies:</strong> {preview.tools}
                  </p>
                  <p style={{ margin: "0.2rem 0" }}>
                    <strong>Languages:</strong> {preview.languages}
                  </p>
                  <p style={{ margin: "0.2rem 0" }}>
                    <strong>Equipment:</strong> {preview.equipment}
                  </p>
                  {bgGrantedFeatsText.trim() && (
                    <p style={{ margin: "0.2rem 0" }}>
                      <strong>Granted Feats:</strong> {bgGrantedFeatsText}
                    </p>
                  )}
                  {preview.features.map((f) => {
                    const bonusParts = [
                      ...DND5E_ABILITIES.filter((a) => f.abilityBonuses[a]).map((a) => `${formatModifier(f.abilityBonuses[a]!)} ${a.toUpperCase()}`),
                      f.acBonus !== 0 && `${formatModifier(f.acBonus)} AC`,
                      f.attackBonus !== 0 && `${formatModifier(f.attackBonus)} attack`,
                      f.damageBonus !== 0 && `${formatModifier(f.damageBonus)} damage`,
                      f.spellDCBonus !== 0 && `${formatModifier(f.spellDCBonus)} spell DC`,
                      f.spellAttackBonus !== 0 && `${formatModifier(f.spellAttackBonus)} spell attack`,
                    ].filter(Boolean);
                    return (
                      <p key={f.id} style={{ margin: "0.2rem 0" }}>
                        <strong>Feature: {f.name}.</strong> {f.description}
                        {bonusParts.length > 0 && <em> ({bonusParts.join(", ")})</em>}
                      </p>
                    );
                  })}
                  {preview.variants.length > 0 && (
                    <p style={{ margin: "0.2rem 0" }}>
                      <strong>
                        Choose {preview.variantPickCount} of {preview.variants.length}:
                      </strong>{" "}
                      {preview.variants.map((v) => v.title).join(", ")}
                    </p>
                  )}
                </div>
              );
            })()}
          </>
        ) : type === "subrace" ? (
          <>
            <div style={{ marginTop: "0.5rem" }}>
              <label>
                Parent race
                <br />
                <select
                  value={
                    SRD_RACES.some((r) => r.name.toLowerCase() === parentRace.trim().toLowerCase()) ||
                    visibleRaces.some((r) => r.name.toLowerCase() === parentRace.trim().toLowerCase())
                      ? parentRace
                      : "__other__"
                  }
                  onChange={(e) => setParentRace(e.target.value === "__other__" ? "" : e.target.value)}
                >
                  {SRD_RACES.map((r) => (
                    <option key={r.id} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                  {visibleRaces.length > 0 && (
                    <optgroup label="Custom">
                      {visibleRaces.map((r) => (
                        <option key={r.id} value={r.name}>
                          {r.name}
                          {r.status === "pending" ? " (pending)" : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="__other__">Other (homebrew)</option>
                </select>
                {!SRD_RACES.some((r) => r.name.toLowerCase() === parentRace.trim().toLowerCase()) &&
                  !visibleRaces.some((r) => r.name.toLowerCase() === parentRace.trim().toLowerCase()) && (
                  <input
                    placeholder="Homebrew race name"
                    value={parentRace}
                    onChange={(e) => setParentRace(e.target.value)}
                    style={{ marginLeft: "0.4rem" }}
                  />
                )}
              </label>
            </div>
            <h4>Ability score bonuses (subrace)</h4>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {DND5E_ABILITIES.map((a) => (
                <label key={a}>
                  {DND5E_ABILITY_NAMES[a]}{" "}
                  <input
                    type="number"
                    style={{ width: "3rem" }}
                    value={abilityBonuses[a] ?? ""}
                    onChange={(e) => setAbilityBonuses((prev) => ({ ...prev, [a]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            {renderTraitRows()}
          </>
        ) : type === "subclass" ? (
          <>
            <div style={{ marginTop: "0.5rem" }}>
              <label>
                Parent class
                <br />
                <select
                  value={
                    DND5E_CLASSES.some((c) => c.name.toLowerCase() === parentClass.trim().toLowerCase()) ||
                    visibleClasses.some((c) => c.name.toLowerCase() === parentClass.trim().toLowerCase())
                      ? parentClass
                      : "__other__"
                  }
                  onChange={(e) => setParentClass(e.target.value === "__other__" ? "" : e.target.value)}
                >
                  {DND5E_CLASSES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  {visibleClasses.length > 0 && (
                    <optgroup label="Custom">
                      {visibleClasses.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                          {c.status === "pending" ? " (pending)" : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="__other__">Other (homebrew)</option>
                </select>
                {!DND5E_CLASSES.some((c) => c.name.toLowerCase() === parentClass.trim().toLowerCase()) &&
                  !visibleClasses.some((c) => c.name.toLowerCase() === parentClass.trim().toLowerCase()) && (
                  <input
                    placeholder="Homebrew class name"
                    value={parentClass}
                    onChange={(e) => setParentClass(e.target.value)}
                    style={{ marginLeft: "0.4rem" }}
                  />
                )}
              </label>
            </div>
            <h4 style={{ marginTop: "1rem" }}>Features by level</h4>
            <p>
              <small>
                Feature names granted at each level (comma-separated). Martial: key:value pairs — see the class form
                for the full key list.
              </small>
            </p>
            {levelRows.map((row, i) => (
              <div key={i} style={{ display: "flex", gap: "0.4rem", marginBottom: "0.3rem", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="number"
                  min={1}
                  max={20}
                  placeholder="Lvl"
                  value={row.level}
                  onChange={(e) => setLevelRows((prev) => prev.map((r, j) => (j === i ? { ...r, level: e.target.value } : r)))}
                  style={{ width: "3rem" }}
                  title="Level"
                />
                <input
                  placeholder="Features (comma-separated)"
                  value={row.featuresText}
                  onChange={(e) => setLevelRows((prev) => prev.map((r, j) => (j === i ? { ...r, featuresText: e.target.value } : r)))}
                  style={{ flex: 1, minWidth: "12rem" }}
                />
                <input
                  placeholder="Martial e.g. sneakAttack:1d6"
                  value={row.martialText}
                  onChange={(e) => setLevelRows((prev) => prev.map((r, j) => (j === i ? { ...r, martialText: e.target.value } : r)))}
                  style={{ flex: 1, minWidth: "12rem" }}
                  title="Martial features"
                />
                <button type="button" onClick={() => setLevelRows((prev) => prev.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                const nextLevel = levelRows.length > 0 ? Math.max(...levelRows.map((r) => Number(r.level) || 0)) + 1 : 1;
                setLevelRows((prev) => [...prev, emptyLevelRow(Math.min(20, nextLevel))]);
              }}
            >
              Add level
            </button>

            <h4 style={{ marginTop: "1.2rem" }}>Features with rules text</h4>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Use these instead of the bare names above when a feature needs its actual rules text, a mechanical bonus,
              or a proficiency grant. A name listed both here and above is only added once.
            </p>
            {subclassFeatureRows.map((row, i) => (
              <div key={row.id} style={{ border: "1px solid var(--border-subtle)", borderRadius: 6, padding: "0.5rem", marginTop: "0.5rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <label>
                    Lvl{" "}
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={row.level}
                      onChange={(e) =>
                        setSubclassFeatureRows((prev) => prev.map((r, j) => (j === i ? { ...r, level: e.target.value } : r)))
                      }
                      style={{ width: "3rem" }}
                    />
                  </label>
                  <input
                    placeholder="Feature name (e.g. Hexblade's Curse)"
                    value={row.name}
                    onChange={(e) =>
                      setSubclassFeatureRows((prev) => prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                    }
                    style={{ flex: 1 }}
                  />
                  <button type="button" onClick={() => setSubclassFeatureRows((prev) => prev.filter((_, j) => j !== i))}>
                    Remove
                  </button>
                </div>
                <textarea
                  placeholder="Rules text"
                  value={row.description}
                  onChange={(e) =>
                    setSubclassFeatureRows((prev) => prev.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))
                  }
                  rows={3}
                  style={{ width: "100%", marginTop: "0.4rem" }}
                />
                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.4rem", fontSize: "0.9rem" }}>
                  {DND5E_ABILITIES.map((a) => (
                    <label key={a}>
                      {DND5E_ABILITY_NAMES[a]}{" "}
                      <input
                        type="number"
                        style={{ width: "2.6rem" }}
                        value={row.abilityBonuses[a] ?? ""}
                        onChange={(e) =>
                          setSubclassFeatureRows((prev) =>
                            prev.map((r, j) => (j === i ? { ...r, abilityBonuses: { ...r.abilityBonuses, [a]: e.target.value } } : r)),
                          )
                        }
                      />
                    </label>
                  ))}
                  {(
                    [
                      ["AC", "acBonus"],
                      ["Attack", "attackBonus"],
                      ["Damage", "damageBonus"],
                      ["Spell DC", "spellDCBonus"],
                      ["Spell atk", "spellAttackBonus"],
                    ] as const
                  ).map(([label, key]) => (
                    <label key={key}>
                      {label}{" "}
                      <input
                        type="number"
                        style={{ width: "2.6rem" }}
                        value={row[key]}
                        onChange={(e) =>
                          setSubclassFeatureRows((prev) => prev.map((r, j) => (j === i ? { ...r, [key]: e.target.value } : r)))
                        }
                      />
                    </label>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.4rem" }}>
                  <input
                    placeholder="Armor proficiencies (comma-separated)"
                    value={row.armorText}
                    onChange={(e) =>
                      setSubclassFeatureRows((prev) => prev.map((r, j) => (j === i ? { ...r, armorText: e.target.value } : r)))
                    }
                    style={{ flex: 1, minWidth: "10rem" }}
                  />
                  <input
                    placeholder="Weapon proficiencies"
                    value={row.weaponText}
                    onChange={(e) =>
                      setSubclassFeatureRows((prev) => prev.map((r, j) => (j === i ? { ...r, weaponText: e.target.value } : r)))
                    }
                    style={{ flex: 1, minWidth: "10rem" }}
                  />
                  <input
                    placeholder="Tool proficiencies"
                    value={row.toolText}
                    onChange={(e) =>
                      setSubclassFeatureRows((prev) => prev.map((r, j) => (j === i ? { ...r, toolText: e.target.value } : r)))
                    }
                    style={{ flex: 1, minWidth: "10rem" }}
                  />
                </div>
                <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.4rem", fontSize: "0.85rem" }}>
                  {DND5E_SKILLS.map((s) => (
                    <label key={s.id}>
                      <input
                        type="checkbox"
                        checked={row.skillProficiencies.includes(s.id)}
                        onChange={(e) =>
                          setSubclassFeatureRows((prev) =>
                            prev.map((r, j) =>
                              j === i
                                ? {
                                    ...r,
                                    skillProficiencies: e.target.checked
                                      ? [...r.skillProficiencies, s.id]
                                      : r.skillProficiencies.filter((id) => id !== s.id),
                                  }
                                : r,
                            ),
                          )
                        }
                      />{" "}
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSubclassFeatureRows((prev) => [...prev, emptySubclassFeatureRow(1)])}
              style={{ marginTop: "0.4rem" }}
            >
              Add feature
            </button>

            <h4 style={{ marginTop: "1.2rem" }}>Spell list</h4>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              <strong>Added to list</strong> makes the spell selectable for this character (a Warlock expanded spell
              list — options, not handouts). <strong>Granted</strong> puts it straight on the sheet at that level.
            </p>
            <datalist id="srd-spells-list-subclass">
              {spellNameOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            {subclassSpellRows.map((row, i) => {
              // A name that matches neither the SRD nor any visible custom spell will silently do
              // nothing on the sheet -- several PHB spells on published expanded lists (Wrathful
              // Smite, Elemental Weapon, Staggering Smite, Banishing Smite...) aren't in SRD 5.1.
              const typed = row.name.trim().toLowerCase();
              const unresolved = typed !== "" && !knownSpellNames.has(typed);
              return (
              <div key={row.id} style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.4rem" }}>
                <label>
                  Lvl{" "}
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={row.level}
                    onChange={(e) => setSubclassSpellRows((prev) => prev.map((r, j) => (j === i ? { ...r, level: e.target.value } : r)))}
                    style={{ width: "3rem" }}
                  />
                </label>
                <input
                  placeholder="Spell name (matches an SRD spell if spelled exactly)"
                  list="srd-spells-list-subclass"
                  value={row.name}
                  onChange={(e) => setSubclassSpellRows((prev) => prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                  style={{ flex: 1, minWidth: "12rem", borderColor: unresolved ? "var(--danger)" : undefined }}
                />
                <select
                  value={row.mode}
                  onChange={(e) =>
                    setSubclassSpellRows((prev) =>
                      prev.map((r, j) => (j === i ? { ...r, mode: e.target.value as SubclassSpellRow["mode"] } : r)),
                    )
                  }
                >
                  <option value="list">Added to list</option>
                  <option value="granted">Granted</option>
                </select>
                <label>
                  <input
                    type="checkbox"
                    checked={row.atWill}
                    onChange={(e) => setSubclassSpellRows((prev) => prev.map((r, j) => (j === i ? { ...r, atWill: e.target.checked } : r)))}
                  />{" "}
                  At will
                </label>
                <button type="button" onClick={() => setSubclassSpellRows((prev) => prev.filter((_, j) => j !== i))}>
                  Remove
                </button>
                {unresolved && (
                  <div style={{ flexBasis: "100%", color: "var(--danger)", fontSize: "0.85rem" }}>
                    No SRD or custom spell named “{row.name.trim()}” — this row won’t do anything. Several PHB spells
                    aren’t in the SRD; create it under Type → Spell first, then it will resolve by name.
                  </div>
                )}
              </div>
              );
            })}
            <button
              type="button"
              onClick={() => setSubclassSpellRows((prev) => [...prev, emptySubclassSpellRow(1)])}
              style={{ marginTop: "0.4rem" }}
            >
              Add spell
            </button>

            <h4 style={{ marginTop: "1.2rem" }}>Limited-use resources</h4>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Gets a spend/reset counter on the sheet that clears on the matching rest, alongside Rage and Ki.
            </p>
            {subclassResourceRows.map((row, i) => (
              <div key={row.id} style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.4rem" }}>
                <label>
                  Lvl{" "}
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={row.level}
                    onChange={(e) => setSubclassResourceRows((prev) => prev.map((r, j) => (j === i ? { ...r, level: e.target.value } : r)))}
                    style={{ width: "3rem" }}
                  />
                </label>
                <input
                  placeholder="Resource name (e.g. Hexblade's Curse)"
                  value={row.name}
                  onChange={(e) => setSubclassResourceRows((prev) => prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
                  style={{ flex: 1, minWidth: "10rem" }}
                />
                <label>
                  Uses{" "}
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={row.uses}
                    onChange={(e) => setSubclassResourceRows((prev) => prev.map((r, j) => (j === i ? { ...r, uses: e.target.value } : r)))}
                    style={{ width: "3rem" }}
                  />
                </label>
                <select
                  value={row.recharge}
                  onChange={(e) =>
                    setSubclassResourceRows((prev) =>
                      prev.map((r, j) => (j === i ? { ...r, recharge: e.target.value as ResourceRow["recharge"] } : r)),
                    )
                  }
                >
                  <option value="short">Per short rest</option>
                  <option value="long">Per long rest</option>
                </select>
                <input
                  placeholder="Note (optional)"
                  value={row.note}
                  onChange={(e) => setSubclassResourceRows((prev) => prev.map((r, j) => (j === i ? { ...r, note: e.target.value } : r)))}
                  style={{ flex: 1, minWidth: "8rem" }}
                />
                <button type="button" onClick={() => setSubclassResourceRows((prev) => prev.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setSubclassResourceRows((prev) => [...prev, emptyResourceRow("subclass")])}
              style={{ marginTop: "0.4rem" }}
            >
              Add resource
            </button>
          </>
        ) : type === "feat" ? (
          <>
            <div style={{ marginTop: "0.5rem" }}>
              <label style={{ display: "block" }}>
                Description (optional)
                <br />
                <input value={featDescription} onChange={(e) => setFeatDescription(e.target.value)} style={{ width: "100%" }} />
              </label>
            </div>
            <h4>Ability score bonuses (feat)</h4>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {DND5E_ABILITIES.map((a) => (
                <label key={a}>
                  {DND5E_ABILITY_NAMES[a]}{" "}
                  <input
                    type="number"
                    style={{ width: "3rem" }}
                    value={abilityBonuses[a] ?? ""}
                    onChange={(e) => setAbilityBonuses((prev) => ({ ...prev, [a]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
            <h4>Other bonuses</h4>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <label>
                AC <input type="number" style={{ width: "3rem" }} value={featAc} onChange={(e) => setFeatAc(e.target.value)} />
              </label>
              <label>
                Attack <input type="number" style={{ width: "3rem" }} value={featAtk} onChange={(e) => setFeatAtk(e.target.value)} />
              </label>
              <label>
                Damage <input type="number" style={{ width: "3rem" }} value={featDmg} onChange={(e) => setFeatDmg(e.target.value)} />
              </label>
              <label>
                Spell DC <input type="number" style={{ width: "3rem" }} value={featDC} onChange={(e) => setFeatDC(e.target.value)} />
              </label>
              <label>
                Spell attack <input type="number" style={{ width: "3rem" }} value={featSpellAtk} onChange={(e) => setFeatSpellAtk(e.target.value)} />
              </label>
            </div>

            <h4>Prerequisites (shown as a hint, not enforced)</h4>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {DND5E_ABILITIES.map((a) => (
                <label key={a}>
                  {DND5E_ABILITY_NAMES[a]} min{" "}
                  <input
                    type="number"
                    style={{ width: "3rem" }}
                    value={featPrereqAbility[a] ?? ""}
                    onChange={(e) => setFeatPrereqAbility((prev) => ({ ...prev, [a]: e.target.value }))}
                  />
                </label>
              ))}
              <label>
                Level{" "}
                <input
                  type="number"
                  style={{ width: "3rem" }}
                  value={featPrereqLevel}
                  onChange={(e) => setFeatPrereqLevel(e.target.value)}
                />
              </label>
            </div>
            <label style={{ display: "block", marginTop: "0.4rem" }}>
              Other prerequisite text (e.g. "Proficiency with heavy armor")
              <br />
              <input
                value={featPrereqText}
                onChange={(e) => setFeatPrereqText(e.target.value)}
                style={{ width: "100%" }}
              />
            </label>

            <h4>Skill proficiencies granted</h4>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", fontSize: "0.9rem" }}>
              {DND5E_SKILLS.map((s) => (
                <label key={s.id}>
                  <input
                    type="checkbox"
                    checked={featSkillProficiencies.includes(s.id)}
                    onChange={(e) =>
                      setFeatSkillProficiencies((prev) =>
                        e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id),
                      )
                    }
                  />{" "}
                  {s.name}
                </label>
              ))}
            </div>

            <h4 style={{ marginTop: "1rem" }}>Spells granted</h4>
            <datalist id="srd-spells-list-feat">
              {spellNameOptions.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
            {featGrantedSpells.map((row, i) => (
              <div key={i} style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginTop: "0.4rem" }}>
                <input
                  placeholder="Spell name (matches an SRD spell if spelled exactly)"
                  list="srd-spells-list-feat"
                  value={row.name}
                  onChange={(e) =>
                    setFeatGrantedSpells((prev) => prev.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))
                  }
                  style={{ flex: 1 }}
                />
                <label>
                  Level{" "}
                  <input
                    type="number"
                    min={0}
                    max={9}
                    value={row.level}
                    onChange={(e) =>
                      setFeatGrantedSpells((prev) => prev.map((r, j) => (j === i ? { ...r, level: e.target.value } : r)))
                    }
                    style={{ width: "2.8rem" }}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={row.atWill}
                    onChange={(e) =>
                      setFeatGrantedSpells((prev) => prev.map((r, j) => (j === i ? { ...r, atWill: e.target.checked } : r)))
                    }
                  />{" "}
                  At will (no slot)
                </label>
                <button type="button" onClick={() => setFeatGrantedSpells((prev) => prev.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setFeatGrantedSpells((prev) => [...prev, emptyFeatGrantedSpellRow()])}
              style={{ marginTop: "0.4rem" }}
            >
              Add granted spell
            </button>

            <h4 style={{ marginTop: "1rem" }}>Spell choices (e.g. Magic Initiate)</h4>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              A row the player resolves when taking the feat -- e.g. "2 cantrips from a class you choose". Add one row
              per distinct pick (a cantrip row and a separate 1st-level-spell row for Magic Initiate).
            </p>
            {featSpellChoices.map((row, i) => (
              <div key={row.id} style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.4rem" }}>
                <label>
                  Count{" "}
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={row.count}
                    onChange={(e) => setFeatSpellChoices((prev) => prev.map((r, j) => (j === i ? { ...r, count: e.target.value } : r)))}
                    style={{ width: "2.8rem" }}
                  />
                </label>
                <label>
                  From{" "}
                  <select
                    value={row.kind}
                    onChange={(e) =>
                      setFeatSpellChoices((prev) =>
                        prev.map((r, j) => (j === i ? { ...r, kind: e.target.value as FeatSpellChoiceRow["kind"] } : r)),
                      )
                    }
                  >
                    <option value="class">A class's spell list</option>
                    <option value="list">A specific list</option>
                    <option value="any">Any spell</option>
                  </select>
                </label>
                {row.kind === "class" && (
                  <label>
                    Class{" "}
                    <select
                      value={row.classId}
                      onChange={(e) => setFeatSpellChoices((prev) => prev.map((r, j) => (j === i ? { ...r, classId: e.target.value } : r)))}
                    >
                      {DND5E_CLASSES.map((c) => (
                        <option key={c.name} value={c.name.toLowerCase()}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {row.kind === "list" && (
                  <input
                    placeholder="Spell ids, comma-separated (e.g. fire-bolt, mage-hand)"
                    value={row.srdIdsText}
                    onChange={(e) => setFeatSpellChoices((prev) => prev.map((r, j) => (j === i ? { ...r, srdIdsText: e.target.value } : r)))}
                    style={{ flex: 1, minWidth: "12rem" }}
                  />
                )}
                <label>
                  Level{" "}
                  <input
                    type="number"
                    min={0}
                    max={9}
                    value={row.maxLevel}
                    onChange={(e) => setFeatSpellChoices((prev) => prev.map((r, j) => (j === i ? { ...r, maxLevel: e.target.value } : r)))}
                    style={{ width: "2.8rem" }}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={row.atWill}
                    onChange={(e) => setFeatSpellChoices((prev) => prev.map((r, j) => (j === i ? { ...r, atWill: e.target.checked } : r)))}
                  />{" "}
                  At will (no slot)
                </label>
                <button type="button" onClick={() => setFeatSpellChoices((prev) => prev.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setFeatSpellChoices((prev) => [...prev, emptyFeatSpellChoiceRow()])}
              style={{ marginTop: "0.4rem" }}
            >
              Add spell choice
            </button>
          </>
        ) : type === "spell" ? (
          <>
            <div style={{ marginTop: "0.5rem" }}>
              <label style={{ display: "block" }}>
                Description
                <br />
                <textarea
                  value={spellDescription}
                  onChange={(e) => setSpellDescription(e.target.value)}
                  rows={4}
                  style={{ width: "100%" }}
                  placeholder="What the spell does -- shown wherever this spell appears (picker, cast control), never copied onto a sheet entry."
                />
              </label>
            </div>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              <label>
                Level{" "}
                <select value={spellLevel} onChange={(e) => setSpellLevel(e.target.value)}>
                  <option value="0">Cantrip</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                School <input value={spellSchool} onChange={(e) => setSpellSchool(e.target.value)} placeholder="e.g. Evocation" style={{ width: "8rem" }} />
              </label>
              <label>
                Casting time <input value={spellCastingTime} onChange={(e) => setSpellCastingTime(e.target.value)} style={{ width: "8rem" }} />
              </label>
              <label>
                Range <input value={spellRange} onChange={(e) => setSpellRange(e.target.value)} style={{ width: "8rem" }} />
              </label>
              <label>
                Duration <input value={spellDuration} onChange={(e) => setSpellDuration(e.target.value)} style={{ width: "8rem" }} />
              </label>
            </div>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem", alignItems: "center" }}>
              <label>
                <input type="checkbox" checked={spellRequiresAttackRoll} onChange={(e) => setSpellRequiresAttackRoll(e.target.checked)} />{" "}
                Requires spell attack roll
              </label>
              <label>
                <input type="checkbox" checked={spellRitual} onChange={(e) => setSpellRitual(e.target.checked)} /> Ritual
              </label>{" "}
              <label>
                <input type="checkbox" checked={spellConcentration} onChange={(e) => setSpellConcentration(e.target.checked)} /> Concentration
              </label>
              <label>
                Save ability{" "}
                <select value={spellSaveAbility} onChange={(e) => setSpellSaveAbility(e.target.value as Dnd5eAbility | "")}>
                  <option value="">None</option>
                  {DND5E_ABILITIES.map((a) => (
                    <option key={a} value={a}>
                      {DND5E_ABILITY_NAMES[a]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              <label>
                Damage dice <input value={spellDamageDice} onChange={(e) => setSpellDamageDice(e.target.value)} placeholder="e.g. 8d6" style={{ width: "6rem" }} />
              </label>
              <label>
                Damage type <input value={spellDamageType} onChange={(e) => setSpellDamageType(e.target.value)} placeholder="e.g. Fire" style={{ width: "6rem" }} />
              </label>
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              <label style={{ display: "block" }}>
                Classes that can cast this (comma-separated, e.g. "wizard, sorcerer")
                <br />
                <input value={spellClasses} onChange={(e) => setSpellClasses(e.target.value)} style={{ width: "100%" }} />
              </label>
            </div>

            <h4 style={{ marginTop: "1rem" }}>Attack/damage buff (optional)</h4>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              Bonus applied to the caster's <em>own later weapon attack</em> when this spell is cast — e.g. Wrathful
              Smite's next-hit 1d6 psychic, or Bless's +1d4 to hit. Separate from "Damage dice" above, which is
              damage the spell itself deals on cast (Magic Missile).
            </p>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              <label>
                Attack bonus{" "}
                <input
                  type="number"
                  value={spellBuffAttackBonus}
                  onChange={(e) => setSpellBuffAttackBonus(e.target.value)}
                  style={{ width: "3rem" }}
                />
              </label>
              <label>
                Attack dice{" "}
                <input
                  value={spellBuffAttackDice}
                  onChange={(e) => setSpellBuffAttackDice(e.target.value)}
                  placeholder="e.g. 1d4"
                  style={{ width: "5rem" }}
                />
              </label>
              <label>
                Damage bonus{" "}
                <input
                  type="number"
                  value={spellBuffDamageBonus}
                  onChange={(e) => setSpellBuffDamageBonus(e.target.value)}
                  style={{ width: "3rem" }}
                />
              </label>
              <label>
                Damage dice{" "}
                <input
                  value={spellBuffDamageDice}
                  onChange={(e) => setSpellBuffDamageDice(e.target.value)}
                  placeholder="e.g. 1d6"
                  style={{ width: "5rem" }}
                />
              </label>
              <label>
                Damage type{" "}
                <input
                  value={spellBuffDamageType}
                  onChange={(e) => setSpellBuffDamageType(e.target.value)}
                  placeholder="e.g. psychic"
                  style={{ width: "6rem" }}
                />
              </label>
              <label>
                Applies{" "}
                <select value={spellBuffConsumption} onChange={(e) => setSpellBuffConsumption(e.target.value as "per-hit" | "once")}>
                  <option value="per-hit">Every hit, until it ends</option>
                  <option value="once">Next hit only</option>
                </select>
              </label>
            </div>

            <h4 style={{ marginTop: "1rem" }}>At higher levels (optional)</h4>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
              How the spell scales when cast with a higher-level slot. <strong>Dice per level</strong> is added to the
              damage roll once per slot level above this spell's own level (Fireball would be <code>1d6</code>) — it
              needs "Damage dice" above to attach to. Use the <strong>note</strong> for upcasts that aren't extra dice
              on one roll: more targets, longer duration, or scaling per <em>two</em> levels.
            </p>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              <label>
                Dice per level{" "}
                <input
                  value={spellScalingDicePerLevel}
                  onChange={(e) => setSpellScalingDicePerLevel(e.target.value)}
                  placeholder="e.g. 1d6"
                  style={{ width: "5rem" }}
                />
              </label>
              <label style={{ flex: 1, minWidth: "16rem" }}>
                Note{" "}
                <input
                  value={spellScalingNote}
                  onChange={(e) => setSpellScalingNote(e.target.value)}
                  placeholder="e.g. Targets one additional creature for each slot level above 2nd."
                  style={{ width: "100%" }}
                />
              </label>
            </div>
          </>
        ) : type === "item" ? (
          <>
            <div style={{ marginTop: "0.5rem" }}>
              <label style={{ display: "block" }}>
                Description
                <br />
                <textarea
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  rows={4}
                  style={{ width: "100%" }}
                  placeholder="What the item does -- reference text shown next to it on the sheet, separate from the mechanical Notes field a player edits."
                />
              </label>
            </div>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              <label>
                Kind{" "}
                <select value={itemKind} onChange={(e) => setItemKind(e.target.value as typeof itemKind)}>
                  <option value="weapon">Weapon</option>
                  <option value="armor">Armor</option>
                  <option value="gear">Gear</option>
                  <option value="magic">Magic item</option>
                </select>
              </label>
              <label>
                Weight (lb) <input type="number" style={{ width: "4rem" }} value={itemWeight} onChange={(e) => setItemWeight(e.target.value)} />
              </label>
              <label>
                Value (gp) <input type="number" style={{ width: "4rem" }} value={itemValue} onChange={(e) => setItemValue(e.target.value)} />
              </label>
              <label>
                Category <input value={itemCategory} onChange={(e) => setItemCategory(e.target.value)} placeholder="e.g. Martial" style={{ width: "8rem" }} />
              </label>
            </div>

            {itemKind === "weapon" && (
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
                <label>
                  Damage dice <input value={itemDamageDice} onChange={(e) => setItemDamageDice(e.target.value)} placeholder="e.g. 1d8" style={{ width: "6rem" }} />
                </label>
                <label>
                  Damage type <input value={itemDamageType} onChange={(e) => setItemDamageType(e.target.value)} placeholder="e.g. Slashing" style={{ width: "6rem" }} />
                </label>
                <label style={{ flex: 1, minWidth: "12rem" }}>
                  Properties (comma-separated)
                  <input value={itemProperties} onChange={(e) => setItemProperties(e.target.value)} style={{ width: "100%" }} />
                </label>
              </div>
            )}

            {itemKind === "armor" && (
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem", alignItems: "center" }}>
                <label>
                  Category{" "}
                  <select
                    value={itemArmorCategory}
                    onChange={(e) => setItemArmorCategory(e.target.value as typeof itemArmorCategory)}
                  >
                    <option value="light">Light armor</option>
                    <option value="medium">Medium armor</option>
                    <option value="heavy">Heavy armor</option>
                    <option value="shield">Shield</option>
                  </select>
                </label>
                <label>
                  Base AC <input type="number" style={{ width: "3rem" }} value={itemBaseAC} onChange={(e) => setItemBaseAC(e.target.value)} />
                </label>
                <label>
                  <input type="checkbox" checked={itemDexBonus} onChange={(e) => setItemDexBonus(e.target.checked)} /> Adds Dex bonus
                </label>
                {itemDexBonus && (
                  <label>
                    Max Dex bonus (blank = unlimited){" "}
                    <input
                      type="number"
                      style={{ width: "3rem" }}
                      value={itemMaxDexBonus}
                      onChange={(e) => setItemMaxDexBonus(e.target.value)}
                    />
                  </label>
                )}
                <label>
                  <input
                    type="checkbox"
                    checked={itemStealthDisadvantage}
                    onChange={(e) => setItemStealthDisadvantage(e.target.checked)}
                  />{" "}
                  Stealth disadvantage
                </label>
              </div>
            )}

            {itemKind === "magic" && (
              <div style={{ marginTop: "0.5rem" }}>
                <label>
                  Rarity <input value={itemRarity} onChange={(e) => setItemRarity(e.target.value)} placeholder="e.g. Rare" style={{ width: "8rem" }} />
                </label>
              </div>
            )}

            <h4 style={{ marginTop: "1rem" }}>Effect bonuses (applied when this item is picked)</h4>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              {DND5E_ABILITIES.map((a) => (
                <label key={a}>
                  {DND5E_ABILITY_NAMES[a]}{" "}
                  <input
                    type="number"
                    style={{ width: "3rem" }}
                    value={abilityBonuses[a] ?? ""}
                    onChange={(e) => setAbilityBonuses((prev) => ({ ...prev, [a]: e.target.value }))}
                  />
                </label>
              ))}
              <label>
                AC <input type="number" style={{ width: "3rem" }} value={itemAcBonus} onChange={(e) => setItemAcBonus(e.target.value)} />
              </label>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              <label>
                Size <input value={monsterSize} onChange={(e) => setMonsterSize(e.target.value)} style={{ width: "6rem" }} />
              </label>
              <label>
                Type <input value={monsterType} onChange={(e) => setMonsterType(e.target.value)} placeholder="e.g. beast" style={{ width: "6rem" }} />
              </label>
              <label>
                Alignment <input value={monsterAlignment} onChange={(e) => setMonsterAlignment(e.target.value)} style={{ width: "8rem" }} />
              </label>
              <label>
                CR <input type="number" step={0.125} style={{ width: "4rem" }} value={monsterCr} onChange={(e) => setMonsterCr(e.target.value)} />
              </label>
              <label>
                XP <input type="number" style={{ width: "5rem" }} value={monsterXp} onChange={(e) => setMonsterXp(e.target.value)} />
              </label>
            </div>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              <label>
                AC <input type="number" style={{ width: "3rem" }} value={monsterAc} onChange={(e) => setMonsterAc(e.target.value)} />
              </label>
              <label>
                HP <input type="number" style={{ width: "4rem" }} value={monsterHp} onChange={(e) => setMonsterHp(e.target.value)} />
              </label>
              <label>
                Hit dice <input value={monsterHitDice} onChange={(e) => setMonsterHitDice(e.target.value)} placeholder="e.g. 2d8" style={{ width: "6rem" }} />
              </label>
              <label>
                Speed <input value={monsterSpeedText} onChange={(e) => setMonsterSpeedText(e.target.value)} placeholder="walk:30, fly:60" style={{ width: "10rem" }} />
              </label>
              <label>
                Passive Perception{" "}
                <input type="number" style={{ width: "3rem" }} value={monsterPassivePerception} onChange={(e) => setMonsterPassivePerception(e.target.value)} />
              </label>
              <label>
                Darkvision (ft){" "}
                <input type="number" style={{ width: "3.5rem" }} value={monsterDarkvision} onChange={(e) => setMonsterDarkvision(e.target.value)} />
              </label>
              <label>
                Blindsight (ft){" "}
                <input type="number" style={{ width: "3.5rem" }} value={monsterBlindsight} onChange={(e) => setMonsterBlindsight(e.target.value)} />
              </label>
              <label>
                Tremorsense (ft){" "}
                <input type="number" style={{ width: "3.5rem" }} value={monsterTremorsense} onChange={(e) => setMonsterTremorsense(e.target.value)} />
              </label>
              <label>
                Truesight (ft){" "}
                <input type="number" style={{ width: "3.5rem" }} value={monsterTruesight} onChange={(e) => setMonsterTruesight(e.target.value)} />
              </label>
            </div>
            <h4 style={{ marginTop: "1rem" }}>Ability scores</h4>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
              <label>
                STR <input type="number" style={{ width: "3.5rem" }} value={monsterStr} onChange={(e) => setMonsterStr(e.target.value)} />
              </label>
              <label>
                DEX <input type="number" style={{ width: "3.5rem" }} value={monsterDex} onChange={(e) => setMonsterDex(e.target.value)} />
              </label>
              <label>
                CON <input type="number" style={{ width: "3.5rem" }} value={monsterCon} onChange={(e) => setMonsterCon(e.target.value)} />
              </label>
              <label>
                INT <input type="number" style={{ width: "3.5rem" }} value={monsterInt} onChange={(e) => setMonsterInt(e.target.value)} />
              </label>
              <label>
                WIS <input type="number" style={{ width: "3.5rem" }} value={monsterWis} onChange={(e) => setMonsterWis(e.target.value)} />
              </label>
              <label>
                CHA <input type="number" style={{ width: "3.5rem" }} value={monsterCha} onChange={(e) => setMonsterCha(e.target.value)} />
              </label>
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              <label style={{ display: "block" }}>
                Languages
                <br />
                <input value={monsterLanguages} onChange={(e) => setMonsterLanguages(e.target.value)} style={{ width: "100%" }} />
              </label>
            </div>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "0.5rem" }}>
              <label style={{ flex: 1, minWidth: "10rem" }}>
                Vulnerabilities (comma-separated)
                <input value={monsterVulnerabilities} onChange={(e) => setMonsterVulnerabilities(e.target.value)} style={{ width: "100%" }} />
              </label>
              <label style={{ flex: 1, minWidth: "10rem" }}>
                Resistances (comma-separated)
                <input value={monsterResistances} onChange={(e) => setMonsterResistances(e.target.value)} style={{ width: "100%" }} />
              </label>
              <label style={{ flex: 1, minWidth: "10rem" }}>
                Damage immunities (comma-separated)
                <input value={monsterImmunities} onChange={(e) => setMonsterImmunities(e.target.value)} style={{ width: "100%" }} />
              </label>
              <label style={{ flex: 1, minWidth: "10rem" }}>
                Condition immunities (comma-separated)
                <input value={monsterConditionImmunities} onChange={(e) => setMonsterConditionImmunities(e.target.value)} style={{ width: "100%" }} />
              </label>
            </div>
            <h4 style={{ marginTop: "1rem" }}>Skills</h4>
            <p>
              <small>One per line: "Name: +bonus" (e.g. "Perception: +11").</small>
            </p>
            <textarea
              value={monsterSkillsText}
              onChange={(e) => setMonsterSkillsText(e.target.value)}
              rows={2}
              style={{ width: "100%" }}
              placeholder="Perception: +11"
            />
            <h4 style={{ marginTop: "1rem" }}>Special abilities</h4>
            <p>
              <small>One per line: "Name: description".</small>
            </p>
            <textarea
              value={monsterSpecialAbilitiesText}
              onChange={(e) => setMonsterSpecialAbilitiesText(e.target.value)}
              rows={3}
              style={{ width: "100%" }}
            />
            <h4 style={{ marginTop: "1rem" }}>Actions</h4>
            <p>
              <small>
                One per line: "Name | attack bonus | damage dice | damage type | description" -- leave the attack
                bonus/damage fields blank for non-attack actions (e.g. Multiattack).
              </small>
            </p>
            <textarea
              value={monsterActionsText}
              onChange={(e) => setMonsterActionsText(e.target.value)}
              rows={4}
              style={{ width: "100%" }}
              placeholder="Bite | 4 | 2d4+2 | Piercing | Melee Weapon Attack..."
            />
            <h4 style={{ marginTop: "1rem" }}>Legendary actions (optional)</h4>
            <p>
              <small>
                One per line: "Name | cost | attack bonus | damage dice | damage type | description" -- leave cost
                blank for the common 1-action cost; leave the attack fields blank for non-attack options.
              </small>
            </p>
            <textarea
              value={monsterLegendaryActionsText}
              onChange={(e) => setMonsterLegendaryActionsText(e.target.value)}
              rows={3}
              style={{ width: "100%" }}
              placeholder="Detect | | | | | The dragon makes a Wisdom (Perception) check.&#10;Wing Attack (Costs 2 Actions) | 2 | | 2d6+6 | Bludgeoning | ..."
            />
            {monsterLegendaryActionsText.trim() && (
              <label style={{ display: "block", marginTop: "0.4rem" }}>
                Legendary actions per round{" "}
                <input
                  type="number"
                  min={1}
                  max={5}
                  style={{ width: "3rem" }}
                  value={monsterLegendaryActionsPerRound}
                  onChange={(e) => setMonsterLegendaryActionsPerRound(e.target.value)}
                />
              </label>
            )}
          </>
        )}

            <div style={{ marginTop: "1rem" }}>
              <button type="button" onClick={handleSubmit} disabled={!name.trim()}>
                {editingId !== null ? "Save changes" : "Create"}
              </button>{" "}
              {editingId !== null && (
                <button type="button" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
