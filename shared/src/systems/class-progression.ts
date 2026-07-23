// Per-class spellcasting progression (cantrips known, spells known, spell slots)
// and named class features by level, SRD 5.1 (CC-BY-4.0), sourced from the open
// 5e-bits/5e-database project. Feature names only — no rules text.
import type { Dnd5eAbility, Dnd5eSheetData } from "./dnd5e.js";
import { abilityModifier, effectiveAbilityScore } from "./dnd5e.js";

// Recommended ability-score priority order per class, general D&D community
// guidance (not licensed SRD content) -- purely an informational hint during
// character creation, highest-priority ability first.
export const CLASS_STAT_PRIORITY: Record<string, Dnd5eAbility[]> = {
  barbarian: ["str", "con", "dex"],
  bard: ["cha", "dex", "con"],
  cleric: ["wis", "con", "str"],
  druid: ["wis", "con", "dex"],
  fighter: ["str", "con", "dex"],
  monk: ["dex", "wis", "con"],
  paladin: ["str", "cha", "con"],
  ranger: ["dex", "wis", "con"],
  rogue: ["dex", "con", "wis"],
  sorcerer: ["cha", "con", "dex"],
  warlock: ["cha", "con", "dex"],
  wizard: ["int", "con", "dex"],
};

export function recommendedStatPriority(className: string): Dnd5eAbility[] | null {
  return CLASS_STAT_PRIORITY[normalizeClassId(className)] ?? null;
}

export interface ClassLevelEntry {
  level: number;
  cantripsKnown?: number;
  spellsKnown?: number;
  slots?: Record<number, number>;
  features?: string[];
  martial?: MartialLevelEntry;
}

// Per-class martial feature progression, SRD 5.1 (CC-BY-4.0). `rageCount: -1` means unlimited (barbarian 20).
export interface MartialLevelEntry {
  level: number;
  extraAttacks?: number;
  actionSurges?: number;
  indomitableUses?: number;
  rageCount?: number;
  rageDamageBonus?: number;
  brutalCriticalDice?: number;
  sneakAttack?: { diceCount: number; diceValue: number };
  martialArts?: { diceCount: number; diceValue: number };
  kiPoints?: number;
  unarmoredMovement?: number;
  auraRange?: number;
  favoredEnemies?: number;
  favoredTerrain?: number;
}

export type CasterType = "none" | "prepared" | "known" | "pact";

export const KNOWN_CASTER_CLASSES = ["bard", "sorcerer", "ranger", "warlock"];
export const PREPARED_CASTER_CLASSES = ["cleric", "druid", "paladin", "wizard"];
export const PACT_CASTER_CLASSES = ["warlock"];

