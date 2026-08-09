import { useMemo, useState } from "react";
import type { Dnd5eSheetData, SrdMonster } from "shared";
import { SRD_MONSTERS, findMonster, formatMonsterCR, customMonsterToSrdShape, companionGrantConfig, attackBonus, attackDamageBonus, proficiencyBonus } from "shared";
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
 * Two kinds, branched on the granting content's own companionKind (companionGrantConfig):
 * "monster" (the default) mirrors FamiliarPanel's "pick any SRD/custom monster, summon/dismiss"
 * flow, optionally capped to a CR (Beast Master's real CR <= 1/4 restriction) with the same
 * "show all" override WildShapePanel/FamiliarPanel already use for their own CR/form gating.
 * "echo" is Echo Knight's Echo, which isn't a monster at all -- 1 HP, AC = 13 + proficiency
 * bonus, and its "Unleash Incarnation" attack mirrors the knight's own weapon attack exactly, so
 * that branch has no picker and no monster stat block at all. */
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
  const [showAll, setShowAll] = useState(false);

  const { monsters: customMonsters } = useCustomContent();
  const customOptions = useMemo(() => customMonsters.map(customMonsterToSrdShape), [customMonsters]);
  const customIds = new Set(customOptions.map((m) => m.id));
  const allChoices = useMemo(() => [...SRD_MONSTERS, ...customOptions], [customOptions]);

  const config = companionGrantConfig(sheet);
  const maxCR = config?.maxCR;
  const choices = useMemo(
    () => (showAll || maxCR === undefined ? allChoices : allChoices.filter((m) => m.cr <= maxCR)),
    [allChoices, showAll, maxCR],
  );

  const isEcho = sheet.companion.monsterId ? sheet.companion.kind === "echo" : config?.kind === "echo";

  const active = sheet.companion.monsterId
    ? (findMonster(sheet.companion.monsterId) ?? customOptions.find((m) => m.id === sheet.companion.monsterId))
    : undefined;

  function summon() {
    const monster = choices.find((m) => m.id === selectedId) ?? findMonster(selectedId);
    if (!monster) return;
    setSheet((prev) => ({
      ...prev,
      companion: { kind: "monster", monsterId: monster.id, name: "", hpCurrent: monster.hp, hpMax: monster.hp, dismissed: false },
    }));
  }

  function manifestEcho() {
    setSheet((prev) => ({
      ...prev,
      companion: { kind: "echo", monsterId: "echo", name: prev.companion.name, hpCurrent: 1, hpMax: 1, dismissed: false },
    }));
  }

  function setDismissed(dismissed: boolean) {
    setSheet((prev) => ({ ...prev, companion: { ...prev.companion, dismissed } }));
  }

  function release() {
    setSheet((prev) => ({ ...prev, companion: { kind: "monster", monsterId: "", name: "", hpCurrent: 0, hpMax: 0, dismissed: false } }));
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
  const echoAC = 13 + proficiencyBonus(sheet.level);
  const summoned = isEcho ? sheet.companion.monsterId === "echo" : Boolean(active);

  return (
    <div style={box}>
      <h3>Companion</h3>

      {!summoned ? (
        isEcho ? (
          <button type="button" onClick={manifestEcho}>
            Manifest Echo
          </button>
        ) : (
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
              {maxCR !== undefined && (
                <label style={{ fontSize: "0.85rem" }}>
                  <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show all monsters
                </label>
              )}
            </div>
            {maxCR !== undefined && (
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.3rem" }}>
                {showAll ? "Showing every monster as a possible form." : `Limited to CR ${formatMonsterCR(maxCR)} or lower.`}
              </div>
            )}
          </div>
        )
      ) : isEcho ? (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <strong style={{ fontSize: "1.1rem" }}>
              <input
                type="text"
                value={sheet.companion.name}
                onChange={(e) => setCompanionName(e.target.value)}
                placeholder="Echo"
                style={{ fontWeight: "bold", fontSize: "1rem", width: "10rem" }}
              />
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
                Release
              </button>
            </div>
          </div>

          {sheet.companion.dismissed ? (
            <p style={{ color: "var(--text-dim)", margin: "0.4rem 0" }}>Echo dismissed — manifest it again as a bonus action.</p>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "0.2rem 1rem", margin: "0.5rem 0", fontSize: "0.9rem" }}>
                <span>AC</span>
                <strong>{echoAC}</strong>
                <span>HP</span>
                <span>1 — destroyed by any damage</span>
              </div>

              {sheet.attacks.length > 0 && (
                <div>
                  <h4 style={{ marginBottom: "0.25rem" }}>
                    Attacks <small style={{ color: "var(--text-muted)", fontWeight: "normal" }}>(Unleash Incarnation: your own weapon attacks, through the Echo)</small>
                  </h4>
                  {sheet.attacks.map((atk) => (
                    <div key={atk.id} style={{ marginBottom: "0.4rem" }}>
                      <span>
                        <strong>{atk.name || "(unnamed attack)"}</strong> — {atk.damageDice} {atk.damageType.toLowerCase()}
                      </span>
                      <AttackRollControl
                        name={`${sheet.companion.name || "Echo"} - ${atk.name}`}
                        attackBonus={attackBonus(sheet, atk)}
                        magicBonus={attackDamageBonus(sheet, atk)}
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
      ) : (
        active && (
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
        )
      )}
    </div>
  );
}
