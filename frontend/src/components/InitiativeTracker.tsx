import { useEffect, useState, type FormEvent } from "react";
import type { EncounterSnapshot, CampaignRole } from "shared";
import * as encountersApi from "../api/encounters";
import { useCampaignRoom, useSocketEvent } from "../socket/useSocketEvent";

export function InitiativeTracker({
  campaignId,
  role,
}: {
  campaignId: number | null;
  role: CampaignRole | null;
}) {
  const [encounter, setEncounter] = useState<EncounterSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isDM = campaignId === null || role === "dm";

  const [name, setName] = useState("");
  const [initiative, setInitiative] = useState("");
  const [hp, setHp] = useState("");

  useEffect(() => {
    encountersApi
      .getEncounter(campaignId)
      .then(setEncounter)
      .catch((err) => setError(err.message));
  }, [campaignId]);

  useCampaignRoom(campaignId);
  useSocketEvent<EncounterSnapshot>("initiative:updated", setEncounter, campaignId !== null);

  async function guard(action: () => Promise<EncounterSnapshot>) {
    try {
      const result = await action();
      setEncounter(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  async function handleAddCombatant(e: FormEvent) {
    e.preventDefault();
    await guard(() =>
      encountersApi.addCombatant(campaignId, {
        name,
        initiative: Number(initiative),
        hpCurrent: hp === "" ? null : Number(hp),
        hpMax: hp === "" ? null : Number(hp),
      }),
    );
    setName("");
    setInitiative("");
    setHp("");
  }

  return (
    <div>
      <h2>Initiative Tracker</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {!encounter || !encounter.isActive ? (
        isDM ? (
          <button onClick={() => guard(() => encountersApi.startEncounter(campaignId))}>Start encounter</button>
        ) : (
          <p>No active encounter.</p>
        )
      ) : (
        <div>
          <p>
            {encounter.name} &mdash; Round {encounter.round}
          </p>
          <ol>
            {encounter.combatants.map((c, index) => (
              <li
                key={c.id}
                style={{
                  fontWeight: index === encounter.currentTurnIndex ? "bold" : "normal",
                }}
              >
                {c.name} (init {c.initiative}) &mdash; HP {c.hpCurrent ?? "?"}/{c.hpMax ?? "?"}
                {c.conditions.length > 0 && <em> [{c.conditions.join(", ")}]</em>}
                {isDM && (
                  <>
                    {" "}
                    <button
                      onClick={() =>
                        guard(() => encountersApi.updateCombatant(c.id, { hpCurrent: (c.hpCurrent ?? 0) - 1 }))
                      }
                    >
                      -1 HP
                    </button>
                    <button onClick={() => guard(() => encountersApi.removeCombatant(c.id))}>Remove</button>
                  </>
                )}
              </li>
            ))}
          </ol>

          {isDM && (
            <>
              <button onClick={() => guard(() => encountersApi.advanceTurn(campaignId))}>Next turn</button>
              <button onClick={() => guard(() => encountersApi.endEncounter(campaignId))}>End encounter</button>

              <form onSubmit={handleAddCombatant}>
                <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
                <input
                  placeholder="Initiative"
                  type="number"
                  value={initiative}
                  onChange={(e) => setInitiative(e.target.value)}
                  required
                />
                <input placeholder="HP" type="number" value={hp} onChange={(e) => setHp(e.target.value)} />
                <button type="submit">Add combatant</button>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
}
