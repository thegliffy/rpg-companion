import { useEffect, useState } from "react";
import type { Character, CampaignSummary } from "shared";
import { characterIsActive } from "shared";
import * as charactersApi from "../api/characters";
import { CharacterCard } from "./CharacterCard";

export function MyCharactersSection({
  campaigns,
  onOpenCharacter,
  onCreateCharacter,
}: {
  campaigns: CampaignSummary[];
  onOpenCharacter: (id: number) => void;
  onCreateCharacter: () => void;
}) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attachSelections, setAttachSelections] = useState<Record<number, string>>({});

  function refresh() {
    charactersApi
      .listMyCharacters()
      .then((all) => setCharacters(all.filter(characterIsActive)))
      .catch((err) => setError(err.message));
  }

  useEffect(refresh, []);

  async function guard(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  return (
    <div>
      <h2>My characters</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {characters.length === 0 && <p>No characters yet.</p>}

      {characters.map((c) => (
        <CharacterCard
          key={c.id}
          character={c}
          showCampaign
          actions={
            <>
              <button onClick={() => onOpenCharacter(c.id)}>Open sheet</button>
              <button onClick={() => guard(() => charactersApi.deleteCharacter(c.id))}>Delete</button>
              {c.campaignId !== null ? (
                <button onClick={() => guard(() => charactersApi.detachCharacter(c.id))}>
                  Remove from campaign
                </button>
              ) : (
                campaigns.length > 0 && (
                  <>
                    <select
                      value={attachSelections[c.id] ?? ""}
                      onChange={(e) => setAttachSelections((prev) => ({ ...prev, [c.id]: e.target.value }))}
                    >
                      <option value="">Choose campaign…</option>
                      {campaigns.map((camp) => (
                        <option key={camp.id} value={camp.id}>
                          {camp.name}
                        </option>
                      ))}
                    </select>
                    <button
                      disabled={!attachSelections[c.id]}
                      onClick={() =>
                        guard(() => charactersApi.attachCharacter(c.id, Number(attachSelections[c.id])))
                      }
                    >
                      Add to campaign
                    </button>
                  </>
                )
              )}
            </>
          }
        />
      ))}

      <button onClick={onCreateCharacter}>New character</button>
    </div>
  );
}
