import { useState } from "react";
import * as diceApi from "../../api/dice";

type Phase = "idle" | "rolling" | "awaiting-hit-miss" | "miss" | "done";

interface ExtraDamage {
  id: string;
  label: string;
  dice: string;
  type: string;
}

export function AttackRollControl({
  name,
  attackBonus,
  magicBonus,
  damageDice,
  damageType,
  campaignId,
  extraAttackDice = [],
  extraDamage = [],
  onHit,
}: {
  name: string;
  attackBonus: number;
  magicBonus: number;
  damageDice: string;
  damageType: string;
  campaignId: number | null;
  /** Extra dice terms active buff effects add to the attack ROLL (Bless's +1d4) -- folded into
   * the same 1d20 formula as attackBonus rather than rolled separately. */
  extraAttackDice?: string[];
  /** Active effects that add extra damage dice on a hit (Wrathful Smite's 1d6 psychic). Each is
   * rolled and reported as its own line since it can carry its own damage type. */
  extraDamage?: ExtraDamage[];
  /** Called once, after a confirmed Hit finishes rolling (base damage + every extraDamage entry)
   * -- lets the sheet consume any consumption: "once" effects. Never called on a Miss, matching
   * Wrathful Smite's own text ("if you don't hit... the spell isn't wasted"). */
  onHit?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [attackBreakdown, setAttackBreakdown] = useState<string | null>(null);
  const [damageBreakdown, setDamageBreakdown] = useState<string | null>(null);
  const [extraDamageResults, setExtraDamageResults] = useState<{ label: string; type: string; breakdown: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function rollDamage() {
    try {
      const formula = magicBonus === 0 ? damageDice : `${damageDice}${magicBonus > 0 ? "+" : ""}${magicBonus}`;
      const roll = await diceApi.createRoll(campaignId, formula, `${name || "Attack"} damage`);
      setDamageBreakdown(`${roll.breakdown}${damageType ? ` ${damageType}` : ""}`);

      const extras: { label: string; type: string; breakdown: string }[] = [];
      for (const e of extraDamage) {
        const extraRoll = await diceApi.createRoll(campaignId, e.dice, `${name || "Attack"} bonus damage (${e.label})`);
        extras.push({ label: e.label, type: e.type, breakdown: extraRoll.breakdown });
      }
      setExtraDamageResults(extras);
      setPhase("done");
      onHit?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Roll failed");
    }
  }

  async function roll() {
    setError(null);
    setAttackBreakdown(null);
    setDamageBreakdown(null);
    setExtraDamageResults([]);
    setPhase("rolling");
    try {
      // Dice terms (Bless) plus the flat bonus combine into one formula/roll -- the roller
      // supports multiple dice terms in a single expression, and an attack roll only ever
      // reports one number, unlike damage which can carry several separately-typed sources.
      const terms = [...extraAttackDice.map((d) => (d.startsWith("-") ? d : `+${d}`))];
      if (attackBonus !== 0) terms.push(attackBonus > 0 ? `+${attackBonus}` : `${attackBonus}`);
      const formula = `1d20${terms.join("")}`;
      const rollResult = await diceApi.createRoll(campaignId, formula, `${name || "Attack"} attack roll`);
      setAttackBreakdown(rollResult.breakdown);
      setPhase(damageDice ? "awaiting-hit-miss" : "done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Roll failed");
      setPhase("idle");
    }
  }

  return (
    <div style={{ marginTop: "0.25rem" }}>
      <button type="button" onClick={roll} disabled={phase === "rolling"}>
        Roll
      </button>
      {error && <span style={{ color: "crimson", marginLeft: "0.5rem" }}>{error}</span>}
      {attackBreakdown && (
        <div>
          <small>Attack: {attackBreakdown}</small>
        </div>
      )}
      {phase === "awaiting-hit-miss" && (
        <div>
          <button
            type="button"
            onClick={() => {
              setPhase("rolling");
              rollDamage();
            }}
          >
            Hit
          </button>
          <button type="button" onClick={() => setPhase("miss")} style={{ marginLeft: "0.4rem" }}>
            Miss
          </button>
        </div>
      )}
      {phase === "miss" && (
        <div>
          <small>Miss — no damage.</small>
        </div>
      )}
      {damageBreakdown && (
        <div>
          <small>Damage: {damageBreakdown}</small>
        </div>
      )}
      {extraDamageResults.map((r, i) => (
        <div key={i}>
          <small>
            +{r.breakdown} {r.type} ({r.label})
          </small>
        </div>
      ))}
    </div>
  );
}
