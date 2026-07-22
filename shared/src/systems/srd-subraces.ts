// SRD 5.1 subraces (CC-BY-4.0), sourced from the open 5e-bits/5e-database project.
// Ability bonuses + trait names only -- no rules text. Stacks on top of the parent race.
import type { Dnd5eAbility } from "./dnd5e.js";

export interface SrdSubrace {
  id: string;
  name: string;
  parentRace: string;
  abilityBonuses: Partial<Record<Dnd5eAbility, number>>;
  traits: string[];
}

export const SRD_SUBRACES: SrdSubrace[] = [
  { id: "high-elf", name: "High Elf", parentRace: "Elf", abilityBonuses: { int: 1 }, traits: ["Elf Weapon Training", "High Elf Cantrip", "Extra Language"] },
  { id: "hill-dwarf", name: "Hill Dwarf", parentRace: "Dwarf", abilityBonuses: { wis: 1 }, traits: ["Dwarven Toughness"] },
  { id: "lightfoot-halfling", name: "Lightfoot Halfling", parentRace: "Halfling", abilityBonuses: { cha: 1 }, traits: ["Naturally Stealthy"] },
  { id: "rock-gnome", name: "Rock Gnome", parentRace: "Gnome", abilityBonuses: { con: 1 }, traits: ["Artificer's Lore", "Tinker"] },
];
