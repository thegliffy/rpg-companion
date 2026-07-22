import { useMemo, useState } from "react";
import type { CustomContent, CustomMonsterData, Dnd5eSheetData, SrdBeast } from "shared";
import { SRD_BEASTS, findBeast, wildShapeEligible, maxWildShapeCR, formatCR, customMonsterToSrdShape } from "shared";
import { AttackRollControl } from "./AttackRollControl";
import { useCustomContent } from "../../hooks/useCustomContent";

const box: React.CSSProperties = { border: "1px solid #bbb", borderRadius: 6, padding: "0.75rem" };

/** Maps a beast-type custom monster onto the SrdBeast shape, same attack filtering SRD_BEASTS
 * uses (srd-beasts.ts) -- so an approved homebrew beast is Wild-Shape-eligible identically to
 * an SRD one. */
function customMonsterToBeast(item: CustomContent): SrdBeast {
  const m = customMonsterToSrdShape(item);
  return {
    id: m.id,
    name: m.name,
    size: m.size,
    cr: m.cr,
    ac: m.ac,
    hp: m.hp,
    hitDice: m.hitDice,
    speed: m.speed,
    str: m.str,
    dex: m.dex,
    con: m.con,
    int: m.int,
    wis: m.wis,
    cha: m.cha,
    passivePerception: m.senses.passivePerception,
    attacks: m.actions
      .filter((a): a is typeof a & { attackBonus: number; damageDice: string; damageType: string } =>
        a.attackBonus !== undefined && a.damageDice !== undefined && a.damageType !== undefined,
      )
      .map((a) => ({ name: a.name, attackBonus: a.attackBonus, damageDice: a.damageDice, damageType: a.damageType })),
  };
}

function speedText(speed: Record<string, number | undefined>): string {
  return Object.entries(speed)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k} ${v} ft`)
    .join(", ");
}

/** Druid Wild Shape: pick a level-eligible beast and transform into a separate beast panel. */
export function WildShapePanel({
  sheet,
  setSheet,
  campaignId,
}: {
  sheet: Dnd5eSheetData;
  setSheet: (updater: (prev: Dnd5eSheetData) => Dnd5eSheetData) => void;
  campaignId: number | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const [selectedId, setSelectedId] = useState("");

  const { monsters: customMonsters } = useCustomContent();
  const customBeasts = useMemo(
    () => customMonsters.filter((m) => (m.data as CustomMonsterData).type === "beast").map(customMonsterToBeast),
    [customMonsters],
  );
  const allBeasts = useMemo(() => [...SRD_BEASTS, ...customBeasts], [customBeasts]);
  const customBeastIds = new Set(customBeasts.map((b) => b.id));

  const eligible = useMemo(
    () => (showAll ? allBeasts : allBeasts.filter((b) => wildShapeEligible(b, sheet.level))),
    [allBeasts, showAll, sheet.level],
  );

  const activeBeast = sheet.wildShape.beastId
    ? (findBeast(sheet.wildShape.beastId) ?? allBeasts.find((b) => b.id === sheet.wildShape.beastId))
    : undefined;

  function transform() {
    const beast = allBeasts.find((b) => b.id === selectedId);
    if (!beast || sheet.wildShape.usesAvailable <= 0) return;
    setSheet((prev) => ({
      ...prev,
      wildShape: {
        ...prev.wildShape,
        beastId: beast.id,
        hpCurrent: beast.hp,
        hpMax: beast.hp,
        usesAvailable: prev.wildShape.usesAvailable - 1,
      },
    }));
  }

  function revert() {
    setSheet((prev) => ({ ...prev, wildShape: { ...prev.wildShape, beastId: "", hpCurrent: 0, hpMax: 0 } }));
  }

  function setBeastHp(v: string) {
    const n = Math.max(0, Number(v) || 0);
    setSheet((prev) => ({ ...prev, wildShape: { ...prev.wildShape, hpCurrent: n } }));
  }

  return (
    <div style={box}>
      <h3>Wild Shape</h3>
      <div style={{ marginBottom: "0.5rem" }}>
        Uses available: <strong>{sheet.wildShape.usesAvailable}</strong>{" "}
        <small style={{ color: "#666" }}>(2 per short or long rest)</small>
      </div>

      {!activeBeast ? (
        <div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">Choose a beast…</option>
              {eligible.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} (CR {formatCR(b.cr)}){customBeastIds.has(b.id) ? " — homebrew" : ""}
                </option>
              ))}
            </select>
            <button type="button" onClick={transform} disabled={!selectedId || sheet.wildShape.usesAvailable <= 0}>
              Transform
            </button>
            <label style={{ fontSize: "0.85rem" }}>
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show all beasts
            </label>
          </div>
          <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.3rem" }}>
            {showAll
              ? "Showing every beast — mind your level limits."
              : `Filtered to your level (max CR ${formatCR(maxWildShapeCR(sheet.level))}${
                  sheet.level < 4 ? ", no flying/swimming" : sheet.level < 8 ? ", no flying" : ""
                }).`}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <strong style={{ fontSize: "1.1rem" }}>
              {activeBeast.name} <small style={{ color: "#666" }}>({activeBeast.size}, CR {formatCR(activeBeast.cr)})</small>
            </strong>
            <button type="button" onClick={revert}>
              Revert
            </button>
          </div>

          {sheet.wildShape.hpCurrent === 0 && (
            <p style={{ color: "crimson", margin: "0.4rem 0" }}>
              Dropped to 0 HP — you revert to your normal form (excess damage carries over to your own HP). Click Revert.
            </p>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "0.2rem 1rem", margin: "0.5rem 0", fontSize: "0.9rem" }}>
            <span>AC</span>
            <strong>{activeBeast.ac}</strong>
            <span>Beast HP</span>
            <span>
              <input
                type="number"
                min={0}
                value={sheet.wildShape.hpCurrent}
                onChange={(e) => setBeastHp(e.target.value)}
                style={{ width: "3.5rem", textAlign: "center" }}
              />{" "}
              / {sheet.wildShape.hpMax} <small style={{ color: "#666" }}>({activeBeast.hitDice})</small>
            </span>
            <span>Speed</span>
            <span>{speedText(activeBeast.speed)}</span>
            <span>Passive Perception</span>
            <span>{activeBeast.passivePerception}</span>
            <span>STR / DEX / CON</span>
            <span>
              {activeBeast.str} / {activeBeast.dex} / {activeBeast.con}
            </span>
          </div>
          <p style={{ fontSize: "0.8rem", color: "#666", marginTop: 0 }}>
            Your Intelligence, Wisdom, Charisma, alignment, and proficiencies stay your own while shaped.
          </p>

          {activeBeast.attacks.length > 0 && (
            <div>
              <h4 style={{ marginBottom: "0.25rem" }}>Attacks</h4>
              {activeBeast.attacks.map((atk) => (
                <div key={atk.name} style={{ marginBottom: "0.4rem" }}>
                  <span>
                    <strong>{atk.name}</strong> — {atk.damageDice} {atk.damageType.toLowerCase()}
                  </span>
                  <AttackRollControl
                    name={`${activeBeast.name} ${atk.name}`}
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
        </div>
      )}
    </div>
  );
}
