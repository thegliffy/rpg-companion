import { useEffect, useMemo, useRef, useState } from "react";
import {
  dnd5eSheetSchema,
  effectiveAC,
  effectiveAbilityScore,
  abilityModifier,
  attackBonus as computeAttackBonus,
  formatModifier,
  SRD_MONSTERS,
  formatMonsterCR,
  customMonsterToSrdShape,
} from "shared";
import type { Character, SrdMonster } from "shared";
import * as charactersApi from "../api/characters";
import * as diceApi from "../api/dice";
import { useCustomContent } from "../hooks/useCustomContent";

interface ArenaAttack {
  name: string;
  attackBonus: number;
  damageDice: string;
  damageType: string;
}

interface Combatant {
  key: string;
  label: string;
  ac: number;
  hpMax: number;
  hpCurrent: number;
  dexMod: number;
  attacks: ArenaAttack[];
  initiative: number | null;
}

function combatantFromCharacter(c: Character): Combatant | null {
  if (c.system !== "dnd5e") return null;
  const sheet = dnd5eSheetSchema.parse(c.sheetData ?? {});
  const hpMax = c.hpMax ?? 0;
  return {
    key: `char-${c.id}`,
    label: c.name,
    ac: effectiveAC(sheet),
    hpMax,
    hpCurrent: c.hpCurrent ?? hpMax,
    dexMod: abilityModifier(effectiveAbilityScore(sheet, "dex")),
    attacks: sheet.attacks
      .filter((a) => a.damageDice.trim() !== "")
      .map((a) => ({
        name: a.name || "Attack",
        attackBonus: computeAttackBonus(sheet, a),
        damageDice: a.damageDice,
        damageType: a.damageType,
      })),
    initiative: null,
  };
}

function combatantFromMonster(m: SrdMonster): Combatant {
  return {
    key: `monster-${m.id}`,
    label: m.name,
    ac: m.ac,
    hpMax: m.hp,
    hpCurrent: m.hp,
    dexMod: abilityModifier(m.dex),
    attacks: m.actions
      .filter((a): a is typeof a & { attackBonus: number; damageDice: string; damageType: string } =>
        a.attackBonus !== undefined && a.damageDice !== undefined && a.damageType !== undefined,
      )
      .map((a) => ({ name: a.name, attackBonus: a.attackBonus, damageDice: a.damageDice, damageType: a.damageType })),
    initiative: null,
  };
}

type Phase = "setup" | "battle" | "finished";

