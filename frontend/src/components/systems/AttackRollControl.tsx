import { useRef, useState } from "react";
import type { DiceRoll } from "shared";
import { naturalD20, critFormula, critDamageFormula } from "shared";
import { useDiceRoll } from "../../dice/DiceRollContext";

type Phase = "idle" | "rolling" | "done";

interface ExtraDamage {
  id: string;
  label: string;
  dice: string;
  type: string;
}

interface OptionalModifier {
  id: string;
  label: string;
  attackPenalty: number;
  damageBonus: number;
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
  // Natural d20 needed to crit (#143/#145) -- 20 unless the caller passes the character's own
  // sheet.critThreshold. Familiars/wild shape/bestiary monsters have no subclass-derived
  // threshold tracked anywhere, so they stay at the RAW default rather than inheriting the
  // player's.
  critThreshold = 20,
  // Extra weapon dice added (not doubled) on a crit -- Brutal Critical + race Savage Attacks,
  // summed by the caller (#144/#145). Same "player's own sheet only" scoping as critThreshold.
  extraCritDice = 0,
  // Sharpshooter/GWM-style optional tradeoffs (#167) -- a feat can grant one; the player decides
  // per-attack whether to take the penalty, so this is a checkbox rather than an always-on bonus
  // like the feat's other flat fields.
  optionalModifiers = [],
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
  critThreshold?: number;
  extraCritDice?: number;
  optionalModifiers?: OptionalModifier[];
  /** Called once, after a confirmed Hit finishes rolling (base damage + every extraDamage entry)
   * -- lets the sheet consume any consumption: "once" effects. Never called on a Miss, matching
   * Wrathful Smite's own text ("if you don't hit... the spell isn't wasted"). */
  onHit?: () => void;
}) {
  const { session, setSessionActions } = useDiceRoll();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  // Which optional modifiers are currently checked -- local to this control, not persisted, so
  // it resets to "off" on every remount (a fresh roll never silently inherits the last roll's
  // choice).
  const [checkedModifiers, setCheckedModifiers] = useState<Set<string>>(new Set());
  const activeModifiers = optionalModifiers.filter((m) => checkedModifiers.has(m.id));
  const activePenalty = activeModifiers.reduce((sum, m) => sum + m.attackPenalty, 0);
  const activeDamageBonus = activeModifiers.reduce((sum, m) => sum + m.damageBonus, 0);
  // The session's scoped roll fn, stashed so a later event (the Hit button, rendered inside the
  // modal via setSessionActions) can add more die groups to the SAME still-open modal instead of
  // popping a second one for damage.
  const scopedRollRef = useRef<((formula: string, label?: string) => Promise<DiceRoll>) | null>(null);

  async function rollDamagePhase(isCrit: boolean) {
    const scopedRoll = scopedRollRef.current!;
    setPhase("rolling");
    try {
      // Crit doubles dice, never the flat bonus (#142) -- critDamageFormula() (and critFormula()
      // for the extra-damage entries below) only ever touches damageDice/e.dice, never magicBonus,
      // which stays a separate appended term exactly as on a normal hit.
      const critDice = isCrit ? critDamageFormula(damageDice, extraCritDice) : damageDice;
      const totalDamageBonus = magicBonus + activeDamageBonus;
      const formula = totalDamageBonus === 0 ? critDice : `${critDice}${totalDamageBonus > 0 ? "+" : ""}${totalDamageBonus}`;
      await scopedRoll(formula, `${name || "Attack"}${isCrit ? " critical" : ""} damage`);

      for (const e of extraDamage) {
        const dice = isCrit ? critFormula(e.dice) : e.dice;
        await scopedRoll(dice, `${name || "Attack"} bonus damage (${e.label}${e.type ? `, ${e.type}` : ""})`);
      }
      setPhase("done");
      onHit?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Roll failed");
      setPhase("idle");
    }
  }

  async function roll() {
    setError(null);
    setPhase("rolling");
    try {
      await session(campaignId, `${name || "Attack"}`, async (scopedRoll) => {
        scopedRollRef.current = scopedRoll;

        const terms = [...extraAttackDice.map((d) => (d.startsWith("-") ? d : `+${d}`))];
        const totalAttackBonus = attackBonus - activePenalty;
        if (totalAttackBonus !== 0) terms.push(totalAttackBonus > 0 ? `+${totalAttackBonus}` : `${totalAttackBonus}`);
        const formula = `1d20${terms.join("")}`;
        const attackRoll = await scopedRoll(formula, `${name || "Attack"} attack roll`);

        if (!damageDice) {
          setPhase("done");
          return;
        }

        const natural = naturalD20(attackRoll.detail);
        // A natural 20 always hits as a crit, a natural 1 always misses -- RAW leaves no other
        // answer, so the Hit/Miss prompt (which exists because the app has no notion of target
        // AC) is skipped on exactly these two rolls (#145).
        if (natural !== null && natural >= critThreshold) {
          setSessionActions(<p style={{ margin: 0, color: "var(--success)", fontWeight: 600 }}>Critical hit!</p>);
          await rollDamagePhase(true);
          return;
        }
        if (natural === 1) {
          setSessionActions(<p style={{ margin: 0, color: "var(--danger)" }}>Critical miss.</p>);
          setPhase("done");
          return;
        }

        setSessionActions(
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => {
                setSessionActions(null);
                rollDamagePhase(false);
              }}
            >
              Hit
            </button>
            <button
              type="button"
              onClick={() => {
                setSessionActions(<p style={{ margin: 0, color: "var(--text-muted)" }}>Miss — no damage.</p>);
                setPhase("done");
              }}
            >
              Miss
            </button>
          </div>,
        );
      });
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
      {error && <span style={{ color: "var(--danger)", marginLeft: "0.5rem" }}>{error}</span>}
      {damageType && <small style={{ marginLeft: "0.5rem", color: "var(--text-dim)" }}>({damageType})</small>}
      {optionalModifiers.map((m) => (
        <label key={m.id} style={{ marginLeft: "0.5rem", fontSize: "0.85rem", color: "var(--text-muted)" }}>
          <input
            type="checkbox"
            checked={checkedModifiers.has(m.id)}
            onChange={(e) =>
              setCheckedModifiers((prev) => {
                const next = new Set(prev);
                if (e.target.checked) next.add(m.id);
                else next.delete(m.id);
                return next;
              })
            }
          />{" "}
          {m.label} ({m.attackPenalty > 0 ? "-" : "+"}
          {Math.abs(m.attackPenalty)}/+{m.damageBonus})
        </label>
      ))}
    </div>
  );
}
