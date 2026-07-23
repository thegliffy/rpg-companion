// SRD 5.1 class proficiencies (CC-BY-4.0): the saving throws, armor/weapon/tool proficiencies,
// and the "choose N skills from this list" grant each class gives at level 1. Skill options are
// referenced by DND5E_SKILLS ids. Custom/homebrew classes have no entry (return null).
import type { Dnd5eAbility } from "./dnd5e.js";
import { normalizeClassId } from "./class-progression.js";

export interface ClassProficiencies {
  savingThrows: Dnd5eAbility[];
  armor: string[];
  weapons: string[];
  tools: string[];
  // How many skills the class lets you choose, and the skill ids you choose from.
  skillChoiceCount: number;
  skillChoices: string[];
}

const ALL_SKILL_IDS = [
  "acrobatics", "animal-handling", "arcana", "athletics", "deception", "history", "insight",
  "intimidation", "investigation", "medicine", "nature", "perception", "performance", "persuasion",
  "religion", "sleight-of-hand", "stealth", "survival",
];

export const CLASS_PROFICIENCIES: Record<string, ClassProficiencies> = {
  barbarian: {
    savingThrows: ["str", "con"],
    armor: ["Light armor", "Medium armor", "Shields"],
    weapons: ["Simple weapons", "Martial weapons"],
    tools: [],
    skillChoiceCount: 2,
    skillChoices: ["animal-handling", "athletics", "intimidation", "nature", "perception", "survival"],
  },
  bard: {
    savingThrows: ["dex", "cha"],
    armor: ["Light armor"],
    weapons: ["Simple weapons", "Hand crossbows", "Longswords", "Rapiers", "Shortswords"],
    tools: ["Three musical instruments of your choice"],
    skillChoiceCount: 3,
    skillChoices: ALL_SKILL_IDS,
  },
  cleric: {
    savingThrows: ["wis", "cha"],
    armor: ["Light armor", "Medium armor", "Shields"],
    weapons: ["Simple weapons"],
    tools: [],
    skillChoiceCount: 2,
    skillChoices: ["history", "insight", "medicine", "persuasion", "religion"],
  },
  druid: {
    savingThrows: ["int", "wis"],
    armor: ["Light armor", "Medium armor", "Shields (non-metal)"],
    weapons: ["Clubs", "Daggers", "Darts", "Javelins", "Maces", "Quarterstaffs", "Scimitars", "Sickles", "Slings", "Spears"],
    tools: ["Herbalism kit"],
    skillChoiceCount: 2,
    skillChoices: ["arcana", "animal-handling", "insight", "medicine", "nature", "perception", "religion", "survival"],
  },
  fighter: {
    savingThrows: ["str", "con"],
    armor: ["All armor", "Shields"],
    weapons: ["Simple weapons", "Martial weapons"],
    tools: [],
    skillChoiceCount: 2,
    skillChoices: ["acrobatics", "animal-handling", "athletics", "history", "insight", "intimidation", "perception", "survival"],
  },
  monk: {
    savingThrows: ["str", "dex"],
    armor: [],
    weapons: ["Simple weapons", "Shortswords"],
    tools: ["One type of artisan's tools or one musical instrument"],
    skillChoiceCount: 2,
    skillChoices: ["acrobatics", "athletics", "history", "insight", "religion", "stealth"],
  },
  paladin: {
    savingThrows: ["wis", "cha"],
    armor: ["All armor", "Shields"],
    weapons: ["Simple weapons", "Martial weapons"],
    tools: [],
    skillChoiceCount: 2,
    skillChoices: ["athletics", "insight", "intimidation", "medicine", "persuasion", "religion"],
  },
  ranger: {
    savingThrows: ["str", "dex"],
    armor: ["Light armor", "Medium armor", "Shields"],
    weapons: ["Simple weapons", "Martial weapons"],
    tools: [],
    skillChoiceCount: 3,
    skillChoices: ["animal-handling", "athletics", "insight", "investigation", "nature", "perception", "stealth", "survival"],
  },
  rogue: {
    savingThrows: ["dex", "int"],
    armor: ["Light armor"],
    weapons: ["Simple weapons", "Hand crossbows", "Longswords", "Rapiers", "Shortswords"],
    tools: ["Thieves' tools"],
    skillChoiceCount: 4,
    skillChoices: [
      "acrobatics", "athletics", "deception", "insight", "intimidation", "investigation", "perception",
      "performance", "persuasion", "sleight-of-hand", "stealth",
    ],
  },
  sorcerer: {
    savingThrows: ["con", "cha"],
    armor: [],
    weapons: ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light crossbows"],
    tools: [],
    skillChoiceCount: 2,
    skillChoices: ["arcana", "deception", "insight", "intimidation", "persuasion", "religion"],
  },
  warlock: {
    savingThrows: ["wis", "cha"],
    armor: ["Light armor"],
    weapons: ["Simple weapons"],
    tools: [],
    skillChoiceCount: 2,
    skillChoices: ["arcana", "deception", "history", "intimidation", "investigation", "nature", "religion"],
  },
  wizard: {
    savingThrows: ["int", "wis"],
    armor: [],
    weapons: ["Daggers", "Darts", "Slings", "Quarterstaffs", "Light crossbows"],
    tools: [],
    skillChoiceCount: 2,
    skillChoices: ["arcana", "history", "insight", "investigation", "medicine", "religion"],
  },
};

/** SRD proficiency grant for a class, or null for custom/homebrew (no data). */
export function classProficiencies(className: string): ClassProficiencies | null {
  return CLASS_PROFICIENCIES[normalizeClassId(className)] ?? null;
}
