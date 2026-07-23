import { useMemo, useState } from "react";
import type { CustomContent, Dnd5eSheetData, SrdMonster } from "shared";
import {
  SRD_MONSTERS,
  findMonster,
  familiarFormMonsters,
  formatMonsterCR,
  customMonsterToSrdShape,
} from "shared";
import { AttackRollControl } from "./AttackRollControl";
import { useCustomContent } from "../../hooks/useCustomContent";

const box: React.CSSProperties = { border: "1px solid #bbb", borderRadius: 6, padding: "0.75rem" };

function speedText(speed: Record<string, number | undefined>): string {
  return Object.entries(speed)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k} ${v} ft`)
    .join(", ");
}

/** A monster's actions that carry a full attack line (bonus + damage), rollable via the dice API.
 * Multiattack and non-attack actions (no attackBonus) are skipped -- same filter Wild Shape uses. */
function rollableAttacks(m: SrdMonster) {
  return m.actions.filter(
    (a): a is typeof a & { attackBonus: number; damageDice: string; damageType: string } =>
      a.attackBonus !== undefined && a.damageDice !== undefined && a.damageType !== undefined,
  );
}

/** General familiar tracker (any class that knows find familiar). Pick a form, summon it into a
 * separate stat block + HP pool, roll its attacks. `chainPact` widens the selectable forms with
 * the Pact of the Chain special forms and surfaces the Voice of the Chain Master note. */
export function FamiliarPanel({
  sheet,
  setSheet,
  campaignId,
  chainPact,
  chainMasterVoice,
}: {
  sheet: Dnd5eSheetData;
  setSheet: (updater: (prev: Dnd5eSheetData) => Dnd5eSheetData) => void;
  campaignId: number | null;
  chainPact: boolean;
  chainMasterVoice: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  const { monsters: customMonsters } = useCustomContent();
  const customFamiliars = useMemo(() => customMonsters.map(customMonsterToSrdShape), [customMonsters]);
  const customIds = new Set(customFamiliars.map((m) => m.id));

  // Default choices are the find familiar forms (+ chain forms when a chain-pact warlock); "show
  // all" opens the full SRD monster list plus any approved custom monsters as familiar forms.
  const choices = useMemo(() => {
    if (showAll) return [...SRD_MONSTERS, ...customFamiliars];
    return familiarFormMonsters(chainPact);
  }, [showAll, customFamiliars, chainPact]);

  const active = sheet.familiar.monsterId
    ? (findMonster(sheet.familiar.monsterId) ?? customFamiliars.find((m) => m.id === sheet.familiar.monsterId))
    : undefined;

  function summon() {
    const monster = choices.find((m) => m.id === selectedId) ?? findMonster(selectedId);
    if (!monster) return;
    setSheet((prev) => ({
      ...prev,
      familiar: { monsterId: monster.id, hpCurrent: monster.hp, hpMax: monster.hp, dismissed: false },
    }));
  }

  function setDismissed(dismissed: boolean) {
    setSheet((prev) => ({ ...prev, familiar: { ...prev.familiar, dismissed } }));
  }

  function release() {
    setSheet((prev) => ({ ...prev, familiar: { monsterId: "", hpCurrent: 0, hpMax: 0, dismissed: false } }));
    setSelectedId("");
  }

  function setFamiliarHp(v: string) {
    const n = Math.max(0, Number(v) || 0);
    setSheet((prev) => ({ ...prev, familiar: { ...prev.familiar, hpCurrent: n } }));
  }

  const attacks = active ? rollableAttacks(active) : [];

  return (
    <div style={box}>
      <h3>Familiar</h3>
      {chainPact && (
        <p style={{ fontSize: "0.85rem", color: "#555", margin: "0 0 0.5rem" }}>
          Pact of the Chain: you can also choose the imp, pseudodragon, quasit, or sprite form.
          {chainMasterVoice && " Voice of the Chain Master: communicate telepathically and perceive through its senses on the same plane."}
        </p>
      )}

      {!active ? (
        <div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">Choose a form…</option>
              {choices.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (CR {formatMonsterCR(m.cr)}){customIds.has(m.id) ? " — homebrew" : ""}
                </option>
              ))}
            </select>
            <button type="button" onClick={summon} disabled={!selectedId}>
              Summon
            </button>
            <label style={{ fontSize: "0.85rem" }}>
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show all monsters
            </label>
          </div>
          <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.3rem" }}>
            {showAll ? "Showing every monster as a possible form." : "Standard find familiar forms."}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <strong style={{ fontSize: "1.1rem" }}>
              {active.name}{" "}
              <small style={{ color: "#666" }}>
                ({active.size} {active.type}, CR {formatMonsterCR(active.cr)})
              </small>
            </strong>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              {sheet.familiar.dismissed ? (
                <button type="button" onClick={() => setDismissed(false)}>
                  Resummon
                </button>
              ) : (
                <button type="button" onClick={() => setDismissed(true)}>
                  Dismiss
                </button>
              )}
              <button type="button" onClick={release}>
                Choose different form
              </button>
            </div>
          </div>

          {sheet.familiar.dismissed ? (
            <p style={{ color: "#888", margin: "0.4rem 0" }}>Familiar dismissed — resummon it (takes 1 hour in play).</p>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "0.2rem 1rem", margin: "0.5rem 0", fontSize: "0.9rem" }}>
                <span>AC</span>
                <strong>{active.ac}</strong>
                <span>HP</span>
                <span>
                  <input
                    type="number"
                    min={0}
                    value={sheet.familiar.hpCurrent}
                    onChange={(e) => setFamiliarHp(e.target.value)}
                    style={{ width: "3.5rem", textAlign: "center" }}
                  />{" "}
                  / {sheet.familiar.hpMax} <small style={{ color: "#666" }}>({active.hitDice})</small>
                </span>
                <span>Speed</span>
                <span>{speedText(active.speed)}</span>
                <span>Senses</span>
                <span>Passive Perception {active.senses.passivePerception}</span>
                <span>STR / DEX / CON</span>
                <span>
                  {active.str} / {active.dex} / {active.con}
                </span>
                <span>INT / WIS / CHA</span>
                <span>
                  {active.int} / {active.wis} / {active.cha}
                </span>
              </div>

              {sheet.familiar.hpCurrent === 0 && (
                <p style={{ color: "crimson", margin: "0.4rem 0" }}>
                  At 0 HP the familiar disappears — resummon it later (1 hour) or choose a different form.
                </p>
              )}

              {attacks.length > 0 && (
                <div>
                  <h4 style={{ marginBottom: "0.25rem" }}>Attacks</h4>
                  {attacks.map((atk) => (
                    <div key={atk.name} style={{ marginBottom: "0.4rem" }}>
                      <span>
                        <strong>{atk.name}</strong> — {atk.damageDice} {atk.damageType.toLowerCase()}
                      </span>
                      <AttackRollControl
                        name={`${active.name} ${atk.name}`}
                        attackBonus={atk.attackBonus}
                        magicBonus={0}
                        damageDice={atk.damageDice}
                        damageType={atk.damageType}
                        campaignId={campaignId}
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
