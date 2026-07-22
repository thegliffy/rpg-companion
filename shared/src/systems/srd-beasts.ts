import { SRD_MONSTERS } from "./srd-monsters.js";

// Wild Shape's beast list is a derived slice of the full SRD monster set (srd-monsters.ts) --
// mechanical fields only, attacks limited to single-target ones with a structured attack bonus
// and damage dice (damage dice already bake in the beast's modifier, e.g. "2d4+2", so they're
// directly rollable). Multiattack and non-damage actions are dropped since they don't fit a
// single "Roll" button.
export interface BeastAttack {
  name: string;
  attackBonus: number;
  damageDice: string;
  damageType: string;
}

export interface SrdBeast {
  id: string;
  name: string;
  size: string;
  cr: number;
  ac: number;
  hp: number;
  hitDice: string;
  speed: { walk?: number; fly?: number; swim?: number; climb?: number; burrow?: number };
  str: number; dex: number; con: number; int: number; wis: number; cha: number;
  passivePerception: number;
  attacks: BeastAttack[];
}

export const SRD_BEASTS: SrdBeast[] = SRD_MONSTERS.filter((m) => m.type === "beast").map((m) => ({
  id: m.id,
  name: m.name,
  size: m.size,
  cr: m.cr,
  ac: m.ac,
  hp: m.hp,
  hitDice: m.hitDice,
  speed: m.speed,
  str: m.str,
  dex: m.dex,
  con: m.con,
  int: m.int,
  wis: m.wis,
  cha: m.cha,
  passivePerception: m.senses.passivePerception,
  attacks: m.actions
    .filter((a): a is typeof a & { attackBonus: number; damageDice: string; damageType: string } =>
      a.attackBonus !== undefined && a.damageDice !== undefined && a.damageType !== undefined,
    )
    .map((a) => ({ name: a.name, attackBonus: a.attackBonus, damageDice: a.damageDice, damageType: a.damageType })),
}));

/** Max Wild Shape beast CR by druid level (RAW: 1/4 at L2, 1/2 at L4, 1 at L8). */
export function maxWildShapeCR(level: number): number {
  if (level < 4) return 0.25;
  if (level < 8) return 0.5;
  return 1;
}

/** Whether a druid of the given level may Wild Shape into this beast (CR + movement restrictions). */
export function wildShapeEligible(beast: SrdBeast, level: number): boolean {
  if (beast.cr > maxWildShapeCR(level)) return false;
  if (beast.speed.fly && level < 8) return false; // no flying speed until level 8
  if (beast.speed.swim && level < 4) return false; // no swimming speed until level 4
  return true;
}

export function findBeast(id: string): SrdBeast | undefined {
  return SRD_BEASTS.find((b) => b.id === id);
}

/** Human-readable CR (e.g. 0.25 -> "1/4"). */
export function formatCR(cr: number): string {
  if (cr === 0.125) return "1/8";
  if (cr === 0.25) return "1/4";
  if (cr === 0.5) return "1/2";
  return String(cr);
}
