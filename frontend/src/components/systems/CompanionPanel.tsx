import { useMemo, useState } from "react";
import type { Dnd5eSheetData, SrdMonster } from "shared";
import { SRD_MONSTERS, findMonster, formatMonsterCR, customMonsterToSrdShape } from "shared";
import { AttackRollControl } from "./AttackRollControl";
import { useCustomContent } from "../../hooks/useCustomContent";
import { panel as box } from "../../styles";

function speedText(speed: Record<string, number | undefined>): string {
  return Object.entries(speed)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k} ${v} ft`)
    .join(", ");
}

/** A monster's actions that carry a full attack line (bonus + damage), rollable via the dice API.
 * Same filter FamiliarPanel/WildShapePanel use. */
function rollableAttacks(m: SrdMonster) {
  return m.actions.filter(
    (a): a is typeof a & { attackBonus: number; damageDice: string; damageType: string } =>
      a.attackBonus !== undefined && a.damageDice !== undefined && a.damageType !== undefined,
  );
}

/** Linked companion creature (#182) -- a Ranger's Beast Master companion, an Echo Knight's Echo,
 * or any other "subclass grants a creature" feature that set grantsCompanion on a feat/feature.
 * Modeled directly on FamiliarPanel's "pick any SRD/custom monster, summon/dismiss" flow rather
 * than Wild Shape's CR-table gating, since there's no single RAW table covering every
 * companion-granting subclass -- unlike a familiar, this one also carries a player-given nickname
 * (Beast Master companions are usually named). */
export function CompanionPanel({
  sheet,
  setSheet,
  campaignId,
}: {
  sheet: Dnd5eSheetData;
  setSheet: (updater: (prev: Dnd5eSheetData) => Dnd5eSheetData) => void;
  campaignId: number | null;
}) {
  const [selectedId, setSelectedId] = useState("");

  const { monsters: customMonsters } = useCustomContent();
  const customOptions = useMemo(() => customMonsters.map(customMonsterToSrdShape), [customMonsters]);
  const customIds = new Set(customOptions.map((m) => m.id));
  const choices = useMemo(() => [...SRD_MONSTERS, ...customOptions], [customOptions]);

  const active = sheet.companion.monsterId
    ? (findMonster(sheet.companion.monsterId) ?? customOptions.find((m) => m.id === sheet.companion.monsterId))
    : undefined;

  function summon() {
    const monster = choices.find((m) => m.id === selectedId) ?? findMonster(selectedId);
    if (!monster) return;
    setSheet((prev) => ({
      ...prev,
      companion: { monsterId: monster.id, name: "", hpCurrent: monster.hp, hpMax: monster.hp, dismissed: false },
    }));
  }

  function setDismissed(dismissed: boolean) {
    setSheet((prev) => ({ ...prev, companion: { ...prev.companion, dismissed } }));
  }

  function release() {
    setSheet((prev) => ({ ...prev, companion: { monsterId: "", name: "", hpCurrent: 0, hpMax: 0, dismissed: false } }));
    setSelectedId("");
  }

  function setCompanionHp(v: string) {
    const n = Math.max(0, Number(v) || 0);
    setSheet((prev) => ({ ...prev, companion: { ...prev.companion, hpCurrent: n } }));
  }

  function setCompanionName(v: string) {
    setSheet((prev) => ({ ...prev, companion: { ...prev.companion, name: v } }));
  }

  const attacks = active ? rollableAttacks(active) : [];

  return (
    <div style={box}>
      <h3>Companion</h3>

      {!active ? (
        <div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">Choose a creature…</option>
              {choices.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (CR {formatMonsterCR(m.cr)}){customIds.has(m.id) ? " — homebrew" : ""}
                </option>
              ))}
            </select>
            <button type="button" onClick={summon} disabled={!selectedId}>
              Summon
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <strong style={{ fontSize: "1.1rem" }}>
              <input
                type="text"
                value={sheet.companion.name}
                onChange={(e) => setCompanionName(e.target.value)}
                placeholder={active.name}
                style={{ fontWeight: "bold", fontSize: "1rem", width: "10rem" }}
              />{" "}
              <small style={{ color: "var(--text-muted)" }}>
                ({active.name}, {active.size} {active.type}, CR {formatMonsterCR(active.cr)})
              </small>
            </strong>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              {sheet.companion.dismissed ? (
                <button type="button" onClick={() => setDismissed(false)}>
                  Resummon
                </button>
              ) : (
                <button type="button" onClick={() => setDismissed(true)}>
                  Dismiss
                </button>
              )}
              <button type="button" onClick={release}>
                Choose different creature
              </button>
            </div>
          </div>

          {sheet.companion.dismissed ? (
            <p style={{ color: "var(--text-dim)", margin: "0.4rem 0" }}>Companion dismissed — resummon it when it's back at your side.</p>
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
                    value={sheet.companion.hpCurrent}
                    onChange={(e) => setCompanionHp(e.target.value)}
                    style={{ width: "3.5rem", textAlign: "center" }}
                  />{" "}
                  / {sheet.companion.hpMax} <small style={{ color: "var(--text-muted)" }}>({active.hitDice})</small>
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

              {sheet.companion.hpCurrent === 0 && (
                <p style={{ color: "var(--danger)", margin: "0.4rem 0" }}>
                  At 0 HP the companion goes down — resolve it per your table's rules, or choose a different creature.
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
                        name={`${sheet.companion.name || active.name} ${atk.name}`}
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