export const CLASS_PROGRESSION: Record<string, ClassLevelEntry[]> = {
  barbarian: [
    { level: 1, features: ["Rage", "Unarmored Defense"] },
    { level: 2, features: ["Reckless Attack", "Danger Sense"] },
    { level: 3, features: ["Primal Path"] },
    { level: 3, features: ["Frenzy"] },
    { level: 4, features: ["Ability Score Improvement"] },
    { level: 5, features: ["Extra Attack", "Fast Movement"] },
    { level: 6, features: ["Path feature"] },
    { level: 6, features: ["Mindless Rage"] },
    { level: 7, features: ["Feral Instinct"] },
    { level: 8, features: ["Ability Score Improvement"] },
    { level: 9, features: ["Brutal Critical (1 die)"] },
    { level: 10, features: ["Path feature"] },
    { level: 10, features: ["Intimidating Presence"] },
    { level: 11, features: ["Relentless Rage"] },
    { level: 12, features: ["Ability Score Improvement"] },
    { level: 13, features: ["Brutal Critical (2 dice)"] },
    { level: 14, features: ["Path feature"] },
    { level: 14, features: ["Retaliation"] },
    { level: 15, features: ["Persistent Rage"] },
    { level: 16, features: ["Ability Score Improvement"] },
    { level: 17, features: ["Brutal Critical (3 dice)"] },
    { level: 18, features: ["Indomitable Might"] },
    { level: 19, features: ["Ability Score Improvement"] },
    { level: 20, features: ["Primal Champion"] },
  ],
  bard: [
    { level: 1, cantripsKnown: 2, spellsKnown: 4, slots: { 1: 2 }, features: ["Spellcasting: Bard", "Bardic Inspiration (d6)"] },
    { level: 2, cantripsKnown: 2, spellsKnown: 5, slots: { 1: 3 }, features: ["Jack of All Trades", "Song of Rest (d6)"] },
    { level: 3, cantripsKnown: 2, spellsKnown: 6, slots: { 1: 4, 2: 2 }, features: ["Expertise", "Bard College"] },
    { level: 3, features: ["Bonus Proficiencies", "Cutting Words"] },
    { level: 4, cantripsKnown: 3, spellsKnown: 7, slots: { 1: 4, 2: 3 }, features: ["Ability Score Improvement"] },
    { level: 5, cantripsKnown: 3, spellsKnown: 8, slots: { 1: 4, 2: 3, 3: 2 }, features: ["Bardic Inspiration (d8)", "Font of Inspiration"] },
    { level: 6, cantripsKnown: 3, spellsKnown: 9, slots: { 1: 4, 2: 3, 3: 3 }, features: ["Countercharm", "Bard College feature"] },
    { level: 6, features: ["Additional Magical Secrets"] },
    { level: 7, cantripsKnown: 3, spellsKnown: 10, slots: { 1: 4, 2: 3, 3: 3, 4: 1 } },
    { level: 8, cantripsKnown: 3, spellsKnown: 11, slots: { 1: 4, 2: 3, 3: 3, 4: 2 }, features: ["Ability Score Improvement"] },
    { level: 9, cantripsKnown: 3, spellsKnown: 12, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, features: ["Song of Rest (d8)"] },
    { level: 10, cantripsKnown: 4, spellsKnown: 14, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }, features: ["Expertise", "Bardic Inspiration (d10)", "Magical Secrets"] },
    { level: 11, cantripsKnown: 4, spellsKnown: 15, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 } },
    { level: 12, cantripsKnown: 4, spellsKnown: 15, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, features: ["Ability Score Improvement"] },
    { level: 13, cantripsKnown: 4, spellsKnown: 16, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 }, features: ["Song of Rest (d10)"] },
    { level: 14, cantripsKnown: 4, spellsKnown: 18, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 }, features: ["Magical Secrets", "Bard College feature"] },
    { level: 14, features: ["Peerless Skill"] },
    { level: 15, cantripsKnown: 4, spellsKnown: 19, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 }, features: ["Bardic Inspiration (d12)"] },
    { level: 16, cantripsKnown: 4, spellsKnown: 19, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 }, features: ["Ability Score Improvement"] },
    { level: 17, cantripsKnown: 4, spellsKnown: 20, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 }, features: ["Song of Rest (d12)"] },
    { level: 18, cantripsKnown: 4, spellsKnown: 22, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 }, features: ["Magical Secrets"] },
    { level: 19, cantripsKnown: 4, spellsKnown: 22, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 }, features: ["Ability Score Improvement"] },
    { level: 20, cantripsKnown: 4, spellsKnown: 22, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }, features: ["Superior Inspiration"] },
  ],
  cleric: [
    { level: 1, cantripsKnown: 3, slots: { 1: 2 }, features: ["Spellcasting: Cleric", "Divine Domain", "Domain Spells"] },
    { level: 1, features: ["Bonus Proficiency", "Disciple of Life"] },
    { level: 2, cantripsKnown: 3, slots: { 1: 3 }, features: ["Channel Divinity (1/rest)", "Channel Divinity: Turn Undead", "Divine Domain feature"] },
    { level: 2, features: ["Channel Divinity: Preserve Life"] },
    { level: 3, cantripsKnown: 3, slots: { 1: 4, 2: 2 }, features: ["Domain Spells"] },
    { level: 4, cantripsKnown: 4, slots: { 1: 4, 2: 3 }, features: ["Ability Score Improvement"] },
    { level: 5, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 2 }, features: ["Domain Spells", "Destroy Undead (CR 1/2 or below)"] },
    { level: 6, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 3 }, features: ["Channel Divinity (2/rest)", "Divine Domain feature"] },
    { level: 6, features: ["Blessed Healer"] },
    { level: 7, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 3, 4: 1 }, features: ["Domain Spells"] },
    { level: 8, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 3, 4: 2 }, features: ["Ability Score Improvement", "Destroy Undead (CR 1 or below)", "Divine Domain feature"] },
    { level: 8, features: ["Divine Strike"] },
    { level: 9, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, features: ["Domain Spells"] },
    { level: 10, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }, features: ["Divine Intervention"] },
    { level: 11, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, features: ["Destroy Undead (CR 2 or below)"] },
    { level: 12, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, features: ["Ability Score Improvement"] },
    { level: 13, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 } },
    { level: 14, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 }, features: ["Destroy Undead (CR 3 or below)"] },
    { level: 15, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 } },
    { level: 16, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 }, features: ["Ability Score Improvement"] },
    { level: 17, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 }, features: ["Destroy Undead (CR 4 or below)", "Divine Domain feature"] },
    { level: 17, features: ["Supreme Healing"] },
    { level: 18, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 }, features: ["Channel Divinity (3/rest)"] },
    { level: 19, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 }, features: ["Ability Score Improvement"] },
    { level: 20, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }, features: ["Divine Intervention Improvement"] },
  ],
  druid: [
    { level: 1, cantripsKnown: 2, slots: { 1: 2 }, features: ["Spellcasting: Druid", "Druidic"] },
    { level: 2, cantripsKnown: 2, slots: { 1: 3 }, features: ["Wild Shape (CR 1/4 or below, no flying or swim speed)", "Druid Circle"] },
    { level: 2, features: ["Bonus Cantrip", "Natural Recovery"] },
    { level: 3, cantripsKnown: 2, slots: { 1: 4, 2: 2 } },
    { level: 4, cantripsKnown: 3, slots: { 1: 4, 2: 3 }, features: ["Wild Shape (CR 1/2 or below, no flying speed)", "Ability Score Improvement"] },
    { level: 5, cantripsKnown: 3, slots: { 1: 4, 2: 3, 3: 2 } },
    { level: 6, cantripsKnown: 3, slots: { 1: 4, 2: 3, 3: 3 }, features: ["Druid Circle feature"] },
    { level: 6, features: ["Land's Stride"] },
    { level: 7, cantripsKnown: 3, slots: { 1: 4, 2: 3, 3: 3, 4: 1 } },
    { level: 8, cantripsKnown: 3, slots: { 1: 4, 2: 3, 3: 3, 4: 2 }, features: ["Wild Shape (CR 1 or below)", "Ability Score Improvement"] },
    { level: 9, cantripsKnown: 3, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 } },
    { level: 10, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }, features: ["Druid Circle feature"] },
    { level: 10, features: ["Nature's Ward"] },
    { level: 11, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 } },
    { level: 12, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, features: ["Ability Score Improvement"] },
    { level: 13, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 } },
    { level: 14, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 }, features: ["Druid Circle feature"] },
    { level: 14, features: ["Nature's Sanctuary"] },
    { level: 15, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 } },
    { level: 16, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 }, features: ["Ability Score Improvement"] },
    { level: 17, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 } },
    { level: 18, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 }, features: ["Timeless Body", "Beast Spells"] },
    { level: 19, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 }, features: ["Ability Score Improvement"] },
    { level: 20, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }, features: ["Archdruid"] },
  ],
  fighter: [
    { level: 1, features: ["Fighting Style", "Second Wind"] },
    { level: 2, features: ["Action Surge (1 use)"] },
    { level: 3, features: ["Martial Archetype"] },
    { level: 3, features: ["Improved Critical"] },
    { level: 4, features: ["Ability Score Improvement"] },
    { level: 5, features: ["Extra Attack"] },
    { level: 6, features: ["Ability Score Improvement"] },
    { level: 7, features: ["Martial Archetype feature"] },
    { level: 7, features: ["Remarkable Athlete"] },
    { level: 8, features: ["Ability Score Improvement"] },
    { level: 9, features: ["Indomitable (1 use)"] },
    { level: 10, features: ["Martial Archetype feature"] },
    { level: 10, features: ["Additional Fighting Style"] },
    { level: 11, features: ["Extra Attack (2)"] },
    { level: 12, features: ["Ability Score Improvement"] },
    { level: 13, features: ["Indomitable (2 uses)"] },
    { level: 14, features: ["Ability Score Improvement"] },
    { level: 15, features: ["Martial Archetype feature"] },
    { level: 15, features: ["Superior Critical"] },
    { level: 16, features: ["Ability Score Improvement"] },
    { level: 17, features: ["Action Surge (2 uses)", "Indomitable (3 uses)"] },
    { level: 18, features: ["Martial Archetype feature"] },
    { level: 18, features: ["Survivor"] },
    { level: 19, features: ["Ability Score Improvement"] },
    { level: 20, features: ["Extra Attack (3)"] },
  ],
  monk: [
    { level: 1, features: ["Unarmored Defense", "Martial Arts"] },
    { level: 2, features: ["Ki", "Flurry of Blows", "Patient Defense", "Step of the Wind", "Unarmored Movement"] },
    { level: 3, features: ["Monastic Tradition", "Deflect Missiles"] },
    { level: 3, features: ["Open Hand Technique"] },
    { level: 4, features: ["Ability Score Improvement", "Slow Fall"] },
    { level: 5, features: ["Extra Attack", "Stunning Strike"] },
    { level: 6, features: ["Ki Empowered Strikes", "Monastic Tradition feature"] },
    { level: 6, features: ["Wholeness of Body"] },
    { level: 7, features: ["Evasion", "Stillness of Mind"] },
    { level: 8, features: ["Ability Score Improvement"] },
    { level: 9, features: ["Unarmored Movement"] },
    { level: 10, features: ["Purity of Body"] },
    { level: 11, features: ["Monastic Tradition feature"] },
    { level: 11, features: ["Tranquility"] },
    { level: 12, features: ["Ability Score Improvement"] },
    { level: 13, features: ["Tongue of the Sun and Moon"] },
    { level: 14, features: ["Diamond Soul"] },
    { level: 15, features: ["Timeless Body"] },
    { level: 16, features: ["Ability Score Improvement"] },
    { level: 17, features: ["Monastic Tradition feature"] },
    { level: 17, features: ["Quivering Palm"] },
    { level: 18, features: ["Empty Body"] },
    { level: 19, features: ["Ability Score Improvement"] },
    { level: 20, features: ["Perfect Self"] },
  ],
  paladin: [
    { level: 1, features: ["Divine Sense", "Lay on Hands"] },
    { level: 2, slots: { 1: 2 }, features: ["Fighting Style", "Spellcasting: Paladin", "Divine Smite"] },
    { level: 3, slots: { 1: 3 }, features: ["Divine Health", "Sacred Oath", "Oath Spells", "Channel Divinity"] },
    { level: 3, features: ["Channel Divinity: Sacred Weapon", "Channel Divinity: Turn the Unholy"] },
    { level: 4, slots: { 1: 3 }, features: ["Ability Score Improvement"] },
    { level: 5, slots: { 1: 4, 2: 2 }, features: ["Extra Attack"] },
    { level: 6, slots: { 1: 4, 2: 2 }, features: ["Aura of Protection"] },
    { level: 7, slots: { 1: 4, 2: 3 }, features: ["Sacred Oath feature"] },
    { level: 7, features: ["Aura of Devotion"] },
    { level: 8, slots: { 1: 4, 2: 3 }, features: ["Ability Score Improvement"] },
    { level: 9, slots: { 1: 4, 2: 3, 3: 2 } },
    { level: 10, slots: { 1: 4, 2: 3, 3: 2 }, features: ["Aura of Courage"] },
    { level: 11, slots: { 1: 4, 2: 3, 3: 3 }, features: ["Improved Divine Smite"] },
    { level: 12, slots: { 1: 4, 2: 3, 3: 3 }, features: ["Ability Score Improvement"] },
    { level: 13, slots: { 1: 4, 2: 3, 3: 3, 4: 1 } },
    { level: 14, slots: { 1: 4, 2: 3, 3: 3, 4: 1 }, features: ["Cleansing Touch"] },
    { level: 15, slots: { 1: 4, 2: 3, 3: 3, 4: 2 }, features: ["Sacred Oath feature"] },
    { level: 15, features: ["Purity of Spirit"] },
    { level: 16, slots: { 1: 4, 2: 3, 3: 3, 4: 2 }, features: ["Ability Score Improvement"] },
    { level: 17, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 } },
    { level: 18, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, features: ["Aura improvements"] },
    { level: 18 },
    { level: 19, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }, features: ["Ability Score Improvement"] },
    { level: 20, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }, features: ["Sacred Oath feature"] },
    { level: 20, features: ["Holy Nimbus"] },
  ],
  ranger: [
    { level: 1, features: ["Favored Enemy (1 type)", "Natural Explorer (1 terrain type)"] },
    { level: 2, spellsKnown: 2, slots: { 1: 2 }, features: ["Fighting Style", "Spellcasting: Ranger"] },
    { level: 3, spellsKnown: 3, slots: { 1: 3 }, features: ["Ranger Archetype", "Primeval Awareness"] },
    { level: 3, features: ["Hunter's Prey"] },
    { level: 4, spellsKnown: 3, slots: { 1: 3 }, features: ["Ability Score Improvement"] },
    { level: 5, spellsKnown: 4, slots: { 1: 4, 2: 2 }, features: ["Extra Attack"] },
    { level: 6, spellsKnown: 4, slots: { 1: 4, 2: 2 }, features: ["Favored Enemy (2 types)", "Natural Explorer (2 terrain types)"] },
    { level: 7, spellsKnown: 5, slots: { 1: 4, 2: 3 }, features: ["Ranger Archetype feature"] },
    { level: 7, features: ["Defensive Tactics"] },
    { level: 8, spellsKnown: 5, slots: { 1: 4, 2: 3 }, features: ["Ability Score Improvement", "Land's Stride"] },
    { level: 9, spellsKnown: 6, slots: { 1: 4, 2: 3, 3: 2 } },
    { level: 10, spellsKnown: 6, slots: { 1: 4, 2: 3, 3: 2 }, features: ["Natural Explorer (3 terrain types)", "Hide in Plain Sight"] },
    { level: 11, spellsKnown: 7, slots: { 1: 4, 2: 3, 3: 3 }, features: ["Ranger Archetype feature"] },
    { level: 11, features: ["Multiattack"] },
    { level: 12, spellsKnown: 7, slots: { 1: 4, 2: 3, 3: 3 }, features: ["Ability Score Improvement"] },
    { level: 13, spellsKnown: 8, slots: { 1: 4, 2: 3, 3: 3, 4: 1 } },
    { level: 14, spellsKnown: 8, slots: { 1: 4, 2: 3, 3: 3, 4: 1 }, features: ["Favored Enemy (3 enemies)", "Vanish"] },
    { level: 15, spellsKnown: 9, slots: { 1: 4, 2: 3, 3: 3, 4: 2 }, features: ["Ranger Archetype feature"] },
    { level: 15, features: ["Superior Hunter's Defense"] },
    { level: 16, spellsKnown: 9, slots: { 1: 4, 2: 3, 3: 3, 4: 2 }, features: ["Ability Score Improvement"] },
    { level: 17, spellsKnown: 10, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 } },
    { level: 18, spellsKnown: 10, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 }, features: ["Feral Senses"] },
    { level: 19, spellsKnown: 11, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }, features: ["Ability Score Improvement"] },
    { level: 20, spellsKnown: 11, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }, features: ["Foe Slayer"] },
  ],
  rogue: [
    { level: 1, features: ["Expertise", "Sneak Attack", "Thieves' Cant"] },
    { level: 2, features: ["Cunning Action"] },
    { level: 3, features: ["Roguish Archetype"] },
    { level: 3, features: ["Fast Hands", "Second-Story Work"] },
    { level: 4, features: ["Ability Score Improvement"] },
    { level: 5, features: ["Uncanny Dodge"] },
    { level: 6, features: ["Expertise"] },
    { level: 7, features: ["Evasion"] },
    { level: 8, features: ["Ability Score Improvement"] },
    { level: 9, features: ["Roguish Archetype feature"] },
    { level: 9, features: ["Supreme Sneak"] },
    { level: 10, features: ["Ability Score Improvement"] },
    { level: 11, features: ["Reliable Talent"] },
    { level: 12, features: ["Ability Score Improvement"] },
    { level: 13, features: ["Roguish Archetype feature"] },
    { level: 13, features: ["Use Magic Device"] },
    { level: 14, features: ["Blindsense"] },
    { level: 15, features: ["Slippery Mind"] },
    { level: 16, features: ["Ability Score Improvement"] },
    { level: 17, features: ["Roguish Archetype feature"] },
    { level: 17, features: ["Thief's Reflexes"] },
    { level: 18, features: ["Elusive"] },
    { level: 19, features: ["Ability Score Improvement"] },
    { level: 20, features: ["Stroke of Luck"] },
  ],
  sorcerer: [
    { level: 1, cantripsKnown: 4, spellsKnown: 2, slots: { 1: 2 }, features: ["Spellcasting: Sorcerer", "Sorcerous Origin"] },
    { level: 1, features: ["Dragon Ancestor", "Draconic Resilience"] },
    { level: 2, cantripsKnown: 4, spellsKnown: 3, slots: { 1: 3 }, features: ["Font of Magic", "Flexible Casting: Creating Spell Slots", "Flexible Casting: Converting Spell Slot"] },
    { level: 3, cantripsKnown: 4, spellsKnown: 4, slots: { 1: 4, 2: 2 }, features: ["Metamagic"] },
    { level: 4, cantripsKnown: 5, spellsKnown: 5, slots: { 1: 4, 2: 3 }, features: ["Ability Score Improvement"] },
    { level: 5, cantripsKnown: 5, spellsKnown: 6, slots: { 1: 4, 2: 3, 3: 2 } },
    { level: 6, cantripsKnown: 5, spellsKnown: 7, slots: { 1: 4, 2: 3, 3: 3 }, features: ["Sorcerous Origin feature"] },
    { level: 6, features: ["Elemental Affinity"] },
    { level: 7, cantripsKnown: 5, spellsKnown: 8, slots: { 1: 4, 2: 3, 3: 3, 4: 1 } },
    { level: 8, cantripsKnown: 5, spellsKnown: 9, slots: { 1: 4, 2: 3, 3: 3, 4: 2 }, features: ["Ability Score Improvement"] },
    { level: 9, cantripsKnown: 5, spellsKnown: 10, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 } },
    { level: 10, cantripsKnown: 6, spellsKnown: 11, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }, features: ["Metamagic"] },
    { level: 11, cantripsKnown: 6, spellsKnown: 12, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 } },
    { level: 12, cantripsKnown: 6, spellsKnown: 12, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, features: ["Ability Score Improvement"] },
    { level: 13, cantripsKnown: 6, spellsKnown: 13, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 } },
    { level: 14, cantripsKnown: 6, spellsKnown: 13, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 }, features: ["Sorcerous Origin feature"] },
    { level: 14, features: ["Dragon Wings"] },
    { level: 15, cantripsKnown: 6, spellsKnown: 14, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 } },
    { level: 16, cantripsKnown: 6, spellsKnown: 14, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 }, features: ["Ability Score Improvement"] },
    { level: 17, cantripsKnown: 6, spellsKnown: 15, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 }, features: ["Metamagic"] },
    { level: 18, cantripsKnown: 6, spellsKnown: 15, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 }, features: ["Sorcerous Origin feature"] },
    { level: 18, features: ["Draconic Presence"] },
    { level: 19, cantripsKnown: 6, spellsKnown: 15, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 }, features: ["Ability Score Improvement"] },
    { level: 20, cantripsKnown: 6, spellsKnown: 15, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }, features: ["Sorcerous Restoration"] },
  ],
  warlock: [
    { level: 1, cantripsKnown: 2, spellsKnown: 2, slots: { 1: 1 }, features: ["Otherworldly Patron", "Pact Magic"] },
    { level: 1, features: ["Dark One's Blessing"] },
    { level: 2, cantripsKnown: 2, spellsKnown: 3, slots: { 1: 2 }, features: ["Eldritch Invocations"] },
    { level: 3, cantripsKnown: 2, spellsKnown: 4, slots: { 2: 2 }, features: ["Pact Boon"] },
    { level: 4, cantripsKnown: 3, spellsKnown: 5, slots: { 2: 2 }, features: ["Ability Score Improvement"] },
    { level: 5, cantripsKnown: 3, spellsKnown: 6, slots: { 3: 2 } },
    { level: 6, cantripsKnown: 3, spellsKnown: 7, slots: { 3: 2 }, features: ["Otherworldly Patron feature"] },
    { level: 6, features: ["Dark One's Own Luck"] },
    { level: 7, cantripsKnown: 3, spellsKnown: 8, slots: { 4: 2 } },
    { level: 8, cantripsKnown: 3, spellsKnown: 9, slots: { 4: 2 }, features: ["Ability Score Improvement"] },
    { level: 9, cantripsKnown: 3, spellsKnown: 10, slots: { 5: 2 } },
    { level: 10, cantripsKnown: 4, spellsKnown: 10, slots: { 5: 2 }, features: ["Otherworldly Patron feature"] },
    { level: 10, features: ["Fiendish Resilience"] },
    { level: 11, cantripsKnown: 4, spellsKnown: 11, slots: { 5: 3 }, features: ["Mystic Arcanum (6th level)"] },
    { level: 12, cantripsKnown: 4, spellsKnown: 11, slots: { 5: 3 }, features: ["Ability Score Improvement"] },
    { level: 13, cantripsKnown: 4, spellsKnown: 12, slots: { 5: 3 }, features: ["Mystic Arcanum (7th level)"] },
    { level: 14, cantripsKnown: 4, spellsKnown: 12, slots: { 5: 3 }, features: ["Otherworldly Patron feature"] },
    { level: 14, features: ["Hurl Through Hell"] },
    { level: 15, cantripsKnown: 4, spellsKnown: 13, slots: { 5: 3 }, features: ["Mystic Arcanum (8th level)"] },
    { level: 16, cantripsKnown: 4, spellsKnown: 13, slots: { 5: 3 }, features: ["Ability Score Improvement"] },
    { level: 17, cantripsKnown: 4, spellsKnown: 14, slots: { 5: 4 }, features: ["Mystic Arcanum (9th level)"] },
    { level: 18, cantripsKnown: 4, spellsKnown: 14, slots: { 5: 4 } },
    { level: 19, cantripsKnown: 4, spellsKnown: 15, slots: { 5: 4 }, features: ["Ability Score Improvement"] },
    { level: 20, cantripsKnown: 4, spellsKnown: 15, slots: { 5: 4 }, features: ["Eldritch Master"] },
  ],
  wizard: [
    { level: 1, cantripsKnown: 3, slots: { 1: 2 }, features: ["Spellcasting: Wizard", "Arcane Recovery"] },
    { level: 2, cantripsKnown: 3, slots: { 1: 3 }, features: ["Arcane Tradition"] },
    { level: 2, features: ["Evocation Savant", "Sculpt Spells"] },
    { level: 3, cantripsKnown: 3, slots: { 1: 4, 2: 2 } },
    { level: 4, cantripsKnown: 4, slots: { 1: 4, 2: 3 }, features: ["Ability Score Improvement"] },
    { level: 5, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 2 } },
    { level: 6, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 3 }, features: ["Arcane Tradition feature"] },
    { level: 6, features: ["Potent Cantrip"] },
    { level: 7, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 3, 4: 1 } },
    { level: 8, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 3, 4: 2 }, features: ["Ability Score Improvement"] },
    { level: 9, cantripsKnown: 4, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 } },
    { level: 10, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 }, features: ["Arcane Tradition feature"] },
    { level: 10, features: ["Empowered Evocation"] },
    { level: 11, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 } },
    { level: 12, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 }, features: ["Ability Score Improvement"] },
    { level: 13, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 } },
    { level: 14, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 }, features: ["Arcane Tradition feature"] },
    { level: 14, features: ["Overchannel"] },
    { level: 15, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 } },
    { level: 16, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 }, features: ["Ability Score Improvement"] },
    { level: 17, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 } },
    { level: 18, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 }, features: ["Spell Mastery"] },
    { level: 19, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 }, features: ["Ability Score Improvement"] },
    { level: 20, cantripsKnown: 5, slots: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 }, features: ["Signature Spell"] },
  ],
};