export function ArenaPage({ onBack }: { onBack: () => void }) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sideAId, setSideAId] = useState<number | "">("");
  const [sideBKind, setSideBKind] = useState<"monster" | "character">("monster");
  const [sideBCharId, setSideBCharId] = useState<number | "">("");
  const [monsterSearch, setMonsterSearch] = useState("");
  const [sideBMonsterId, setSideBMonsterId] = useState("");

  const [phase, setPhase] = useState<Phase>("setup");
  const [a, setA] = useState<Combatant | null>(null);
  const [b, setB] = useState<Combatant | null>(null);
  const [turnKey, setTurnKey] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const { monsters: customMonsters } = useCustomContent();
  const allMonsters = useMemo(
    () => [...SRD_MONSTERS, ...customMonsters.map(customMonsterToSrdShape)],
    [customMonsters],
  );
  const customMonsterIds = new Set(customMonsters.map((c) => `custom-${c.id}`));

  useEffect(() => {
    charactersApi
      .listMyCharacters()
      .then((cs) => setCharacters(cs.filter((c) => c.system === "dnd5e")))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load characters"));
  }, []);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  const filteredMonsters = useMemo(() => {
    const q = monsterSearch.trim().toLowerCase();
    if (!q) return allMonsters.slice(0, 30);
    return allMonsters.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 30);
  }, [allMonsters, monsterSearch]);

  function addLog(line: string) {
    setLog((prev) => [...prev, line]);
  }

  async function startFight() {
    setError(null);
    const charA = characters.find((c) => c.id === sideAId);
    if (!charA) {
      setError("Pick a character for side A");
      return;
    }
    const combatantA = combatantFromCharacter(charA);
    if (!combatantA) {
      setError("Side A must be a D&D 5e character");
      return;
    }

    let combatantB: Combatant | null = null;
    if (sideBKind === "monster") {
      const monster = allMonsters.find((m) => m.id === sideBMonsterId);
      if (!monster) {
        setError("Pick a monster for side B");
        return;
      }
      combatantB = combatantFromMonster(monster);
    } else {
      const charB = characters.find((c) => c.id === sideBCharId);
      if (!charB) {
        setError("Pick a character for side B");
        return;
      }
      combatantB = combatantFromCharacter(charB);
      if (!combatantB) {
        setError("Side B must be a D&D 5e character");
        return;
      }
    }

    setBusy(true);
    try {
      const rollA = await diceApi.createRoll(
        null,
        combatantA.dexMod === 0 ? "1d20" : `1d20${combatantA.dexMod > 0 ? "+" : ""}${combatantA.dexMod}`,
        `${combatantA.label} initiative`,
      );
      const rollB = await diceApi.createRoll(
        null,
        combatantB.dexMod === 0 ? "1d20" : `1d20${combatantB.dexMod > 0 ? "+" : ""}${combatantB.dexMod}`,
        `${combatantB.label} initiative`,
      );
      const initA = { ...combatantA, initiative: rollA.total };
      const initB = { ...combatantB, initiative: rollB.total };
      setA(initA);
      setB(initB);
      setLog([
        `${initA.label} rolls initiative: ${rollA.breakdown}`,
        `${initB.label} rolls initiative: ${rollB.breakdown}`,
      ]);
      const first = rollA.total >= rollB.total ? initA.key : initB.key;
      setTurnKey(first);
      addLog(`${(rollA.total >= rollB.total ? initA : initB).label} goes first!`);
      setPhase("battle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start fight");
    } finally {
      setBusy(false);
    }
  }

  async function attack(attacker: Combatant, defender: Combatant, atk: ArenaAttack, isA: boolean) {
    if (busy || phase !== "battle") return;
    setBusy(true);
    setError(null);
    try {
      const formula = atk.attackBonus === 0 ? "1d20" : `1d20${atk.attackBonus > 0 ? "+" : ""}${atk.attackBonus}`;
      const atkRoll = await diceApi.createRoll(null, formula, `${attacker.label} ${atk.name}`);
      const hit = atkRoll.total >= defender.ac;
      addLog(`${attacker.label}'s ${atk.name}: ${atkRoll.breakdown} vs AC ${defender.ac} — ${hit ? "HIT" : "miss"}`);

      if (hit) {
        const dmgRoll = await diceApi.createRoll(null, atk.damageDice, `${attacker.label} ${atk.name} damage`);
        const dmg = Math.max(0, dmgRoll.total);
        const newHp = Math.max(0, defender.hpCurrent - dmg);
        addLog(`  ${dmgRoll.breakdown} ${atk.damageType} — ${defender.label} ${defender.hpCurrent}→${newHp} HP`);
        const updatedDefender = { ...defender, hpCurrent: newHp };
        if (isA) setB(updatedDefender);
        else setA(updatedDefender);

        if (newHp <= 0) {
          addLog(`${defender.label} has fallen! ${attacker.label} wins!`);
          setPhase("finished");
          setBusy(false);
          return;
        }
      }
      setTurnKey(defender.key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Roll failed");
    } finally {
      setBusy(false);
    }
  }

  function adjustHp(isA: boolean, delta: number) {
    const setter = isA ? setA : setB;
    const current = isA ? a : b;
    if (!current) return;
    const newHp = Math.max(0, Math.min(current.hpMax, current.hpCurrent + delta));
    setter({ ...current, hpCurrent: newHp });
    addLog(`${current.label} HP manually adjusted: ${current.hpCurrent}→${newHp}`);
    if (newHp <= 0 && phase === "battle") {
      const other = isA ? b : a;
      addLog(`${current.label} has fallen!${other ? ` ${other.label} wins!` : ""}`);
      setPhase("finished");
    }
  }

  function reset() {
    setPhase("setup");
    setA(null);
    setB(null);
    setTurnKey(null);
    setLog([]);
    setError(null);
  }

  return (
    <div style={{ maxWidth: 800, margin: "2rem auto", padding: "0 1rem" }}>
      <button onClick={onBack}>&larr; Back</button>
      <h1>Arena</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {phase === "setup" && (
        <div>
          <p style={{ color: "#666" }}>
            Pick two combatants and simulate a fight, turn by turn. Only D&D 5e characters can fight (attacks/AC are
            pulled from their sheet).
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: "0.75rem" }}>
              <h3>Side A</h3>
              <select value={sideAId} onChange={(e) => setSideAId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">Choose a character…</option>
                {characters.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ border: "1px solid #ccc", borderRadius: 6, padding: "0.75rem" }}>
              <h3>Side B</h3>
              <label style={{ marginRight: "1rem" }}>
                <input
                  type="radio"
                  checked={sideBKind === "monster"}
                  onChange={() => setSideBKind("monster")}
                />{" "}
                Monster
              </label>
              <label>
                <input
                  type="radio"
                  checked={sideBKind === "character"}
                  onChange={() => setSideBKind("character")}
                />{" "}
                Character
              </label>

              {sideBKind === "monster" ? (
                <div style={{ marginTop: "0.5rem" }}>
                  <input
                    placeholder="Search monsters…"
                    value={monsterSearch}
                    onChange={(e) => setMonsterSearch(e.target.value)}
                    style={{ width: "100%", marginBottom: "0.3rem" }}
                  />
                  <select
                    value={sideBMonsterId}
                    onChange={(e) => setSideBMonsterId(e.target.value)}
                    size={6}
                    style={{ width: "100%" }}
                  >
                    {filteredMonsters.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (CR {formatMonsterCR(m.cr)}){customMonsterIds.has(m.id) ? " — homebrew" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div style={{ marginTop: "0.5rem" }}>
                  <select value={sideBCharId} onChange={(e) => setSideBCharId(e.target.value ? Number(e.target.value) : "")}>
                    <option value="">Choose a character…</option>
                    {characters.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <button onClick={startFight} disabled={busy} style={{ marginTop: "1rem", fontSize: "1.1rem", padding: "0.5rem 2rem" }}>
            {busy ? "Rolling…" : "Start fight"}
          </button>
        </div>
      )}

      {(phase === "battle" || phase === "finished") && a && b && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
            {[
              { c: a, isA: true },
              { c: b, isA: false },
            ].map(({ c, isA }) => (
              <div
                key={c.key}
                style={{
                  border: turnKey === c.key && phase === "battle" ? "2px solid #2a6" : "1px solid #ccc",
                  borderRadius: 6,
                  padding: "0.75rem",
                }}
              >
                <h3 style={{ marginBottom: "0.2rem" }}>
                  {c.label} {turnKey === c.key && phase === "battle" && <span style={{ color: "#2a6" }}>(turn)</span>}
                </h3>
                <p style={{ margin: "0.2rem 0" }}>
                  AC {c.ac} · Initiative {c.initiative} · HP{" "}
                  <strong style={{ color: c.hpCurrent === 0 ? "crimson" : undefined }}>
                    {c.hpCurrent} / {c.hpMax}
                  </strong>{" "}
                  <button type="button" onClick={() => adjustHp(isA, -1)} disabled={phase === "finished"}>
                    -1
                  </button>
                  <button type="button" onClick={() => adjustHp(isA, 1)} disabled={phase === "finished"}>
                    +1
                  </button>
                </p>

                {phase === "battle" && turnKey === c.key && (
                  <div>
                    {c.attacks.length === 0 && <p style={{ color: "#888" }}>No rollable attacks.</p>}
                    {c.attacks.map((atk) => (
                      <button
                        key={atk.name}
                        type="button"
                        disabled={busy}
                        onClick={() => attack(c, isA ? b : a, atk, isA)}
                        style={{ display: "block", width: "100%", textAlign: "left", marginBottom: "0.3rem" }}
                      >
                        {atk.name} ({formatModifier(atk.attackBonus)}, {atk.damageDice} {atk.damageType})
                      </button>
                    ))}
                    <button type="button" onClick={() => setTurnKey(isA ? b.key : a.key)} disabled={busy}>
                      Pass turn
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div
            ref={logRef}
            style={{ height: 220, overflowY: "auto", border: "1px solid #ccc", borderRadius: 6, padding: "0.5rem 0.75rem" }}
          >
            {log.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>

          <button onClick={reset} style={{ marginTop: "1rem" }}>
            {phase === "finished" ? "New fight" : "Reset"}
          </button>
        </div>
      )}
    </div>
  );
}
