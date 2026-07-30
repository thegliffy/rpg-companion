import { DiceRoll, Parser } from "@dice-roller/rpg-dice-roller";
import { DICE_FORMULA_PATTERN } from "shared";
import type { RollDetail, RollDetailTerm } from "shared";

export class InvalidDiceFormulaError extends Error {}

export interface DiceRollResult {
  total: number;
  breakdown: string;
  // Null when the structured shape couldn't be built with confidence (see buildRollDetail) --
  // total/breakdown are always the source of truth and never fail because of this.
  detail: RollDetail | null;
}

/** Zips the parsed notation (which carries die *size* but not rolled values) with the rolled
 * result JSON (which carries values but not size) into one structured shape (#136) -- the two are
 * positionally aligned since they describe the same expression, verified against every dice shape
 * this app actually rolls (single/multiple dice terms, flat modifiers, kh/kl drops). Both sides
 * are treated as `unknown` and duck-typed rather than trusting the library's declared `.d.ts`
 * shapes, which don't match its actual runtime JSON (its `RollResults.toJSON()` type omits the
 * `type`/`rolls` fields the real output carries). Returns null rather than guessing at anything
 * unrecognized -- an unusual formula (e.g. exploding/reroll dice, which the notation charset
 * technically allows even though nothing in the app generates them) just means no visual detail
 * for that roll, not a broken one. */
function buildRollDetail(formula: string, roll: InstanceType<typeof DiceRoll>): RollDetail | null {
  try {
    const parsed = Parser.parse(formula) as unknown[];
    // roll.toJSON().rolls holds live class instances (RollResults/ResultGroup), not plain
    // objects -- their extra fields (e.g. `type`) only materialize once something calls each
    // instance's own toJSON(), which a full JSON.stringify round-trip does recursively but a bare
    // property read does not.
    const rolled = (JSON.parse(JSON.stringify(roll.toJSON())) as { rolls: unknown[] }).rolls;
    if (parsed.length !== rolled.length) return null;

    const terms: RollDetailTerm[] = [];
    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i];
      const r = rolled[i];

      if (typeof p === "object" && p !== null && "sides" in p && "qty" in p) {
        const sides = (p as { sides: unknown }).sides;
        if (typeof sides !== "number" || typeof r !== "object" || r === null || !("rolls" in r) || !("value" in r)) {
          return null;
        }
        const group = r as { type: unknown; value: unknown; rolls: unknown };
        const dice = group.rolls;
        if (group.type !== "roll-results" || typeof group.value !== "number" || !Array.isArray(dice)) return null;
        const dieResults: { value: number; kept: boolean }[] = [];
        for (const d of dice) {
          if (typeof d !== "object" || d === null || typeof (d as { value: unknown }).value !== "number") return null;
          dieResults.push({ value: (d as { value: number }).value, kept: (d as { useInTotal?: unknown }).useInTotal !== false });
        }
        terms.push({ kind: "dice", sides, dice: dieResults, subtotal: group.value });
      } else if (typeof p === "string" && (p === "+" || p === "-")) {
        if (r !== p) return null;
        terms.push({ kind: "operator", op: p });
      } else if (typeof p === "number") {
        if (typeof r !== "number") return null;
        terms.push({ kind: "constant", value: p });
      } else {
        // Anything else (percentile/fudge dice, *//, exploding-die modifier objects) -- bail
        // rather than misrepresent it.
        return null;
      }
    }

    return { terms, total: roll.total };
  } catch {
    return null;
  }
}

export function rollDice(formula: string): DiceRollResult {
  if (!DICE_FORMULA_PATTERN.test(formula)) {
    throw new InvalidDiceFormulaError(`Invalid dice formula: ${formula}`);
  }

  try {
    const roll = new DiceRoll(formula);
    return { total: roll.total, breakdown: roll.output, detail: buildRollDetail(formula, roll) };
  } catch {
    throw new InvalidDiceFormulaError(`Could not parse dice formula: ${formula}`);
  }
}