export const MARTIAL_PROGRESSION: Record<string, MartialLevelEntry[]> = {
  barbarian: [
    { level: 1, rageCount: 2, rageDamageBonus: 2 },
    { level: 2, rageCount: 2, rageDamageBonus: 2 },
    { level: 3, rageCount: 3, rageDamageBonus: 2 },
    { level: 4, rageCount: 3, rageDamageBonus: 2 },
    { level: 5, rageCount: 3, rageDamageBonus: 2 },
    { level: 6, rageCount: 4, rageDamageBonus: 2 },
    { level: 7, rageCount: 4, rageDamageBonus: 2 },
    { level: 8, rageCount: 4, rageDamageBonus: 2 },
    { level: 9, rageCount: 4, rageDamageBonus: 3, brutalCriticalDice: 1 },
    { level: 10, rageCount: 4, rageDamageBonus: 3, brutalCriticalDice: 1 },
    { level: 11, rageCount: 4, rageDamageBonus: 3, brutalCriticalDice: 1 },
    { level: 12, rageCount: 5, rageDamageBonus: 3, brutalCriticalDice: 1 },
    { level: 13, rageCount: 5, rageDamageBonus: 3, brutalCriticalDice: 2 },
    { level: 14, rageCount: 5, rageDamageBonus: 3, brutalCriticalDice: 2 },
    { level: 15, rageCount: 5, rageDamageBonus: 3, brutalCriticalDice: 2 },
    { level: 16, rageCount: 5, rageDamageBonus: 4, brutalCriticalDice: 2 },
    { level: 17, rageCount: 6, rageDamageBonus: 4, brutalCriticalDice: 3 },
    { level: 18, rageCount: 6, rageDamageBonus: 4, brutalCriticalDice: 3 },
    { level: 19, rageCount: 6, rageDamageBonus: 4, brutalCriticalDice: 3 },
    { level: 20, rageCount: -1, rageDamageBonus: 4, brutalCriticalDice: 3 },
  ],
  fighter: [
    { level: 2, actionSurges: 1 },
    { level: 3, actionSurges: 1 },
    { level: 4, actionSurges: 1 },
    { level: 5, extraAttacks: 1, actionSurges: 1 },
    { level: 6, extraAttacks: 1, actionSurges: 1 },
    { level: 7, extraAttacks: 1, actionSurges: 1 },
    { level: 8, extraAttacks: 1, actionSurges: 1 },
    { level: 9, extraAttacks: 1, actionSurges: 1, indomitableUses: 1 },
    { level: 10, extraAttacks: 1, actionSurges: 1, indomitableUses: 1 },
    { level: 11, extraAttacks: 2, actionSurges: 1, indomitableUses: 1 },
    { level: 12, extraAttacks: 2, actionSurges: 1, indomitableUses: 1 },
    { level: 13, extraAttacks: 2, actionSurges: 1, indomitableUses: 2 },
    { level: 14, extraAttacks: 2, actionSurges: 1, indomitableUses: 2 },
    { level: 15, extraAttacks: 2, actionSurges: 1, indomitableUses: 2 },
    { level: 16, extraAttacks: 2, actionSurges: 1, indomitableUses: 2 },
    { level: 17, extraAttacks: 2, actionSurges: 2, indomitableUses: 3 },
    { level: 18, extraAttacks: 2, actionSurges: 2, indomitableUses: 3 },
    { level: 19, extraAttacks: 2, actionSurges: 2, indomitableUses: 3 },
    { level: 20, extraAttacks: 3, actionSurges: 2, indomitableUses: 3 },
  ],
  monk: [
    { level: 1, martialArts: { diceCount: 1, diceValue: 4 } },
    { level: 2, martialArts: { diceCount: 1, diceValue: 4 }, kiPoints: 2, unarmoredMovement: 10 },
    { level: 3, martialArts: { diceCount: 1, diceValue: 4 }, kiPoints: 3, unarmoredMovement: 10 },
    { level: 4, martialArts: { diceCount: 1, diceValue: 4 }, kiPoints: 4, unarmoredMovement: 10 },
    { level: 5, martialArts: { diceCount: 1, diceValue: 6 }, kiPoints: 5, unarmoredMovement: 10 },
    { level: 6, martialArts: { diceCount: 1, diceValue: 6 }, kiPoints: 6, unarmoredMovement: 15 },
    { level: 7, martialArts: { diceCount: 1, diceValue: 6 }, kiPoints: 7, unarmoredMovement: 15 },
    { level: 8, martialArts: { diceCount: 1, diceValue: 6 }, kiPoints: 8, unarmoredMovement: 15 },
    { level: 9, martialArts: { diceCount: 1, diceValue: 6 }, kiPoints: 9, unarmoredMovement: 15 },
    { level: 10, martialArts: { diceCount: 1, diceValue: 6 }, kiPoints: 10, unarmoredMovement: 20 },
    { level: 11, martialArts: { diceCount: 1, diceValue: 8 }, kiPoints: 11, unarmoredMovement: 20 },
    { level: 12, martialArts: { diceCount: 1, diceValue: 8 }, kiPoints: 12, unarmoredMovement: 20 },
    { level: 13, martialArts: { diceCount: 1, diceValue: 8 }, kiPoints: 13, unarmoredMovement: 20 },
    { level: 14, martialArts: { diceCount: 1, diceValue: 8 }, kiPoints: 14, unarmoredMovement: 25 },
    { level: 15, martialArts: { diceCount: 1, diceValue: 8 }, kiPoints: 15, unarmoredMovement: 25 },
    { level: 16, martialArts: { diceCount: 1, diceValue: 8 }, kiPoints: 16, unarmoredMovement: 25 },
    { level: 17, martialArts: { diceCount: 1, diceValue: 10 }, kiPoints: 17, unarmoredMovement: 25 },
    { level: 18, martialArts: { diceCount: 1, diceValue: 10 }, kiPoints: 18, unarmoredMovement: 30 },
    { level: 19, martialArts: { diceCount: 1, diceValue: 10 }, kiPoints: 19, unarmoredMovement: 30 },
    { level: 20, martialArts: { diceCount: 1, diceValue: 10 }, kiPoints: 20, unarmoredMovement: 30 },
  ],
  paladin: [
    { level: 6, auraRange: 10 },
    { level: 7, auraRange: 10 },
    { level: 8, auraRange: 10 },
    { level: 9, auraRange: 10 },
    { level: 10, auraRange: 10 },
    { level: 11, auraRange: 10 },
    { level: 12, auraRange: 10 },
    { level: 13, auraRange: 10 },
    { level: 14, auraRange: 10 },
    { level: 15, auraRange: 10 },
    { level: 16, auraRange: 10 },
    { level: 17, auraRange: 10 },
    { level: 18, auraRange: 30 },
    { level: 19, auraRange: 30 },
    { level: 20, auraRange: 30 },
  ],
  ranger: [
    { level: 1, favoredEnemies: 1, favoredTerrain: 1 },
    { level: 2, favoredEnemies: 1, favoredTerrain: 1 },
    { level: 3, favoredEnemies: 1, favoredTerrain: 1 },
    { level: 4, favoredEnemies: 1, favoredTerrain: 1 },
    { level: 5, favoredEnemies: 1, favoredTerrain: 1 },
    { level: 6, favoredEnemies: 2, favoredTerrain: 2 },
    { level: 7, favoredEnemies: 2, favoredTerrain: 2 },
    { level: 8, favoredEnemies: 2, favoredTerrain: 2 },
    { level: 9, favoredEnemies: 2, favoredTerrain: 2 },
    { level: 10, favoredEnemies: 2, favoredTerrain: 3 },
    { level: 11, favoredEnemies: 2, favoredTerrain: 3 },
    { level: 12, favoredEnemies: 2, favoredTerrain: 3 },
    { level: 13, favoredEnemies: 2, favoredTerrain: 3 },
    { level: 14, favoredEnemies: 3, favoredTerrain: 3 },
    { level: 15, favoredEnemies: 3, favoredTerrain: 3 },
    { level: 16, favoredEnemies: 3, favoredTerrain: 3 },
    { level: 17, favoredEnemies: 3, favoredTerrain: 3 },
    { level: 18, favoredEnemies: 3, favoredTerrain: 3 },
    { level: 19, favoredEnemies: 3, favoredTerrain: 3 },
    { level: 20, favoredEnemies: 3, favoredTerrain: 3 },
  ],
  rogue: [
    { level: 1, sneakAttack: { diceCount: 1, diceValue: 6 } },
    { level: 2, sneakAttack: { diceCount: 1, diceValue: 6 } },
    { level: 3, sneakAttack: { diceCount: 2, diceValue: 6 } },
    { level: 4, sneakAttack: { diceCount: 2, diceValue: 6 } },
    { level: 5, sneakAttack: { diceCount: 3, diceValue: 6 } },
    { level: 6, sneakAttack: { diceCount: 3, diceValue: 6 } },
    { level: 7, sneakAttack: { diceCount: 4, diceValue: 6 } },
    { level: 8, sneakAttack: { diceCount: 4, diceValue: 6 } },
    { level: 9, sneakAttack: { diceCount: 5, diceValue: 6 } },
    { level: 10, sneakAttack: { diceCount: 5, diceValue: 6 } },
    { level: 11, sneakAttack: { diceCount: 6, diceValue: 6 } },
    { level: 12, sneakAttack: { diceCount: 6, diceValue: 6 } },
    { level: 13, sneakAttack: { diceCount: 7, diceValue: 6 } },
    { level: 14, sneakAttack: { diceCount: 7, diceValue: 6 } },
    { level: 15, sneakAttack: { diceCount: 8, diceValue: 6 } },
    { level: 16, sneakAttack: { diceCount: 8, diceValue: 6 } },
    { level: 17, sneakAttack: { diceCount: 9, diceValue: 6 } },
    { level: 18, sneakAttack: { diceCount: 9, diceValue: 6 } },
    { level: 19, sneakAttack: { diceCount: 10, diceValue: 6 } },
    { level: 20, sneakAttack: { diceCount: 10, diceValue: 6 } },
  ],
};

