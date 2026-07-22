import { useMemo, useState } from "react";
import { SRD_MONSTERS, formatMonsterCR, abilityModifier, formatModifier, customMonsterToSrdShape } from "shared";
import type { SrdMonster } from "shared";
import { AttackRollControl } from "../components/systems/AttackRollControl";
import { useCustomContent } from "../hooks/useCustomContent";

function speedText(speed: SrdMonster["speed"]): string {
  return Object.entries(speed)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k} ${v} ft`)
    .join(", ");
}

function sensesText(senses: SrdMonster["senses"]): string {
  const parts = (["blindsight", "darkvision", "tremorsense", "truesight"] as const)
    .filter((k) => senses[k])
    .map((k) => `${k} ${senses[k]} ft`);
  parts.push(`passive Perception ${senses.passivePerception}`);
  return parts.join(", ");
}

function MonsterDetail({ monster }: { monster: SrdMonster }) {
  return (
    <div style={{ border: "1px solid #bbb", borderRadius: 6, padding: "1rem" }}>
      <h2 style={{ marginBottom: 0 }}>{monster.name}</h2>
      <p style={{ marginTop: "0.2rem", fontStyle: "italic", color: "#666" }}>
        {monster.size} {monster.type}, {monster.alignment}
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "0.2rem 1rem", fontSize: "0.9rem" }}>
        <span>Challenge Rating</span>
        <strong>
          {formatMonsterCR(monster.cr)} ({monster.xp} XP)
        </strong>
        <span>Armor Class</span>
        <strong>{monster.ac}</strong>
        <span>Hit Points</span>
        <strong>
          {monster.hp} ({monster.hitDice})
        </strong>
        <span>Speed</span>
        <strong>{speedText(monster.speed)}</strong>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: "0.5rem",
          textAlign: "center",
          margin: "0.75rem 0",
        }}
      >
        {(["str", "dex", "con", "int", "wis", "cha"] as const).map((a) => (
          <div key={a}>
            <div style={{ fontWeight: "bold" }}>{a.toUpperCase()}</div>
            <div>
              {monster[a]} ({formatModifier(abilityModifier(monster[a]))})
            </div>
          </div>
        ))}
      </div>

      <p style={{ fontSize: "0.85rem" }}>
        <strong>Senses</strong> {sensesText(monster.senses)}
        <br />
        <strong>Languages</strong> {monster.languages || "—"}
        {monster.damageVulnerabilities.length > 0 && (
          <>
            <br />
            <strong>Vulnerabilities</strong> {monster.damageVulnerabilities.join(", ")}
          </>
        )}
        {monster.damageResistances.length > 0 && (
          <>
            <br />
            <strong>Resistances</strong> {monster.damageResistances.join(", ")}
          </>
        )}
        {monster.damageImmunities.length > 0 && (
          <>
            <br />
            <strong>Damage Immunities</strong> {monster.damageImmunities.join(", ")}
          </>
        )}
        {monster.conditionImmunities.length > 0 && (
          <>
            <br />
            <strong>Condition Immunities</strong> {monster.conditionImmunities.join(", ")}
          </>
        )}
      </p>

      {monster.specialAbilities.length > 0 && (
        <div>
          <h3>Special abilities</h3>
          {monster.specialAbilities.map((sa) => (
            <p key={sa.name} style={{ fontSize: "0.9rem" }}>
              <strong>{sa.name}.</strong> {sa.desc}
            </p>
          ))}
        </div>
      )}

      {monster.actions.length > 0 && (
        <div>
          <h3>Actions</h3>
          {monster.actions.map((a) => (
            <div key={a.name} style={{ marginBottom: "0.5rem" }}>
              <p style={{ fontSize: "0.9rem", marginBottom: "0.2rem" }}>
                <strong>{a.name}.</strong> {a.desc}
              </p>
              {a.attackBonus !== undefined && a.damageDice !== undefined && a.damageType !== undefined && (
                <AttackRollControl
                  name={`${monster.name} ${a.name}`}
                  attackBonus={a.attackBonus}
                  magicBonus={0}
                  damageDice={a.damageDice}
                  damageType={a.damageType}
                  campaignId={null}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function BestiaryPage({ onBack }: { onBack: () => void }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [crFilter, setCrFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { monsters: customMonsters } = useCustomContent();
  const allMonsters = useMemo(
    () => [...SRD_MONSTERS, ...customMonsters.map(customMonsterToSrdShape)],
    [customMonsters],
  );
  const customMonsterIds = new Set(customMonsters.map((c) => `custom-${c.id}`));
  const monsterTypes = useMemo(() => [...new Set(allMonsters.map((m) => m.type))].sort(), [allMonsters]);
  const crOptions = useMemo(() => [...new Set(allMonsters.map((m) => m.cr))].sort((a, b) => a - b), [allMonsters]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allMonsters.filter((m) => {
      if (q && !m.name.toLowerCase().includes(q)) return false;
      if (typeFilter && m.type !== typeFilter) return false;
      if (crFilter && String(m.cr) !== crFilter) return false;
      return true;
    });
  }, [allMonsters, search, typeFilter, crFilter]);

  const selected = selectedId ? allMonsters.find((m) => m.id === selectedId) : undefined;

  return (
    <div style={{ maxWidth: 900, margin: "2rem auto", padding: "0 1rem" }}>
      <button onClick={onBack}>&larr; Back</button>
      <h1>Bestiary</h1>
      <p style={{ color: "#666" }}>
        {SRD_MONSTERS.length} SRD monsters{customMonsters.length > 0 ? ` + ${customMonsters.length} homebrew` : ""}.
        Source: 5e SRD 5.1 (CC-BY-4.0, via the open 5e-bits/5e-database project).
      </p>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200 }}
        />
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="">All types</option>
          {monsterTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select value={crFilter} onChange={(e) => setCrFilter(e.target.value)}>
          <option value="">All CRs</option>
          {crOptions.map((cr) => (
            <option key={cr} value={cr}>
              CR {formatMonsterCR(cr)}
            </option>
          ))}
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1rem", alignItems: "start" }}>
        <div style={{ maxHeight: "70vh", overflowY: "auto", border: "1px solid #ccc", borderRadius: 6 }}>
          {filtered.length === 0 && <p style={{ padding: "0.5rem" }}>No monsters match.</p>}
          {filtered.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setSelectedId(m.id)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "0.4rem 0.6rem",
                border: "none",
                borderBottom: "1px solid #eee",
                background: m.id === selectedId ? "#eef" : "transparent",
              }}
            >
              {m.name} <small style={{ color: "#888" }}>(CR {formatMonsterCR(m.cr)})</small>
              {customMonsterIds.has(m.id) && <small style={{ color: "#a60" }}> (homebrew)</small>}
            </button>
          ))}
        </div>

        {selected ? <MonsterDetail monster={selected} /> : <p>Select a monster to view its stat block.</p>}
      </div>
    </div>
  );
}
