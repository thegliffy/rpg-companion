import { z } from "zod";

export const PF2E_ABILITIES = ["str", "dex", "con", "int", "wis", "cha"] as const;
export type Pf2eAbility = (typeof PF2E_ABILITIES)[number];

export const PF2E_ABILITY_NAMES: Record<Pf2eAbility, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

// Proficiency ranks: untrained/trained/expert/master/legendary
export const PF2E_RANKS = ["untrained", "trained", "expert", "master", "legendary"] as const;
export type Pf2eRank = (typeof PF2E_RANKS)[number];

export const PF2E_RANK_BONUS: Record<Pf2eRank, number> = {
  untrained: 0,
  trained: 2,
  expert: 4,
  master: 6,
  legendary: 8,
};

export const PF2E_SKILLS: { id: string; name: string; ability: Pf2eAbility }[] = [
  { id: "acrobatics", name: "Acrobatics", ability: "dex" },
  { id: "arcana", name: "Arcana", ability: "int" },
  { id: "athletics", name: "Athletics", ability: "str" },
  { id: "crafting", name: "Crafting", ability: "int" },
  { id: "deception", name: "Deception", ability: "cha" },
  { id: "diplomacy", name: "Diplomacy", ability: "cha" },
  { id: "intimidation", name: "Intimidation", ability: "cha" },
  { id: "medicine", name: "Medicine", ability: "wis" },
  { id: "nature", name: "Nature", ability: "wis" },
  { id: "occultism", name: "Occultism", ability: "int" },
  { id: "performance", name: "Performance", ability: "cha" },
  { id: "religion", name: "Religion", ability: "wis" },
  { id: "society", name: "Society", ability: "int" },
  { id: "stealth", name: "Stealth", ability: "dex" },
  { id: "survival", name: "Survival", ability: "wis" },
  { id: "thievery", name: "Thievery", ability: "dex" },
];

const rankSchema = z.enum(PF2E_RANKS);
const abilityScoreSchema = z.number().int().min(1).max(30);

const attackSchema = z.object({
  id: z.string().min(1),
  name: z.string().max(100),
  bonus: z.string().max(20),
  damage: z.string().max(60),
});

export const pf2eSheetSchema = z.object({
  class: z.string().max(60).default(""),
  ancestry: z.string().max(60).default(""),
  background: z.string().max(60).default(""),
  level: z.number().int().min(1).max(20).default(1),
  abilities: z.object({
    str: abilityScoreSchema.default(10),
    dex: abilityScoreSchema.default(10),
    con: abilityScoreSchema.default(10),
    int: abilityScoreSchema.default(10),
    wis: abilityScoreSchema.default(10),
    cha: abilityScoreSchema.default(10),
  }),
  perceptionRank: rankSchema.default("untrained"),
  saves: z.object({
    fortitude: rankSchema.default("untrained"),
    reflex: rankSchema.default("untrained"),
    will: rankSchema.default("untrained"),
  }),
  skillRanks: z.record(z.string().max(40), rankSchema).default({}),
  ac: z.number().int().min(0).max(50).default(10),
  speed: z.number().int().min(0).max(200).default(25),
  heroPoints: z.number().int().min(0).max(3).default(1),
  attacks: z.array(attackSchema).max(20).default([]),
  featsText: z.string().max(8000).default(""),
  spellsText: z.string().max(8000).default(""),
  equipmentText: z.string().max(4000).default(""),
  notesText: z.string().max(4000).default(""),
});

export type Pf2eSheetData = z.infer<typeof pf2eSheetSchema>;

export function pf2eAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function pf2eRankBonus(rank: Pf2eRank, level: number): number {
  return rank === "untrained" ? 0 : PF2E_RANK_BONUS[rank] + level;
}

export function pf2eSaveBonus(sheet: Pf2eSheetData, save: "fortitude" | "reflex" | "will"): number {
  const abilityBySave = { fortitude: "con", reflex: "dex", will: "wis" } as const;
  return (
    pf2eAbilityModifier(sheet.abilities[abilityBySave[save]]) + pf2eRankBonus(sheet.saves[save], sheet.level)
  );
}

export function pf2eSkillBonus(sheet: Pf2eSheetData, skillId: string): number {
  const skill = PF2E_SKILLS.find((s) => s.id === skillId);
  if (!skill) return 0;
  const rank = sheet.skillRanks[skillId] ?? "untrained";
  return pf2eAbilityModifier(sheet.abilities[skill.ability]) + pf2eRankBonus(rank, sheet.level);
}

export function pf2ePerceptionBonus(sheet: Pf2eSheetData): number {
  return pf2eAbilityModifier(sheet.abilities.wis) + pf2eRankBonus(sheet.perceptionRank, sheet.level);
}

export function emptyPf2eSheet(): Pf2eSheetData {
  return pf2eSheetSchema.parse({ abilities: {}, saves: {} });
}

export const pf2eSystem = {
  id: "pf2e" as const,
  name: "Pathfinder 2e",
  schema: pf2eSheetSchema,
  emptySheet: emptyPf2eSheet,
};
