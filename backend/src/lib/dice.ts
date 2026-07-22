import { DiceRoll } from "@dice-roller/rpg-dice-roller";
import { DICE_FORMULA_PATTERN } from "shared";

export class InvalidDiceFormulaError extends Error {}

export interface DiceRollResult {
  total: number;
  breakdown: string;
}

export function rollDice(formula: string): DiceRollResult {
  if (!DICE_FORMULA_PATTERN.test(formula)) {
    throw new InvalidDiceFormulaError(`Invalid dice formula: ${formula}`);
  }

  try {
    const roll = new DiceRoll(formula);
    return { total: roll.total, breakdown: roll.output };
  } catch {
    throw new InvalidDiceFormulaError(`Could not parse dice formula: ${formula}`);
  }
}
