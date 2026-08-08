// Hand-transcribed "At Higher Levels" data for SRD 5.1 spells (CC-BY-4.0), plus the uniform
// cantrip-growth rule. NOT from the 5e-database import, which carries no upcast information --
// same category as srd-spell-effects.ts (#110-113): curated in-repo, keyed by the SrdSpell id in
// srd-spells.ts. Unlike Hexblade (#103-106) this text *is* SRD-licensed, so it ships here rather
// than needing to be authored as custom content.
import type { SrdSpell } from "./srd-spells.js";

export interface SpellScaling {
  /** Dice added to the spell's damage roll for each slot level above its base level -- the
   * rollable part. Only meaningful when the spell has base `damageDice` for these to attach to:
   * healing spells (Cure Wounds) upcast by dice too, but nothing rolls healing yet, so they use
   * `note` instead of silently adding dice to a roll that never happens. */
  dicePerLevel?: string;
  /** The upcast expressed as text, for everything that isn't "add N dice to one roll" -- extra
   * targets, longer durations, higher dispel thresholds, or per-two-levels scaling. Rendered with
   * the chosen slot level alongside the Cast button; never applied mechanically. */
  note?: string;
}

export const SRD_SPELL_SCALING: Record<string, SpellScaling> = {
  // --- Level 1 ---
  "burning-hands": { dicePerLevel: "1d6" },
  "guiding-bolt": { dicePerLevel: "1d6" },
  "hellish-rebuke": { dicePerLevel: "1d10" },
  "inflict-wounds": { dicePerLevel: "1d10" },
  thunderwave: { dicePerLevel: "1d8" },
  // Extra *darts*, not extra dice on one roll -- forcing this into dicePerLevel would roll
  // 3d4+3 plus a stray 1d4 rather than four darts of 1d4+1 each.
  "magic-missile": { note: "Creates one additional dart for each slot level above 1st." },
  "cure-wounds": { note: "Heals an additional 1d8 for each slot level above 1st." },
  "healing-word": { note: "Heals an additional 1d4 for each slot level above 1st." },
  command: { note: "Affects one additional creature for each slot level above 1st." },
  "charm-person": { note: "Targets one additional creature for each slot level above 1st." },
  bane: { note: "Targets one additional creature for each slot level above 1st." },
  bless: { note: "Targets one additional creature for each slot level above 1st." },
  sleep: { note: "Affects an additional 2d8 hit points of creatures for each slot level above 1st." },

  // --- Level 2 ---
  "acid-arrow": { dicePerLevel: "1d4" },
  "flaming-sphere": { dicePerLevel: "1d6" },
  "heat-metal": { dicePerLevel: "1d8" },
  moonbeam: { dicePerLevel: "1d10" },
  shatter: { dicePerLevel: "1d8" },
  // Per *two* levels, which dicePerLevel can't express (it multiplies by levels-above directly).
  "flame-blade": { note: "Damage increases by 1d6 for every two slot levels above 2nd." },
  "spiritual-weapon": { note: "Damage increases by 1d8 for every two slot levels above 2nd." },
  "scorching-ray": { note: "Creates one additional ray for each slot level above 2nd." },
  aid: { note: "Targets' hit point maximum and current hit points increase by 5 more for each slot level above 2nd." },
  invisibility: { note: "Targets one additional creature for each slot level above 2nd." },
  "hold-person": { note: "Targets one additional creature for each slot level above 2nd." },
  "prayer-of-healing": { note: "Healing increases by 1d8 for each slot level above 2nd." },
  // The base +1 is modelled as a buff (SRD_SPELL_EFFECTS); the upcast tiers aren't, so they're
  // surfaced as text rather than silently ignored.
  "magic-weapon": { note: "The bonus increases to +2 with a slot of 4th level or higher, and to +3 with a slot of 6th level or higher." },

  // --- Level 3 ---
  "call-lightning": { dicePerLevel: "1d10" },
  fireball: { dicePerLevel: "1d6" },
  "lightning-bolt": { dicePerLevel: "1d6" },
  "vampiric-touch": { dicePerLevel: "1d6" },
  "dispel-magic": { note: "Automatically ends a spell of level equal to or less than the slot level used." },
  "mass-healing-word": { note: "Healing increases by 1d4 for each slot level above 3rd." },
  "animate-dead": { note: "Animates or reasserts control over two additional undead creatures for each slot level above 3rd." },
  "conjure-animals": { note: "Summons twice as many beasts with a 5th-level slot, three times as many with a 7th-level slot, and four times as many with a 9th-level slot." },
  "bestow-curse": {
    note: "Duration becomes concentration up to 10 minutes (4th), 8 hours (5th-6th), or 24 hours (7th-8th); a 9th-level slot lasts until dispelled. A slot of 5th level or higher no longer requires concentration.",
  },
  // The explosive-runes damage isn't carried as damageDice (the spell has several glyph modes), so
  // this stays a note rather than dicePerLevel.
  "glyph-of-warding": {
    note: "An explosive runes glyph's damage increases by 1d8 for each slot level above 3rd. A spell glyph can store any spell up to the level of the slot used.",
  },

  // --- Level 4 ---
  blight: { dicePerLevel: "1d8" },
  "ice-storm": { dicePerLevel: "1d8" },
  "phantasmal-killer": { dicePerLevel: "1d10" },
  "wall-of-fire": { dicePerLevel: "1d8" },
  banishment: { note: "Targets one additional creature for each slot level above 4th." },
  "dominate-beast": { note: "Duration becomes concentration up to 10 minutes (5th), 1 hour (6th), or 8 hours (7th or higher)." },
  divination: { note: "The chance of a random reading increases by 25% for each slot level above 4th." },
  "conjure-woodland-beings": { note: "Summons twice as many creatures with a 6th-level slot, and three times as many with an 8th-level slot." },
  "conjure-minor-elementals": { note: "Summons twice as many elementals with a 6th-level slot, and three times as many with an 8th-level slot." },

  // --- Level 5 ---
  cloudkill: { dicePerLevel: "1d8" },
  "cone-of-cold": { dicePerLevel: "1d8" },
  "flame-strike": { dicePerLevel: "1d6" },
  "insect-plague": { dicePerLevel: "1d10" },
  "mass-cure-wounds": { note: "Heals an additional 1d8 for each slot level above 5th." },
  "hold-monster": { note: "Targets one additional creature for each slot level above 5th." },
  "planar-binding": { note: "Duration increases with slot level: 10 days (6th), 30 days (7th), 180 days (8th), a year and a day (9th)." },
  "dominate-person": { note: "Duration becomes concentration up to 10 minutes (6th), 1 hour (7th), or 8 hours (8th or higher)." },
  "conjure-elemental": { note: "The summoned elemental's challenge rating increases by 1 for each slot level above 5th." },
  geas: { note: "Duration becomes 1 year with a 7th- or 8th-level slot; a 9th-level slot lasts until ended by a spell that removes it." },
  "arcane-hand": { note: "Clenched fist damage increases by 2d8 and grasping hand damage by 2d6 for each slot level above 5th." },

  // --- Level 6 ---
  "circle-of-death": { dicePerLevel: "2d6" },
  disintegrate: { dicePerLevel: "3d6" },
  "freezing-sphere": { dicePerLevel: "1d6" },
  // 2d6, not 1d6: Wall of Ice upcasts its *appear* damage by 2d6 and its pass-through damage by
  // 1d6, and the 10d6 this spell carries as damageDice is the appear damage -- so the pass-through
  // figure would silently under-roll the one damage the app actually rolls.
  "wall-of-ice": { dicePerLevel: "2d6", note: "Damage for passing through the wall (not rolled here) increases by 1d6 for each slot level above 6th." },
  "wall-of-thorns": { dicePerLevel: "1d8" },
  "chain-lightning": { note: "Targets one additional creature for each slot level above 6th." },
  heal: { note: "Healing increases by 10 hit points for each slot level above 6th." },
  "conjure-fey": { note: "The summoned fey's challenge rating increases by 1 for each slot level above 6th." },
  "create-undead": {
    note: "Animates or reasserts control over four ghouls (7th); five ghouls, two ghasts or wights, or two mummies (8th); six ghouls, three ghasts or wights, or three mummies (9th).",
  },

  // --- Level 7 ---
  "delayed-blast-fireball": { dicePerLevel: "1d6" },
  etherealness: { note: "Targets up to three willing creatures (including you) for each slot level above 7th." },
  "conjure-celestial": { note: "With a 9th-level slot, summons a celestial of challenge rating 5 or lower." },

  // --- Level 8 ---
  "dominate-monster": { note: "With a 9th-level slot, the duration is concentration, up to 8 hours." },

  // Level 9: nothing to scale -- a 9th-level spell has no higher slot to be cast with. The other
  // 8th-level damage spells here (Feeblemind, Incendiary Cloud, Sunburst) have no "At Higher
  // Levels" entry of their own.
};

