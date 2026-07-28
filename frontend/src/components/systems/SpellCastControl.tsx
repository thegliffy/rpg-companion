import { useState } from "react";
import type { BuffEffect, SrdSpell } from "shared";
import * as diceApi from "../../api/dice";

type Phase = "idle" | "rolling" | "awaiting-hit-miss" | "miss" | "done";

export function SpellCastControl({
  spell,
  spellAttackBonus,
  campaignId,
  ritualOnly = false,
  consumesSlot = false,
  hasSlot = true,
  onConsumeSlot,
  onConcentrate,
  replacesConcentration = null,
  buff = null,
  onBuff,
}: {
  spell: SrdSpell;
  spellAttackBonus: number | null;
  campaignId: number | null;
  /** True when this spell isn't prepared and is only castable because it's a ritual (Wizard spellbook). */
  ritualOnly?: boolean;
  /** True when casting this spell should spend a spell slot (leveled, prepared, non-ritual). */
  consumesSlot?: boolean;
  /** True when a slot at or above the spell's level is available to spend. */
  hasSlot?: boolean;
  /** Spends the lowest available slot at or above the spell's level. */
  onConsumeSlot?: () => void;
  /** Called when a concentration spell is cast, so the sheet can mark what's being sustained.
   * 5e allows only one at a time, so the sheet replaces rather than stacks. */
  onConcentrate?: () => void;
  /** Name of the spell already being concentrated on, if casting this one would replace it. */
  replacesConcentration?: string | null;
  /** The spell's resolved buff (curated SRD_SPELL_EFFECTS or the custom spell's own `buff`
   * field), if any -- passed in rather than resolved here so this component stays free of the
   * customSpells lookup. Independent of concentration: most curated buffs happen to be
   * concentration spells, but a homebrew one need not be. */
  buff?: BuffEffect | null;
  /** Called when a spell with a resolved buff is cast, so the sheet can add an activeEffect. */
  onBuff?: (buff: BuffEffect) => void;
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

    if (consumesSlot) onConsumeSlot?.();
    if (spell.concentration) onConcentrate?.();
    if (buff) onBuff?.(buff);

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
      <button
        type="button"
        onClick={cast}
        disabled={phase === "rolling"}
        style={consumesSlot && !hasSlot ? { color: "crimson", borderColor: "crimson" } : undefined}
      >
        {ritualOnly ? "Cast as ritual" : "Cast"}
      </button>
      {ritualOnly && <small style={{ marginLeft: "0.4rem", color: "#666" }}>(no slot used, +10 min)</small>}
      {consumesSlot && !hasSlot && (
        <small style={{ marginLeft: "0.4rem", color: "crimson" }}>(no slot available)</small>
      )}
      {spell.concentration && (
        <small style={{ marginLeft: "0.4rem", color: replacesConcentration ? "crimson" : "#666" }}>
          {replacesConcentration ? `(concentration — drops ${replacesConcentration})` : "(concentration)"}
        </small>
      )}
      {buff && (
        <small style={{ marginLeft: "0.4rem", color: "#666" }}>
          (buffs your attacks:{" "}
          {[
            buff.attackDice ? `+${buff.attackDice} to hit` : "",
            buff.attackBonus ? `+${buff.attackBonus} to hit` : "",
            buff.damageDice ? `+${buff.damageDice}${buff.damageType ? ` ${buff.damageType}` : ""} dmg` : "",
            buff.damageBonus ? `+${buff.damageBonus} dmg` : "",
          ]
            .filter(Boolean)
            .join(", ")}
          {buff.consumption === "once" ? ", next hit" : ""})
        </small>
      )}
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