export function normalizeClassId(className: string): string {
  return className.trim().toLowerCase();
}

// SRD Warlock "Invocations Known" progression (PHB table), by character level.
const WARLOCK_INVOCATIONS_KNOWN: { level: number; count: number }[] = [
  { level: 2, count: 2 },
  { level: 5, count: 3 },
  { level: 7, count: 4 },
  { level: 9, count: 5 },
  { level: 12, count: 6 },
  { level: 15, count: 7 },
  { level: 18, count: 8 },
];

/** How many Eldritch Invocations a Warlock of the given level is expected to know (0 below level 2). */
export function expectedInvocationsKnown(level: number): number {
  let count = 0;
  for (const entry of WARLOCK_INVOCATIONS_KNOWN) {
    if (level >= entry.level) count = entry.count;
  }
  return count;
}

// SRD Warlock Mystic Arcanum spell-level tiers unlock at these character levels (one spell each,
// castable once per long rest without expending a Pact Magic slot).
export const MYSTIC_ARCANUM_TIERS: { spellLevel: 6 | 7 | 8 | 9; charLevel: number }[] = [
  { spellLevel: 6, charLevel: 11 },
  { spellLevel: 7, charLevel: 13 },
  { spellLevel: 8, charLevel: 15 },
  { spellLevel: 9, charLevel: 17 },
];

