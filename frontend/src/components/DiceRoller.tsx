import { useEffect, useRef, useState, type FormEvent } from "react";
import type { DiceRoll } from "shared";
import * as diceApi from "../api/dice";
import { useCampaignRoom, useSocketEvent } from "../socket/useSocketEvent";

export function DiceRoller({ campaignId }: { campaignId: number | null }) {
  const [rolls, setRolls] = useState<DiceRoll[]>([]);
  const [formula, setFormula] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    diceApi
      .listRolls(campaignId)
      .then(setRolls)
      .catch((err) => setError(err.message));
  }, [campaignId]);

  useCampaignRoom(campaignId);
  useSocketEvent<DiceRoll>(
    "roll:created",
    (roll) => {
      setRolls((prev) => [roll, ...prev].slice(0, 50));
    },
    campaignId !== null,
  );

  // Rolls are stored newest-first; the history renders oldest-to-newest (chat order) so scroll
  // to the bottom whenever the list changes to keep the latest roll in view.
  useEffect(() => {
    const el = historyRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [rolls]);

  async function handleRoll(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const roll = await diceApi.createRoll(campaignId, formula, label || undefined);
      if (campaignId === null) {
        setRolls((prev) => [roll, ...prev].slice(0, 50));
      }
      setFormula("");
      setLabel("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid dice formula");
    }
  }

  const oldestFirst = [...rolls].reverse();

  return (
    <div>
      <h2>Dice Roller</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div
        ref={historyRef}
        style={{
          height: 240,
          overflowY: "auto",
          border: "1px solid #ccc",
          borderRadius: 4,
          padding: "0.4rem 0.6rem",
          marginBottom: "0.5rem",
        }}
      >
        {oldestFirst.length === 0 ? (
          <p style={{ color: "#888", margin: 0 }}>No rolls yet.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {oldestFirst.map((r) => (
              <li key={r.id}>
                <strong>{r.username}</strong>
                {r.label && <> ({r.label})</>}: {r.breakdown}
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={handleRoll}>
        <input
          placeholder="e.g. 2d6+3"
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
          required
        />
        <input placeholder="Label (optional)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button type="submit">Roll</button>
      </form>
    </div>
  );
}
