import { useEffect, useRef, useState, type FormEvent } from "react";
import type { DiceRoll } from "shared";
import * as diceApi from "../api/dice";
import * as campaignsApi from "../api/campaigns";
import { useCampaignRoom, useSocketEvent } from "../socket/useSocketEvent";
import { useDiceRoll } from "../dice/DiceRollContext";
import { cardRaised } from "../styles";

export function DiceRoller({ campaignId, role = "player" }: { campaignId: number | null; role?: "dm" | "player" }) {
  const { roll: diceRoll } = useDiceRoll();
  const [rolls, setRolls] = useState<DiceRoll[]>([]);
  const [formula, setFormula] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [flavorOn, setFlavorOn] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    diceApi
      .listRolls(campaignId)
      .then(setRolls)
      .catch((err) => setError(err.message));
  }, [campaignId]);

  useEffect(() => {
    if (campaignId === null) return;
    campaignsApi
      .getCampaign(campaignId)
      .then((c) => setFlavorOn(c.flavorRolls))
      .catch(() => {});
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
      const roll = await diceRoll(campaignId, formula, label || undefined);
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
    <div style={cardRaised}>
      <h2 style={{ marginTop: 0 }}>Dice Roller</h2>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div
        ref={historyRef}
        style={{
          height: 240,
          overflowY: "auto",
          marginBottom: "0.5rem",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius)",
          padding: "0.5rem",
          background: "var(--surface-sunken)",
        }}
      >
        {oldestFirst.length === 0 ? (
          <p style={{ color: "var(--text-dim)", margin: 0 }}>No rolls yet.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {oldestFirst.map((r) => (
              <li key={r.id}>
                <strong>{r.username}</strong>
                {r.label && <> ({r.label})</>}: {r.breakdown}
                {r.flavor && (
                  <em style={{ display: "block", color: "var(--text-dim)", marginLeft: "1rem" }}>
                    {r.flavor}
                  </em>
                )}
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
      {campaignId !== null && role === "dm" && (
        <label style={{ fontSize: "0.8rem", color: "var(--text-dim)", display: "flex", gap: "0.4rem", alignItems: "center", marginTop: "0.4rem" }}>
          <input
            type="checkbox"
            checked={flavorOn}
            onChange={(e) => {
              const next = e.target.checked;
              setFlavorOn(next);
              campaignsApi.updateCampaign(campaignId, { flavorRolls: next }).catch((err) => setError(err instanceof Error ? err.message : "Failed to save"));
            }}
          />
          AI flavor text on rolls
        </label>
      )}
    </div>
  );
}
