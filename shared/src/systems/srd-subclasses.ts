// SRD 5.1 subclasses (CC-BY-4.0), sourced from the open 5e-bits/5e-database project.
// Feature names per level only -- no rules text. Feeds the Level Up flow like base-class features.
import type { ClassLevelEntry } from "./class-progression.js";

export interface SrdSubclass {
  id: string;
  name: string;
  parentClass: string;
  levels: ClassLevelEntry[];
}

export const SRD_SUBCLASSES: SrdSubclass[] = [
  { id: "berserker", name: "Berserker", parentClass: "Barbarian", levels: [{ level: 3, features: ["Frenzy"] }, { level: 6, features: ["Mindless Rage"] }, { level: 10, features: ["Intimidating Presence"] }, { level: 14, features: ["Retaliation"] }] },
  { id: "lore", name: "Lore", parentClass: "Bard", levels: [{ level: 3, features: ["Bonus Proficiencies", "Cutting Words"] }, { level: 6, features: ["Additional Magical Secrets"] }, { level: 14, features: ["Peerless Skill"] }] },
  { id: "life", name: "Life", parentClass: "Cleric", levels: [{ level: 1, features: ["Bonus Proficiency", "Disciple of Life"] }, { level: 2, features: ["Channel Divinity: Preserve Life"] }, { level: 6, features: ["Blessed Healer"] }, { level: 8, features: ["Divine Strike"] }, { level: 17, features: ["Supreme Healing"] }] },
  { id: "land", name: "Land", parentClass: "Druid", levels: [{ level: 2, features: ["Bonus Cantrip", "Natural Recovery"] }, { level: 6, features: ["Land's Stride"] }, { level: 10, features: ["Nature's Ward"] }, { level: 14, features: ["Nature's Sanctuary"] }] },
  { id: "champion", name: "Champion", parentClass: "Fighter", levels: [{ level: 3, features: ["Improved Critical"] }, { level: 7, features: ["Remarkable Athlete"] }, { level: 10, features: ["Additional Fighting Style"] }, { level: 15, features: ["Superior Critical"] }, { level: 18, features: ["Survivor"] }] },
  { id: "open-hand", name: "Open Hand", parentClass: "Monk", levels: [{ level: 3, features: ["Open Hand Technique"] }, { level: 6, features: ["Wholeness of Body"] }, { level: 11, features: ["Tranquility"] }, { level: 17, features: ["Quivering Palm"] }] },
  { id: "devotion", name: "Devotion", parentClass: "Paladin", levels: [{ level: 3, features: ["Channel Divinity: Sacred Weapon", "Channel Divinity: Turn the Unholy"] }, { level: 7, features: ["Aura of Devotion"] }, { level: 15, features: ["Purity of Spirit"] }, { level: 20, features: ["Holy Nimbus"] }] },
  { id: "hunter", name: "Hunter", parentClass: "Ranger", levels: [{ level: 3, features: ["Hunter's Prey"] }, { level: 7, features: ["Defensive Tactics"] }, { level: 11, features: ["Multiattack"] }, { level: 15, features: ["Superior Hunter's Defense"] }] },
  { id: "thief", name: "Thief", parentClass: "Rogue", levels: [{ level: 3, features: ["Fast Hands", "Second-Story Work"] }, { level: 9, features: ["Supreme Sneak"] }, { level: 13, features: ["Use Magic Device"] }, { level: 17, features: ["Thief's Reflexes"] }] },
  { id: "draconic", name: "Draconic", parentClass: "Sorcerer", levels: [{ level: 1, features: ["Dragon Ancestor", "Draconic Resilience"] }, { level: 6, features: ["Elemental Affinity"] }, { level: 14, features: ["Dragon Wings"] }, { level: 18, features: ["Draconic Presence"] }] },
  { id: "fiend", name: "Fiend", parentClass: "Warlock", levels: [{ level: 1, features: ["Dark One's Blessing"] }, { level: 6, features: ["Dark One's Own Luck"] }, { level: 10, features: ["Fiendish Resilience"] }, { level: 14, features: ["Hurl Through Hell"] }] },
  { id: "evocation", name: "Evocation", parentClass: "Wizard", levels: [{ level: 2, features: ["Evocation Savant", "Sculpt Spells"] }, { level: 6, features: ["Potent Cantrip"] }, { level: 10, features: ["Empowered Evocation"] }, { level: 14, features: ["Overchannel"] }] },
];