/** Mystic Arcanum spell-level tiers a Warlock of the given level has unlocked. */
export function unlockedArcanumTiers(level: number): number[] {
  return MYSTIC_ARCANUM_TIERS.filter((t) => level >= t.charLevel).map((t) => t.spellLevel);
}

/** Number of Eldritch Blast beams by character level: 1 at 1-4, 2 at 5-10, 3 at 11-16, 4 at 17+. */
export function eldritchBlastBeams(level: number): number {
  if (level >= 17) return 4;
  if (level >= 11) return 3;
  if (level >= 5) return 2;
  return 1;
}

export function casterTypeForClass(className: string): CasterType {
  const id = normalizeClassId(className);
  if (PACT_CASTER_CLASSES.includes(id)) return "pact";
  if (KNOWN_CASTER_CLASSES.includes(id)) return "known";
  if (PREPARED_CASTER_CLASSES.includes(id)) return "prepared";
  return "none";
}

// Casting ability per prepared caster -- Wizard uses a spellbook (a restricted personal
// subset of the class list); Cleric/Druid/Paladin prepare from their entire class list.
export const PREPARED_CASTER_ABILITY: Record<string, Dnd5eAbility> = {
  wizard: "int",
  cleric: "wis",
  druid: "wis",
  paladin: "cha",
};