/** Multiplier applied to a damage cantrip's dice *count* at character levels 5/11/17 -- the
 * uniform 5e rule, so no per-cantrip data is needed. Shares its thresholds with
 * eldritchBlastBeams() in class-progression.ts, which calls this rather than repeating them. */
export function cantripScaleMultiplier(characterLevel: number): number {
  if (characterLevel >= 17) return 4;
  if (characterLevel >= 11) return 3;
  if (characterLevel >= 5) return 2;
  return 1;
}

/** Eldritch Blast scales by adding *beams*, each rolled separately, and eldritchBlastProfile()
 * already handles that -- applying the generic dice multiplier too would quadruple it. */
export const CANTRIP_SCALING_EXEMPT = new Set(["eldritch-blast"]);

/** Splits a simple "NdM" dice term. Returns null for anything else (a flat number, a compound
 * expression like "2d8 + 4d6", "3d4 + 3"), which is exactly the set of cantrip damage strings
 * that shouldn't be blindly multiplied. */
function parseSimpleDice(dice: string): { count: number; sides: number } | null {
  const m = /^\s*(\d+)d(\d+)\s*$/i.exec(dice);
  if (!m) return null;
  return { count: Number(m[1]), sides: Number(m[2]) };
}

/** A damage cantrip's dice at a given character level (Fire Bolt 1d10 -> 3d10 at 11th). Returns
 * the original string unchanged for non-cantrips, exempt cantrips, and dice expressions too
 * complex to scale safely. */
