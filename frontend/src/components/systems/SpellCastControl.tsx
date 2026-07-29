import { useState } from "react";
import type { BuffEffect, SpellScaling, SrdSpell } from "shared";
import { scaledSpellDamage } from "shared";
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
  availableSlotLevels = [],
  scaling = null,
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
  /** Spends a slot of the given level (the one picked in the upcast selector, or the spell's own
   * level when there's no choice to make). */
  onConsumeSlot?: (slotLevel: number) => void;
  /** Distinct slot levels the character has available at or above this spell's level, ascending.
   * A selector only renders when there's more than one -- a Warlock's Pact Magic gives a single
   * level, and most casters have no higher slot free. */
  availableSlotLevels?: number[];
  /** The spell's resolved "At Higher Levels" scaling (curated SRD_SPELL_SCALING or a custom
   * spell's authored fields). Passed in for the same reason as `buff`: keeps the customSpells
   * lookup out of this component. */
  scaling?: SpellScaling | null;
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
  // Slot level this cast will spend. Defaults to the spell's own level; only adjustable when the
  // character actually has a higher slot free (see availableSlotLevels).
  const [castLevel, setCastLevel] = useState(spell.level);

  const upcastLevels = consumesSlot ? availableSlotLevels.filter((l) => l >= spell.level) : [];
  // A *selector* is only worth showing when there's an actual choice between slot levels.
  const canUpcast = upcastLevels.length > 1;
  // ...but "no choice" is not the same as "cast at base level". A Warlock's Pact Magic gives one
  // slot level, always their highest, so a 1st-level spell cast by a 9th-level Warlock really is
  // cast at 5th and upcasts accordingly -- they simply can't choose otherwise. Use the single
  // available level when there is one; only fall back to the spell's own level when nothing is
  // available to spend (in which case the cast is blocked anyway).
  const forcedLevel = upcastLevels.length === 1 ? upcastLevels[0] : spell.level;
  const effectiveCastLevel = canUpcast ? castLevel : forcedLevel;
  const scaledDamage = spell.damageDice
    ? scaledSpellDamage(spell.damageDice, spell.level, effectiveCastLevel, scaling ?? undefined)
    : undefined;
  const levelsAbove = Math.max(0, effectiveCastLevel - spell.level);

  async function rollDamage() {
    try {
      const roll = await diceApi.createRoll(
        campaignId,
        scaledDamage!,
        `${spell.name} damage${levelsAbove > 0 ? ` (lvl ${effectiveCastLevel})` : ""}`,
      );
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

    if (consumesSlot) onConsumeSlot?.(effectiveCastLevel);
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
      {canUpcast && (
        <label style={{ marginLeft: "0.4rem", fontSize: "0.85rem" }}>
          at level{" "}
          <select value={castLevel} onChange={(e) => setCastLevel(Number(e.target.value))}>
            {upcastLevels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
      )}
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
      {levelsAbove > 0 && scaledDamage && scaledDamage !== spell.damageDice && (
        <small style={{ marginLeft: "0.4rem", color: "#666" }}>
          (at {effectiveCastLevel}: {scaledDamage}
          {spell.damageType ? ` ${spell.damageType.toLowerCase()}` : ""})
        </small>
      )}
      {/* The non-damage half of an upcast -- extra targets, longer duration, dispel thresholds.
          Shown whenever the spell has one, since it's the only place these surface at all. */}
      {scaling?.note && (
        <div>
          <small style={{ color: "#666" }}>
            At higher levels: {scaling.note}
            {levelsAbove > 0 ? ` (casting at ${effectiveCastLevel} — ${levelsAbove} above base)` : ""}
          </small>
        </div>
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
