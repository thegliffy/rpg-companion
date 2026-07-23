import { useState } from "react";
import type { EldritchBlastProfile } from "shared";
import * as diceApi from "../../api/dice";

interface BeamResult {
  attack: string;
  damage: string;
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
}: {
  profile: EldritchBlastProfile;
  spellAttackBonus: number | null;
  campaignId: number | null;
}) {
  const [beams, setBeams] = useState<BeamResult[] | null>(null);
  const [rolling, setRolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cast() {
    setRolling(true);
    setError(null);
    setBeams(null);
    try {
      const bonus = spellAttackBonus ?? 0;
      const attackFormula = bonus === 0 ? "1d20" : `1d20${bonus > 0 ? "+" : ""}${bonus}`;
      const results: BeamResult[] = [];
      for (let i = 0; i < profile.beams; i++) {
        const attack = await diceApi.createRoll(campaignId, attackFormula, `Eldritch Blast beam ${i + 1} attack`);
        const damage = await diceApi.createRoll(campaignId, profile.damageDice, `Eldritch Blast beam ${i + 1} damage`);
        results.push({ attack: attack.breakdown, damage: damage.breakdown });
      }
      setBeams(results);
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
      <small style={{ color: "#666" }}>
        {profile.rangeFeet} ft · {profile.damageDice} force per beam
        {profile.agonizing ? " (Agonizing Blast)" : ""}
        {profile.eldritchSpear ? " · Eldritch Spear" : ""}
        {profile.push ? " · Repelling Blast: push 10 ft on hit" : ""}
      </small>
      {error && <span style={{ color: "crimson", marginLeft: "0.5rem" }}>{error}</span>}
      {beams && (
        <div style={{ marginTop: "0.25rem", fontSize: "0.85rem" }}>
          {beams.map((b, i) => (
            <div key={i}>
              <strong>Beam {i + 1}:</strong> attack {b.attack} · damage {b.damage}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