export function preparedCasterAbility(className: string): Dnd5eAbility | null {
  return PREPARED_CASTER_ABILITY[normalizeClassId(className)] ?? null;
}

/** How many spells a prepared caster can have prepared: ability modifier + level (min 1). */
export function maxPreparedSpells(sheet: Dnd5eSheetData): number {
  const ability = preparedCasterAbility(sheet.class);
  if (!ability) return 0;
  return Math.max(1, abilityModifier(effectiveAbilityScore(sheet, ability)) + sheet.level);
}

/** Wizard-only: has a personal spellbook, restricting which spells can be prepared. */
export function usesSpellbook(className: string): boolean {
  return normalizeClassId(className) === "wizard";
}

export function martialLevelEntry(className: string, level: number): MartialLevelEntry | null {
  const entries = MARTIAL_PROGRESSION[normalizeClassId(className)];
  if (!entries) return null;
  let best: MartialLevelEntry | null = null;
  for (const e of entries) {
    if (e.level <= level) best = e;
  }
  return best;
}

export function classLevelEntry(className: string, level: number): ClassLevelEntry | null {
  const entries = CLASS_PROGRESSION[normalizeClassId(className)];
  if (!entries) return null;
  // Multiple entries can share the same level (features split across lines for readability),
  // so merge every entry at the highest level <= the character's level rather than picking one.
  const highestLevel = entries.reduce((max, e) => (e.level <= level ? Math.max(max, e.level) : max), -1);
  if (highestLevel === -1) return null;
  const merged: ClassLevelEntry = { level: highestLevel };
  for (const e of entries) {
    if (e.level !== highestLevel) continue;
    if (e.cantripsKnown !== undefined) merged.cantripsKnown = e.cantripsKnown;
    if (e.spellsKnown !== undefined) merged.spellsKnown = e.spellsKnown;
    if (e.slots !== undefined) merged.slots = e.slots;
    if (e.features) merged.features = [...(merged.features ?? []), ...e.features];
  }
  merged.martial = martialLevelEntry(className, level) ?? undefined;
  return merged;
}

