import { useEffect, useState } from "react";
import type { Character, CampaignRole } from "shared";
import { characterIsActive } from "shared";
import * as charactersApi from "../api/characters";
import { CharacterCard } from "./CharacterCard";

export function CharactersSection({
  campaignId,
  currentUserId,
  role,
  onOpenCharacter,
  onCreateCharacter,
}: {
  campaignId: number;
  currentUserId: number;
  role: CampaignRole;
  onOpenCharacter: (id: number) => void;
  onCreateCharacter: () => void;
}) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [myUnattached, setMyUnattached] = useState<Character[]>([]);
  const [attachSelection, setAttachSelection] = useState("");
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    charactersApi
      .listCampaignCharacters(campaignId)
      .then((all) => setCharacters(all.filter(characterIsActive)))
      .catch((err) => setError(err.message));
    charactersApi
      .listMyCharacters()
      .then((mine) => setMyUnattached(mine.filter((c) => c.campaignId === null && characterIsActive(c))))
      .catch(() => setMyUnattached([]));
  }

  useEffect(refresh, [campaignId]);

  function canEdit(character: Character) {
    return role === "dm" || character.ownerUserId === currentUserId;
  }

  async function guard(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      setAttachSelection("");
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  }

  return (
    <div>
      <h2>Characters</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {characters.map((c) => (
        <CharacterCard
          key={c.id}
          character={c}
          actions={
            canEdit(c) && (
              <>
                <button onClick={() => onOpenCharacter(c.id)}>Open sheet</button>
                <button onClick={() => guard(() => charactersApi.detachCharacter(c.id))}>
                  Remove from campaign
                </button>
              </>
            )
          }
        />
      ))}

      {myUnattached.length > 0 && (
        <p>
          <select value={attachSelection} onChange={(e) => setAttachSelection(e.target.value)}>
            <option value="">Bring in one of my characters…</option>
            {myUnattached.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>{" "}
          <button
            disabled={!attachSelection}
            onClick={() => guard(() => charactersApi.attachCharacter(Number(attachSelection), campaignId))}
          >
            Add to campaign
          </button>
        </p>
      )}

      <button onClick={onCreateCharacter}>New character in this campaign</button>
    </div>
  );
}