export function scaledCantripDamage(spell: SrdSpell, characterLevel: number): string | undefined {
  if (spell.level !== 0 || !spell.damageDice) return spell.damageDice;
  if (CANTRIP_SCALING_EXEMPT.has(spell.id)) return spell.damageDice;
  const parsed = parseSimpleDice(spell.damageDice);
  if (!parsed) return spell.damageDice;
  const multiplier = cantripScaleMultiplier(characterLevel);
  return `${parsed.count * multiplier}d${parsed.sides}`;
}

/** The damage formula for a leveled spell cast with a slot `castLevel` levels above its base,
 * given the scaling that applies to it. Appends the per-level dice as extra terms rather than
 * rewriting the base expression, so compound base damage ("2d8 + 4d6") stays intact. */
export function scaledSpellDamage(
  baseDamageDice: string,
  baseSpellLevel: number,
  castLevel: number,
  scaling: SpellScaling | undefined,
): string {
  const dice = scaling?.dicePerLevel?.trim();
  if (!dice) return baseDamageDice;
  const levelsAbove = Math.max(0, castLevel - baseSpellLevel);
  if (levelsAbove === 0) return baseDamageDice;
  const parsed = parseSimpleDice(dice);
  // Collapse "1d6" x3 into "3d6" when possible so the formula stays readable; fall back to
  // repeated terms for anything unusual.
  if (parsed) return `${baseDamageDice}+${parsed.count * levelsAbove}d${parsed.sides}`;
  return `${baseDamageDice}${`+${dice}`.repeat(levelsAbove)}`;
}