/** Highest spell level (1-9) with an available slot at this class+level; 0 if none (cantrips only). */
export function maxPreparableSpellLevel(className: string, level: number): number {
  const entry = classLevelEntry(className, level);
  if (!entry?.slots) return 0;
  const levels = Object.keys(entry.slots).map(Number);
  return levels.length > 0 ? Math.max(...levels) : 0;
}

export function expectedSpellsKnown(className: string, level: number): number | null {
  const entry = classLevelEntry(className, level);
  return entry?.spellsKnown ?? null;
}

export function expectedSlots(className: string, level: number): Record<number, number> {
  const entry = classLevelEntry(className, level);
  return entry?.slots ?? {};
}

export function expectedCantripsKnown(className: string, level: number): number | null {
  const entry = classLevelEntry(className, level);
  return entry?.cantripsKnown ?? null;
}

/** Human-readable lines for the sheet's derived "Martial features" panel. Empty for non-martial classes/levels. */
export function martialFeatureLines(martial: MartialLevelEntry | null | undefined): string[] {
  if (!martial) return [];
  const lines: string[] = [];
  if (martial.extraAttacks) lines.push(`Extra Attacks: ${martial.extraAttacks}`);
  if (martial.actionSurges) lines.push(`Action Surge: ${martial.actionSurges}/rest`);
  if (martial.indomitableUses) lines.push(`Indomitable: ${martial.indomitableUses}/rest`);
  if (martial.rageCount) {
    const count = martial.rageCount === -1 ? "Unlimited" : `${martial.rageCount}/day`;
    lines.push(`Rage: ${count}${martial.rageDamageBonus ? ` (+${martial.rageDamageBonus} dmg)` : ""}`);
  }
  if (martial.brutalCriticalDice) lines.push(`Brutal Critical: +${martial.brutalCriticalDice} dice`);
  if (martial.sneakAttack) lines.push(`Sneak Attack: ${martial.sneakAttack.diceCount}d${martial.sneakAttack.diceValue}`);
  if (martial.martialArts) lines.push(`Martial Arts: ${martial.martialArts.diceCount}d${martial.martialArts.diceValue}`);
  if (martial.kiPoints) lines.push(`Ki Points: ${martial.kiPoints}`);
  if (martial.unarmoredMovement) lines.push(`Unarmored Movement: +${martial.unarmoredMovement} ft`);
  if (martial.auraRange) lines.push(`Aura Range: ${martial.auraRange} ft`);
  if (martial.favoredEnemies) lines.push(`Favored Enemies: ${martial.favoredEnemies}`);
  if (martial.favoredTerrain) lines.push(`Favored Terrains: ${martial.favoredTerrain}`);
  return lines;
}
