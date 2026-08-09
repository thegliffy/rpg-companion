// Hand-curated healing data for SRD 5.1 spells whose whole effect is restoring hit points (#182
// soft-gap round). Same "not licensed SRD content, transcribed by hand from the rules text"
// category as SRD_SPELL_EFFECTS (srd-spell-effects.ts) -- the 5e-database import this app's other
// spell data comes from only carries mechanically-neutral fields, never a healing amount.
//
// Deliberately small: only the SRD spells whose entire mechanical effect is "roll dice, restore
// that many hit points." A spell that heals as a side effect of something bigger (Aid's max-HP
// increase, Heroes' Feast) isn't in this table -- see the custom-spell healingDice/healingBonus
// fields instead for anything not covered here.
export interface SpellHealing {
  dice: string;
  bonus: number;
}

const heal = (dice: string, bonus = 0): SpellHealing => ({ dice, bonus });

export const SRD_SPELL_HEALING: Record<string, SpellHealing> = {
  // "regain a number of hit points equal to 1d8 + your spellcasting ability modifier." The
  // ability modifier isn't tracked here (same reason buffEffectSchema's flat bonuses don't
  // either) -- SpellCastControl adds the caster's own spellcasting-ability modifier at cast
  // time, the same way it already adds spell attack bonus for attack-roll spells.
  "cure-wounds": heal("1d8"),
  "healing-word": heal("1d4"),
  "mass-healing-word": heal("1d4"),
  "mass-cure-wounds": heal("3d8"),
  "prayer-of-healing": heal("2d8"),
  // "regain all hit points... reduces exhaustion by one level... ends the blinded, deafened,
  // paralyzed, and poisoned conditions" -- only the HP restoration is modeled, same as every
  // other curated spell here treating a non-HP rider as description-only (#182's own scoping).
  // Both are fixed values ("regains hit points equal to 70"/"up to 700 hit points"), not a
  // roll -- same fixed-bonus-no-dice shape as revivify below.
  "mass-heal": heal("", 700),
  heal: heal("", 70),
  // "the target returns to life... with 1 hit point" -- a fixed value, not a roll, the same
  // "flat bonus, no dice" shape buffEffectSchema's damageBonus already covers for a buff with
  // no attached dice term.
  revivify: heal("", 1),
};
