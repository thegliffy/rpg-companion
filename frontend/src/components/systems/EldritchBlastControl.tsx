import { useState } from "react";
import type { EldritchBlastProfile } from "shared";
import { naturalD20, critFormula } from "shared";
import { useDiceRoll } from "../../dice/DiceRollContext";

interface ExtraDamage {
  id: string;
  label: string;
  dice: string;
  type: string;
}

/**
 * Dedicated cast control for Eldritch Blast: rolls one attack + one damage per beam (beam count
 * scales with level), with Agonizing Blast's Charisma bonus already baked into `profile.damageDice`
 * and Eldritch Spear's range / Repelling Blast's push shown as annotations. This is what makes those
 * invocations "actually affect the spell" -- the generic SpellCastControl only rolls a single
 * attack+damage and knows nothing about beams or invocations.
 */
export function EldritchBlastControl({
  profile,
  spellAttackBonus,
  campaignId,
  // No extraCritDice prop, same reasoning as SpellCastControl: Brutal Critical/Savage Attacks are
  // both melee-weapon-only, so a spell attack (even a cantrip like this one) never gets them.
  critThreshold = 20,
  // Active effects broadly scoped to "any attack" (Bless/Bane, or a homebrew Hex-alike) rather
  // than weapon-only (#169) -- same shapes SpellCastControl/AttackRollControl take. This control
  // has no hit/miss gate at all (it always rolls damage right after each beam's attack), so
  // extraDamage entries append as extra per-beam rolls unconditionally, same as the base damage.
  extraAttackDice = [],
  extraDamage = [],
}: {
  profile: EldritchBlastProfile;
  spellAttackBonus: number | null;
  campaignId: number | null;
  critThreshold?: number;
  extraAttackDice?: string[];
  extraDamage?: ExtraDamage[];
}) {
  const { session } = useDiceRoll();
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cast() {
    setRolling(true);
    setError(null);
    try {
      const bonus = spellAttackBonus ?? 0;
      const terms = [...extraAttackDice.map((d) => (d.startsWith("-") ? d : `+${d}`))];
      if (bonus !== 0) terms.push(bonus > 0 ? `+${bonus}` : `${bonus}`);
      const attackFormula = `1d20${terms.join("")}`;
      // Every beam's attack + damage joins one session/modal (#138) rather than popping a dialog
      // per beam -- each beam still crits independently (#145).
      await session(campaignId, `Eldritch Blast (${profile.beams} beam${profile.beams > 1 ? "s" : ""})`, async (roll) => {
        for (let i = 0; i < profile.beams; i++) {
          const attack = await roll(attackFormula, `Beam ${i + 1} attack`);
          const natural = naturalD20(attack.detail);
          const isCrit = natural !== null && natural >= critThreshold;
          const damageFormula = isCrit ? critFormula(profile.damageDice) : profile.damageDice;
          await roll(damageFormula, `Beam ${i + 1}${isCrit ? " critical" : ""} damage`);

          for (const e of extraDamage) {
            const dice = isCrit ? critFormula(e.dice) : e.dice;
            await roll(dice, `Beam ${i + 1} bonus damage (${e.label}${e.type ? `, ${e.type}` : ""})`);
          }
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Roll failed");
    } finally {
      setRolling(false);
    }
  }

  return (
    <div style={{ marginTop: "0.25rem" }}>
      <button type="button" onClick={cast} disabled={rolling}>
        Cast Eldritch Blast ({profile.beams} beam{profile.beams > 1 ? "s" : ""})
      </button>{" "}
      <small style={{ color: "var(--text-muted)" }}>
        {profile.rangeFeet} ft · {profile.damageDice} force per beam
        {profile.agonizing ? " (Agonizing Blast)" : ""}
        {profile.eldritchSpear ? " · Eldritch Spear" : ""}
        {profile.push ? " · Repelling Blast: push 10 ft on hit" : ""}
      </small>
      {error && <span style={{ color: "var(--danger)", marginLeft: "0.5rem" }}>{error}</span>}
    </div>
  );
}
