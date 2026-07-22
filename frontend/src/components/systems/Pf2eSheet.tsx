import { useState } from "react";
import type { Character, Pf2eSheetData, Pf2eAbility, Pf2eRank } from "shared";
import {
  pf2eSheetSchema,
  PF2E_ABILITIES,
  PF2E_ABILITY_NAMES,
  PF2E_SKILLS,
  PF2E_RANKS,
  pf2eAbilityModifier,
  pf2eSaveBonus,
  pf2eSkillBonus,
  pf2ePerceptionBonus,
  formatModifier,
} from "shared";
import * as charactersApi from "../../api/characters";

const box: React.CSSProperties = { border: "1px solid #bbb", borderRadius: 6, padding: "0.75rem" };
const numInput: React.CSSProperties = { width: "3.5rem", textAlign: "center" };

function RankSelect({ value, onChange }: { value: Pf2eRank; onChange: (r: Pf2eRank) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as Pf2eRank)}>
      {PF2E_RANKS.map((r) => (
        <option key={r} value={r}>
          {r[0].toUpperCase()}
        </option>
      ))}
    </select>
  );
}

export function Pf2eSheet({
  character,
  onSaved,
}: {
  character: Character;
  onSaved: (c: Character) => void;
}) {
  const [sheet, setSheet] = useState<Pf2eSheetData>(() => pf2eSheetSchema.parse(character.sheetData ?? {}));
  const [name, setName] = useState(character.name);
  const [hpCurrent, setHpCurrent] = useState(character.hpCurrent != null ? String(character.hpCurrent) : "");
  const [hpMax, setHpMax] = useState(character.hpMax != null ? String(character.hpMax) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  function set<K extends keyof Pf2eSheetData>(key: K, value: Pf2eSheetData[K]) {
    setSheet((prev) => ({ ...prev, [key]: value }));
  }

  function setAbility(ability: Pf2eAbility, raw: string) {
    const score = Number(raw);
    if (!Number.isInteger(score)) return;
    setSheet((prev) => ({ ...prev, abilities: { ...prev.abilities, [ability]: score } }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await charactersApi.updateCharacter(character.id, {
        name,
        hpCurrent: hpCurrent === "" ? null : Number(hpCurrent),
        hpMax: hpMax === "" ? null : Number(hpMax),
        sheetData: sheet,
      });
      onSaved(updated);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ ...box, display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "end" }}>
        <label>
          Character name
          <br />
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ fontSize: "1.2rem" }} />
        </label>
        <label>
          Ancestry
          <br />
          <input value={sheet.ancestry} onChange={(e) => set("ancestry", e.target.value)} />
        </label>
        <label>
          Class
          <br />
          <input value={sheet.class} onChange={(e) => set("class", e.target.value)} />
        </label>
        <label>
          Background
          <br />
          <input value={sheet.background} onChange={(e) => set("background", e.target.value)} />
        </label>
        <label>
          Level
          <br />
          <input
            type="number"
            min={1}
            max={20}
            value={sheet.level}
            onChange={(e) => set("level", Number(e.target.value) || 1)}
            style={numInput}
          />
        </label>
        <label>
          Hero points
          <br />
          <input
            type="number"
            min={0}
            max={3}
            value={sheet.heroPoints}
            onChange={(e) => set("heroPoints", Number(e.target.value) || 0)}
            style={numInput}
          />
        </label>
      </div>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ ...box, flex: "0 0 auto" }}>
          <h3>Abilities</h3>
          {PF2E_ABILITIES.map((a) => (
            <div key={a} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
              <span style={{ width: "6.5rem" }}>{PF2E_ABILITY_NAMES[a]}</span>
              <input
                type="number"
                min={1}
                max={30}
                value={sheet.abilities[a]}
                onChange={(e) => setAbility(a, e.target.value)}
                style={numInput}
              />
              <strong style={{ width: "2.5rem" }}>{formatModifier(pf2eAbilityModifier(sheet.abilities[a]))}</strong>
            </div>
          ))}
        </div>

        <div style={{ ...box, flex: "0 0 auto" }}>
          <h3>Defenses &amp; saves</h3>
          <div style={{ display: "grid", gridTemplateColumns: "auto auto auto", gap: "0.4rem 0.8rem", alignItems: "center" }}>
            <span>AC</span>
            <input type="number" value={sheet.ac} onChange={(e) => set("ac", Number(e.target.value) || 0)} style={numInput} />
            <span />
            <span>HP</span>
            <span>
              <input type="number" value={hpCurrent} onChange={(e) => setHpCurrent(e.target.value)} style={numInput} /> /{" "}
              <input type="number" value={hpMax} onChange={(e) => setHpMax(e.target.value)} style={numInput} />
            </span>
            <span />
            <span>Speed</span>
            <input type="number" value={sheet.speed} onChange={(e) => set("speed", Number(e.target.value) || 0)} style={numInput} />
            <span />
            <span>Perception</span>
            <RankSelect value={sheet.perceptionRank} onChange={(r) => set("perceptionRank", r)} />
            <strong>{formatModifier(pf2ePerceptionBonus(sheet))}</strong>
            <span>Fortitude</span>
            <RankSelect value={sheet.saves.fortitude} onChange={(r) => set("saves", { ...sheet.saves, fortitude: r })} />
            <strong>{formatModifier(pf2eSaveBonus(sheet, "fortitude"))}</strong>
            <span>Reflex</span>
            <RankSelect value={sheet.saves.reflex} onChange={(r) => set("saves", { ...sheet.saves, reflex: r })} />
            <strong>{formatModifier(pf2eSaveBonus(sheet, "reflex"))}</strong>
            <span>Will</span>
            <RankSelect value={sheet.saves.will} onChange={(r) => set("saves", { ...sheet.saves, will: r })} />
            <strong>{formatModifier(pf2eSaveBonus(sheet, "will"))}</strong>
          </div>
          <p>
            <small>Ranks: U/T/E/M/L</small>
          </p>
        </div>

        <div style={{ ...box, flex: "1 1 260px" }}>
          <h3>Skills</h3>
          <div style={{ columnCount: 2, columnGap: "1.5rem" }}>
            {PF2E_SKILLS.map((s) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", breakInside: "avoid" }}>
                <RankSelect
                  value={sheet.skillRanks[s.id] ?? "untrained"}
                  onChange={(r) => set("skillRanks", { ...sheet.skillRanks, [s.id]: r })}
                />
                <span style={{ flex: 1 }}>
                  {s.name} <small>({s.ability.toUpperCase()})</small>
                </span>
                <strong>{formatModifier(pf2eSkillBonus(sheet, s.id))}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={box}>
        <h3>Attacks</h3>
        {sheet.attacks.map((atk, i) => (
          <div key={atk.id} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.3rem" }}>
            <input
              placeholder="Name"
              value={atk.name}
              onChange={(e) => set("attacks", sheet.attacks.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
            />
            <input
              placeholder="Atk bonus"
              value={atk.bonus}
              style={{ width: "6rem" }}
              onChange={(e) => set("attacks", sheet.attacks.map((x, j) => (j === i ? { ...x, bonus: e.target.value } : x)))}
            />
            <input
              placeholder="Damage/type"
              value={atk.damage}
              onChange={(e) => set("attacks", sheet.attacks.map((x, j) => (j === i ? { ...x, damage: e.target.value } : x)))}
            />
            <button type="button" onClick={() => set("attacks", sheet.attacks.filter((_, j) => j !== i))}>
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => set("attacks", [...sheet.attacks, { id: `atk-${Date.now()}`, name: "", bonus: "", damage: "" }])}
        >
          Add attack
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <label style={box}>
          Feats &amp; abilities
          <textarea value={sheet.featsText} onChange={(e) => set("featsText", e.target.value)} rows={5} style={{ width: "100%" }} />
        </label>
        <label style={box}>
          Spells
          <textarea value={sheet.spellsText} onChange={(e) => set("spellsText", e.target.value)} rows={5} style={{ width: "100%" }} />
        </label>
        <label style={box}>
          Equipment
          <textarea value={sheet.equipmentText} onChange={(e) => set("equipmentText", e.target.value)} rows={5} style={{ width: "100%" }} />
        </label>
        <label style={box}>
          Notes
          <textarea value={sheet.notesText} onChange={(e) => set("notesText", e.target.value)} rows={5} style={{ width: "100%" }} />
        </label>
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <div>
        <button onClick={save} disabled={saving} style={{ fontSize: "1.1rem", padding: "0.5rem 2rem" }}>
          {saving ? "Saving…" : "Save sheet"}
        </button>
        {savedFlash && <span style={{ marginLeft: "1rem", color: "green" }}>Saved ✓</span>}
      </div>
    </div>
  );
}
