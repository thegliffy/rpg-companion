import { useEffect, useState } from "react";
import type { CustomContent, CustomContentType, CustomContentSystem, Dnd5eAbility } from "shared";
import { DND5E_ABILITIES, DND5E_ABILITY_NAMES, CUSTOM_CONTENT_TYPES_BY_SYSTEM, SYSTEM_IDS } from "shared";
import * as customContentApi from "../api/customContent";
import { useAuth } from "../context/AuthContext";

const TYPE_LABELS: Record<CustomContentType, string> = {
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

const SYSTEM_LABELS: Record<CustomContentSystem, string> = {
  dnd5e: "D&D 5e",
  pf2e: "Pathfinder 2e",
  generic: "Generic",
};

const box: React.CSSProperties = { border: "1px solid #bbb", borderRadius: 6, padding: "0.75rem", marginBottom: "1rem" };

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

export function CustomContentManager({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CustomContent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [system, setSystem] = useState<CustomContentSystem>("dnd5e");
  const [type, setType] = useState<CustomContentType>("race");
  const [name, setName] = useState("");

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
  const [speed, setSpeed] = useState("30");
  const [size, setSize] = useState("Medium");
  const [languages, setLanguages] = useState("");
  const [traits, setTraits] = useState("");

  // Class fields
  const [hitDie, setHitDie] = useState("8");
  const [casterType, setCasterType] = useState<"none" | "prepared" | "known" | "pact">("none");
  const [levelRows, setLevelRows] = useState<LevelRow[]>([emptyLevelRow(1)]);

  // Background fields
  const [bgSkills, setBgSkills] = useState("");
  const [bgFeature, setBgFeature] = useState("");
  const [bgTools, setBgTools] = useState("");
  const [bgEquipment, setBgEquipment] = useState("");

  // Subrace / subclass parent (ability bonuses, traits, and level rows are reused from above).
  const [parentRace, setParentRace] = useState("");
  const [parentClass, setParentClass] = useState("");

  // Feat fields (ability bonuses reused from above).
  const [featDescription, setFeatDescription] = useState("");
  const [featAc, setFeatAc] = useState("0");
  const [featAtk, setFeatAtk] = useState("0");
  const [featDmg, setFeatDmg] = useState("0");
  const [featDC, setFeatDC] = useState("0");
  const [featSpellAtk, setFeatSpellAtk] = useState("0");

  // Spell fields
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
  const [spellClasses, setSpellClasses] = useState("");

  // Item fields (abilityBonuses reused from above; kind drives which fields apply)
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
  const [monsterLanguages, setMonsterLanguages] = useState("");
  const [monsterVulnerabilities, setMonsterVulnerabilities] = useState("");
  const [monsterResistances, setMonsterResistances] = useState("");
  const [monsterImmunities, setMonsterImmunities] = useState("");
  const [monsterConditionImmunities, setMonsterConditionImmunities] = useState("");
  const [monsterSpecialAbilitiesText, setMonsterSpecialAbilitiesText] = useState("");
  const [monsterActionsText, setMonsterActionsText] = useState("");

  function refresh() {
    customContentApi
      .listCustomContent()
      .then((all) => setItems(all.filter((i) => i.createdByUserId === user?.id)))
      .catch((err) => setError(err.message));
  }

  useEffect(refresh, [user?.id]);

  function resetForm() {
    setEditingId(null);
    setName("");
    setAbilityBonuses({});
    setSpeed("30");
    setSize("Medium");
    setLanguages("");
    setTraits("");
    setHitDie("8");
    setCasterType("none");
    setLevelRows([emptyLevelRow(1)]);
    setBgSkills("");
    setBgFeature("");
    setBgTools("");
    setBgEquipment("");
    setParentRace("");
    setParentClass("");
    setFeatDescription("");
    setFeatAc("0");
    setFeatAtk("0");
    setFeatDmg("0");
    setFeatDC("0");
    setFeatSpellAtk("0");
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
    setSpellClasses("");
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
    setMonsterLanguages("");
    setMonsterVulnerabilities("");
    setMonsterResistances("");
    setMonsterImmunities("");
    setMonsterConditionImmunities("");
    setMonsterSpecialAbilitiesText("");
    setMonsterActionsText("");
  }

  function startEdit(item: CustomContent) {
    setEditingId(item.id);
    setSystem(item.system);
    setType(item.type);
    setName(item.name);
    if (item.type === "race") {
      const d = item.data as { abilityBonuses: Partial<Record<Dnd5eAbility, number>>; speed: number; size: string; languages: string[]; traits: string[] };
      const bonuses: Partial<Record<Dnd5eAbility, string>> = {};
      for (const [k, v] of Object.entries(d.abilityBonuses)) bonuses[k as Dnd5eAbility] = String(v);
      setAbilityBonuses(bonuses);
      setSpeed(String(d.speed));
      setSize(d.size);
      setLanguages(d.languages.join(", "));
      setTraits(d.traits.join(", "));
    } else if (item.type === "class") {
      const d = item.data as {
        hitDie: number;
        casterType: "none" | "prepared" | "known" | "pact";
        levels: { level: number; cantripsKnown?: number; spellsKnown?: number; slots?: Record<string, number>; features?: string[]; martial?: ParsedMartial }[];
      };
      setHitDie(String(d.hitDie));
      setCasterType(d.casterType);
      setLevelRows(levelsToRows(d.levels));
    } else if (item.type === "background") {
      const d = item.data as { skillProficiencies: string[]; feature: string; toolProficiencies: string[]; equipmentText: string };
      setBgSkills(d.skillProficiencies.join(", "));
      setBgFeature(d.feature);
      setBgTools(d.toolProficiencies.join(", "));
      setBgEquipment(d.equipmentText);
    } else if (item.type === "subrace") {
      const d = item.data as { parentRace: string; abilityBonuses: Partial<Record<Dnd5eAbility, number>>; traits: string[] };
      setParentRace(d.parentRace);
      const bonuses: Partial<Record<Dnd5eAbility, string>> = {};
      for (const [k, v] of Object.entries(d.abilityBonuses)) bonuses[k as Dnd5eAbility] = String(v);
      setAbilityBonuses(bonuses);
      setTraits(d.traits.join(", "));
    } else if (item.type === "subclass") {
      const d = item.data as { parentClass: string; levels: { level: number; features?: string[]; martial?: ParsedMartial }[] };
      setParentClass(d.parentClass);
      setLevelRows(levelsToRows(d.levels));
    } else if (item.type === "feat") {
      const d = item.data as { description: string; abilityBonuses: Partial<Record<Dnd5eAbility, number>>; acBonus: number; attackBonus: number; damageBonus: number; spellDCBonus: number; spellAttackBonus: number };
      setFeatDescription(d.description);
      const bonuses: Partial<Record<Dnd5eAbility, string>> = {};
      for (const [k, v] of Object.entries(d.abilityBonuses)) bonuses[k as Dnd5eAbility] = String(v);
      setAbilityBonuses(bonuses);
      setFeatAc(String(d.acBonus));
      setFeatAtk(String(d.attackBonus));
      setFeatDmg(String(d.damageBonus));
      setFeatDC(String(d.spellDCBonus));
      setFeatSpellAtk(String(d.spellAttackBonus));
    } else if (item.type === "spell") {
      const d = item.data as {
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
        classes: string[];
      };
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
      setSpellClasses(d.classes.join(", "));
    } else if (item.type === "item") {
      const d = item.data as {
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
        category: string;
        rarity: string;
        abilityBonuses: Partial<Record<Dnd5eAbility, number>>;
        acBonus: number;
      };
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
        languages: string;
        damageVulnerabilities: string[];
        damageResistances: string[];
        damageImmunities: string[];
        conditionImmunities: string[];
        specialAbilities: MonsterSpecialAbility[];
        actions: MonsterAction[];
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
      setMonsterLanguages(d.languages);
      setMonsterVulnerabilities(d.damageVulnerabilities.join(", "));
      setMonsterResistances(d.damageResistances.join(", "));
      setMonsterImmunities(d.damageImmunities.join(", "));
      setMonsterConditionImmunities(d.conditionImmunities.join(", "));
      setMonsterSpecialAbilitiesText(specialAbilitiesToText(d.specialAbilities));
      setMonsterActionsText(actionsToText(d.actions));
    }
  }

  async function handleSubmit() {
    setError(null);
    try {
      const abilityBonusesObj = Object.fromEntries(
        Object.entries(abilityBonuses).filter(([, v]) => v && v.trim() !== "").map(([k, v]) => [k, Number(v)]),
      );
      const traitsArr = traits.split(",").map((s) => s.trim()).filter(Boolean);

      let data: unknown;
      if (type === "race") {
        data = {
          abilityBonuses: abilityBonusesObj,
          speed: Number(speed) || 30,
          size,
          languages: languages.split(",").map((s) => s.trim()).filter(Boolean),
          traits: traitsArr,
        };
      } else if (type === "class") {
        data = { hitDie: Number(hitDie), casterType, levels: rowsToLevels(levelRows) };
      } else if (type === "background") {
        data = {
          skillProficiencies: bgSkills.split(",").map((s) => s.trim()).filter(Boolean),
          feature: bgFeature.trim(),
          toolProficiencies: bgTools.split(",").map((s) => s.trim()).filter(Boolean),
          equipmentText: bgEquipment.trim(),
        };
      } else if (type === "subrace") {
        data = { parentRace: parentRace.trim(), abilityBonuses: abilityBonusesObj, speed: 0, traits: traitsArr };
      } else if (type === "subclass") {
        data = { parentClass: parentClass.trim(), levels: rowsToLevels(levelRows) };
      } else if (type === "feat") {
        data = {
          description: featDescription.trim(),
          abilityBonuses: abilityBonusesObj,
          acBonus: Number(featAc) || 0,
          attackBonus: Number(featAtk) || 0,
          damageBonus: Number(featDmg) || 0,
          spellDCBonus: Number(featDC) || 0,
          spellAttackBonus: Number(featSpellAtk) || 0,
        };
      } else if (type === "spell") {
        data = {
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
          classes: spellClasses.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
        };
      } else if (type === "item") {
        data = {
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
          languages: monsterLanguages.trim(),
          damageVulnerabilities: monsterVulnerabilities.split(",").map((s) => s.trim()).filter(Boolean),
          damageResistances: monsterResistances.split(",").map((s) => s.trim()).filter(Boolean),
          damageImmunities: monsterImmunities.split(",").map((s) => s.trim()).filter(Boolean),
          conditionImmunities: monsterConditionImmunities.split(",").map((s) => s.trim()).filter(Boolean),
          specialAbilities: parseSpecialAbilitiesText(monsterSpecialAbilitiesText),
          actions: parseActionsText(monsterActionsText),
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
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div style={box}>
        <h3>My items</h3>
        {items.length === 0 && <p>None yet.</p>}
        {items.map((item) => (
          <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.3rem 0", borderBottom: "1px solid #eee" }}>
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
          <p style={{ marginTop: "0.75rem", color: "#666" }}>
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
              <label style={{ display: "block" }}>
                Traits (comma-separated names)
                <br />
                <input value={traits} onChange={(e) => setTraits(e.target.value)} style={{ width: "100%" }} />
              </label>
            </div>
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
          </>
        ) : type === "background" ? (
          <>
            <div style={{ marginTop: "0.5rem" }}>
              <label style={{ display: "block" }}>
                Skill proficiencies granted (comma-separated, e.g. "Deception, Persuasion")
                <br />
                <input value={bgSkills} onChange={(e) => setBgSkills(e.target.value)} style={{ width: "100%" }} />
              </label>
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              <label style={{ display: "block" }}>
                Feature name
                <br />
                <input value={bgFeature} onChange={(e) => setBgFeature(e.target.value)} style={{ width: "100%" }} />
              </label>
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              <label style={{ display: "block" }}>
                Tool proficiencies (comma-separated, optional)
                <br />
                <input value={bgTools} onChange={(e) => setBgTools(e.target.value)} style={{ width: "100%" }} />
              </label>
            </div>
            <div style={{ marginTop: "0.5rem" }}>
              <label style={{ display: "block" }}>
                Starting equipment (free text, optional)
                <br />
                <input value={bgEquipment} onChange={(e) => setBgEquipment(e.target.value)} style={{ width: "100%" }} />
              </label>
            </div>
          </>
        ) : type === "subrace" ? (
          <>
            <div style={{ marginTop: "0.5rem" }}>
              <label>
                Parent race <input value={parentRace} onChange={(e) => setParentRace(e.target.value)} placeholder="e.g. Dwarf" />
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
            <div style={{ marginTop: "0.5rem" }}>
              <label style={{ display: "block" }}>
                Traits (comma-separated names)
                <br />
                <input value={traits} onChange={(e) => setTraits(e.target.value)} style={{ width: "100%" }} />
              </label>
            </div>
          </>
        ) : type === "subclass" ? (
          <>
            <div style={{ marginTop: "0.5rem" }}>
              <label>
                Parent class <input value={parentClass} onChange={(e) => setParentClass(e.target.value)} placeholder="e.g. Fighter" />
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
          </>
        ) : type === "spell" ? (
          <>
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
          </>
        ) : type === "item" ? (
          <>
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
