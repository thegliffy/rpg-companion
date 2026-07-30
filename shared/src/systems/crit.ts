import type { RollDetail } from "../types.js";

// Critical hit damage (#142): PHB 196 -- "roll all of the attack's damage dice twice and add them
// together. Then add any relevant modifiers as normal." A crit doubles dice quantity, never flat
// modifiers -- "2d8+4" becomes "4d8+4", not "4d8+8". This is the one transform every crit-damage
// path (sheet attacks, monster damageDice, spell damage) hangs off, since it works identically
// whether the flat modifier lives in a separate field (sheet attacks) or is baked into the dice
// string itself (482 of the SRD's 553 monster damageDice values are e.g. "2d8+4").
//
// Deliberately a narrow regex, not a full dice-notation parser: only "NdM", optionally chained
// with +/- to more NdM or bare-integer terms, is recognized. Anything else -- an empty string, a
// bare constant ("1" is a real SRD damageDice value), parens, kh/kl/reroll/explode modifiers,
// multiplication -- is returned unchanged rather than guessed at. Damage formulas in this app
// never use those, so degrading safely costs nothing in practice and avoids silently mangling one
// if it ever shows up.
const SIMPLE_ADDITIVE_DICE_FORMULA = /^\d+d\d+([+-](\d+d\d+|\d+))*$/i;
const DICE_TERM = /^(\d+)d(\d+)$/i;

export function critFormula(formula: string): string {
  const compact = formula.replace(/\s+/g, "");
  if (!SIMPLE_ADDITIVE_DICE_FORMULA.test(compact)) return formula;

  return compact
    .split(/([+-])/)
    .filter((part) => part !== "")
    .map((part) => {
      const m = DICE_TERM.exec(part);
      return m ? `${Number(m[1]) * 2}d${m[2]}` : part;
    })
    .join("");
}

/** Full crit damage formula (#142/#144): doubles every dice term via critFormula(), then adds
 * `extraDice` more dice of the *weapon's own* size on top (Brutal Critical, Savage Attacks) --
 * both effects stack on the same roll rather than compounding into each other ("one additional
 * weapon damage die" means the weapon's own die, not an arbitrary size, and never applies to a
 * separately-typed extra damage entry). Weapon die size is read from the first dice term of the
 * *original* (pre-double) formula. `extraDice` <= 0 is a plain crit with no bonus dice. */
export function critDamageFormula(baseDamageDice: string, extraDice: number): string {
  const doubled = critFormula(baseDamageDice);
  if (extraDice <= 0) return doubled;
  const m = DICE_TERM.exec(baseDamageDice.replace(/\s+/g, "").split(/[+-]/)[0]);
  if (!m) return doubled;
  return `${doubled}+${extraDice}d${m[2]}`;
}

/** The natural value of the first kept d20 in a roll's structured detail (#141/#143) -- e.g. the
 * base attack roll before Bless's +1d4 or a flat bonus. Null when there's no detail (a pre-#136
 * roll, or one the backend couldn't structure) or no d20 term at all. One definition so every
 * natural-20 check (the modal's highlighting, rollDeathSave, the hit-roll flow) agrees on what
 * "natural" means. */
export function naturalD20(detail: RollDetail | null): number | null {
  if (!detail) return null;
  for (const term of detail.terms) {
    if (term.kind === "dice" && term.sides === 20) {
      const kept = term.dice.find((d) => d.kept);
      return kept ? kept.value : null;
    }
  }
  return null;
}

export function isCriticalHit(detail: RollDetail | null, critThreshold: number): boolean {
  const natural = naturalD20(detail);
  return natural !== null && natural >= critThreshold;
}

export function isCriticalMiss(detail: RollDetail | null): boolean {
  return naturalD20(detail) === 1;
}

/** Suggested crit threshold (#143) from a subclass's features up to the character's level --
 * Champion's Improved/Superior Critical (SRD subclasses are name-only, so this is a name match
 * against the two known feature strings) or a custom subclass feature's own critThreshold (a rich
 * SubclassFeature object, custom-content.ts). The lowest threshold granted at or below the
 * character's level wins; 20 (the RAW baseline) when nothing applies. A suggestion, not enforced --
 * dnd5eSheetSchema.critThreshold stays a plain editable field either way. */
export function suggestedCritThreshold(srdFeatureNames: string[], customCritThresholds: number[] = []): number {
  let threshold = 20;
  for (const name of srdFeatureNames) {
    if (name === "Superior Critical") threshold = Math.min(threshold, 18);
    else if (name === "Improved Critical") threshold = Math.min(threshold, 19);
  }
  for (const t of customCritThresholds) threshold = Math.min(threshold, t);
  return threshold;
}
