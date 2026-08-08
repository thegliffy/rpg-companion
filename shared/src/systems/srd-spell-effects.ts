// Hand-curated attack/damage-buff data for the handful of SRD 5.1 spells that modify an attack
// roll or add bonus damage on a hit (#110-113). NOT sourced from the 5e-database import, which
// only carries mechanically-neutral fields (level/school/duration/etc.) -- these numbers are
// transcribed by hand from each spell's own rules text, the same "not licensed SRD content"
// category as CLASS_STAT_PRIORITY in class-progression.ts. Keyed by the SrdSpell id in
// srd-spells.ts.
//
// Deliberately small: most attack-buffing spells familiar from actual play (Hex, Wrathful Smite,
// Elemental Weapon, most of the smites) are Xanathar's/Tasha's/PHB-but-not-SRD content and are
// not in SRD_SPELLS at all -- they're authored as custom spells instead (see
// customSpellDataSchema's `buff` field), the same way Hexblade itself was authored as a custom
// subclass in #103-106. This table only covers spells that already exist in SRD_SPELLS.
import type { BuffEffect } from "./dnd5e.js";

const per = (buff: Partial<BuffEffect>): BuffEffect => ({
  attackBonus: 0,
  attackDice: "",
  damageBonus: 0,
  damageDice: "",
  damageType: "",
  saveDice: "",
  consumption: "per-hit",
  appliesToSpellAttacks: false,
  acBonus: 0,
  speedBonus: 0,
  speedMultiplier: 1,
  ...buff,
});

export const SRD_SPELL_EFFECTS: Record<string, BuffEffect> = {
  // "you or a creature you touch... adds 1d4 to any attack roll or saving throw... until the
  // spell ends." "Any attack roll" -- unlike the weapon-scoped entries below, this applies to a
  // spell attack (a cantrip, Eldritch Blast) too (#169).
  bless: per({ attackDice: "1d4", saveDice: "1d4", appliesToSpellAttacks: true }),
  // "as a bonus action... for the duration you gain a +1d4 bonus to weapon damage rolls."
  "divine-favor": per({ damageDice: "1d4", damageType: "radiant" }),
  // "you always know the mark's direction... and add 1d6 damage to your weapon attacks against
  // it." Applies every hit against the marked target for the duration, so per-hit is the right
  // model even though the source text says "the mark" rather than naming a target on the sheet.
  "hunters-mark": per({ damageDice: "1d6" }),
  // "+1 bonus to attack and damage rolls" (the base, non-upcast version -- casting at a higher
  // slot for +2/+3 isn't modelled, matching how #113 doesn't track upcasting elsewhere either).
  "magic-weapon": per({ attackBonus: 1, damageBonus: 1 }),
  // "the next time you hit... the target takes an extra 2d6 radiant damage" -- consumed on that
  // hit, unlike the sustained per-hit buffs above.
  "branding-smite": per({ damageDice: "2d6", damageType: "radiant", consumption: "once" }),
  // "subtract 1d4 from all of the target's attack rolls and saving throws... until the spell
  // ends." Bless's mirror image, same "any attack roll" scope (#169) -- a leading "-" on a dice
  // term is already handled by every formula-building call site (AttackRollControl.roll(),
  // Dnd5eSheet's rollCheck()), so this rolls correctly with no engine changes.
  bane: per({ attackDice: "-1d4", saveDice: "-1d4", appliesToSpellAttacks: true }),
  // "an invisible barrier of magic appears... you have a +5 bonus to AC, including against the
  // triggering attack." Not an attack/damage rider like the rest of this table -- it's here
  // because #174 gave BuffEffect an acBonus, which finally makes Shield expressible.
  shield: per({ acBonus: 5 }),
  // "your speed is doubled" -- the SRD Longstrider adds 10 ft instead, so the two together are
  // the reason speed needs both a bonus and a multiplier.
  longstrider: per({ speedBonus: 10 }),
};

// Common named conditions a player can toggle directly on the sheet without owning/casting the
// spell (#169) -- e.g. "someone else blessed me", or an NPC/monster sheet with no spell list at
// all. Keyed to the SRD_SPELL_EFFECTS entries above so casting the real spell and toggling the
// condition are recognized as the same status (matched by ActiveEffect.sourceSpellId on the
// sheet) -- deliberately just these two, the pair that read as "a condition you're under" rather
// than "a buff on my own weapon" (Divine Favor/Hunter's Mark/Magic Weapon/Branding Smite).
export const QUICK_CONDITIONS: { srdId: string; name: string }[] = [
  { srdId: "bless", name: "Blessed" },
  { srdId: "bane", name: "Bane" },
];
