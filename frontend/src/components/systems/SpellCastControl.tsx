import { useState } from "react";
import type { SrdSpell } from "shared";
import * as diceApi from "../../api/dice";

type Phase = "idle" | "rolling" | "awaiting-hit-miss" | "miss" | "done";

export function SpellCastControl({
  spell,
  spellAttackBonus,
  campaignId,
  ritualOnly = false,
}: {
  spell: SrdSpell;
  spellAttackBonus: number | null;
  campaignId: number | null;
  /** True when this spell isn't prepared and is only castable because it's a ritual (Wizard spellbook). */
  ritualOnly?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [attackBreakdown, setAttackBreakdown] = useState<string | null>(null);
  const [damageBreakdown, setDamageBreakdown] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function rollDamage() {
    try {
      const roll = await diceApi.createRoll(campaignId, spell.damageDice!, `${spell.name} damage`);
      setDamageBreakdown(roll.breakdown);
      setPhase("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Roll failed");
    }
  }

  async function cast() {
    setError(null);
    setAttackBreakdown(null);
    setDamageBreakdown(null);

    if (spell.requiresAttackRoll) {
      setPhase("rolling");
      try {
        const bonus = spellAttackBonus ?? 0;
        const formula = bonus === 0 ? "1d20" : `1d20${bonus > 0 ? "+" : ""}${bonus}`;
        const roll = await diceApi.createRoll(campaignId, formula, `${spell.name} attack roll`);
        setAttackBreakdown(roll.breakdown);
        setPhase(spell.damageDice ? "awaiting-hit-miss" : "done");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Roll failed");
        setPhase("idle");
      }
    } else if (spell.damageDice) {
      setPhase("rolling");
      await rollDamage();
    } else {
      setPhase("done");
    }
  }

  return (
    <div style={{ marginTop: "0.25rem" }}>
      <button type="button" onClick={cast} disabled={phase === "rolling"}>
        {ritualOnly ? "Cast as ritual" : "Cast"}
      </button>
      {ritualOnly && <small style={{ marginLeft: "0.4rem", color: "#666" }}>(no slot used, +10 min)</small>}
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
      {phase === "miss" && <div><small>Miss — no damage.</small></div>}
      {damageBreakdown && (
        <div>
          <small>Damage: {damageBreakdown}</small>
        </div>
      )}
      {phase === "done" && !attackBreakdown && !damageBreakdown && (
        <div>
          <small>Cast.</small>
        </div>
      )}
    </div>
  );
}
