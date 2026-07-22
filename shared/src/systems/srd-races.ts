// SRD 5.1 races (CC-BY-4.0), sourced from the open 5e-bits/5e-database project.
// Trimmed to mechanical facts only (ability bonuses, speed, size, languages, short trait names) — no flavor text.
import type { Dnd5eAbility } from "./dnd5e.js";

export interface SrdRace {
  id: string;
  name: string;
  speed: number;
  size: string;
  abilityBonuses: Partial<Record<Dnd5eAbility, number>>;
  languages: string[];
  traits: string[];
}

export const SRD_RACES: SrdRace[] = [
  {
    id: "dragonborn",
    name: "Dragonborn",
    speed: 30,
    size: "Medium",
    abilityBonuses: { str: 2, cha: 1 },
    languages: ["Common", "Draconic"],
    traits: ["Draconic Ancestry", "Breath Weapon", "Damage Resistance"],
  },
  {
    id: "dwarf",
    name: "Dwarf",
    speed: 25,
    size: "Medium",
    abilityBonuses: { con: 2 },
    languages: ["Common", "Dwarvish"],
    traits: ["Darkvision", "Dwarven Resilience", "Stonecunning", "Dwarven Combat Training", "Tool Proficiency"],
  },
  {
    id: "elf",
    name: "Elf",
    speed: 30,
    size: "Medium",
    abilityBonuses: { dex: 2 },
    languages: ["Common", "Elvish"],
    traits: ["Darkvision", "Fey Ancestry", "Trance", "Keen Senses"],
  },
  {
    id: "gnome",
    name: "Gnome",
    speed: 25,
    size: "Small",
    abilityBonuses: { int: 2 },
    languages: ["Common", "Gnomish"],
    traits: ["Darkvision", "Gnome Cunning"],
  },
  {
    id: "half-elf",
    name: "Half-Elf",
    speed: 30,
    size: "Medium",
    abilityBonuses: { cha: 2 },
    languages: ["Common", "Elvish"],
    traits: ["Darkvision", "Fey Ancestry", "Skill Versatility", "+1 to 2 of your choice: STR/DEX/CON/INT/WIS"],
  },
  {
    id: "half-orc",
    name: "Half-Orc",
    speed: 30,
    size: "Medium",
    abilityBonuses: { str: 2, con: 1 },
    languages: ["Common", "Orc"],
    traits: ["Darkvision", "Savage Attacks", "Relentless Endurance", "Menacing"],
  },
  {
    id: "halfling",
    name: "Halfling",
    speed: 25,
    size: "Small",
    abilityBonuses: { dex: 2 },
    languages: ["Common", "Halfling"],
    traits: ["Brave", "Halfling Nimbleness", "Lucky"],
  },
  {
    id: "human",
    name: "Human",
    speed: 30,
    size: "Medium",
    abilityBonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    languages: ["Common"],
    traits: [],
  },
  {
    id: "tiefling",
    name: "Tiefling",
    speed: 30,
    size: "Medium",
    abilityBonuses: { int: 1, cha: 2 },
    languages: ["Common", "Infernal"],
    traits: ["Darkvision", "Hellish Resistance", "Infernal Legacy"],
  },
];
