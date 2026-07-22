import { useState } from "react";
import * as diceApi from "../../api/dice";

type Phase = "idle" | "rolling" | "awaiting-hit-miss" | "miss" | "done";

export function AttackRollControl({
  name,
  attackBonus,
  magicBonus,
  damageDice,
  damageType,
  campaignId,
}: {
  name: string;
  attackBonus: number;
  magicBonus: number;
  damageDice: string;
  damageType: string;
  campaignId: number | null;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [attackBreakdown, setAttackBreakdown] = useState<string | null>(null);
  const [damageBreakdown, setDamageBreakdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function rollDamage() {
    try {
      const formula = magicBonus === 0 ? damageDice : `${damageDice}${magicBonus > 0 ? "+" : ""}${magicBonus}`;
      const roll = await diceApi.createRoll(campaignId, formula, `${name || "Attack"} damage`);
      setDamageBreakdown(`${roll.breakdown}${damageType ? ` ${damageType}` : ""}`);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Roll failed");
    }
  }

  async function roll() {
    setError(null);
    setAttackBreakdown(null);
    setDamageBreakdown(null);
    setPhase("rolling");
    try {
      const formula = attackBonus === 0 ? "1d20" : `1d20${attackBonus > 0 ? "+" : ""}${attackBonus}`;
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
    </div>
  );
}
