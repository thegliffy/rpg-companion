import { useEffect, useState } from "react";
import type { Character, Dnd5eSheetData } from "shared";
import * as charactersApi from "../api/characters";
import { GenericSheet } from "../components/systems/GenericSheet";
import { Dnd5eSheet } from "../components/systems/Dnd5eSheet";
import { Pf2eSheet } from "../components/systems/Pf2eSheet";

export function CharacterSheetPage({
  characterId,
  onBack,
}: {
  characterId: number;
  onBack: () => void;
}) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    charactersApi
      .getCharacter(characterId)
      .then(setCharacter)
      .catch((err) => setError(err.message));
  }

  useEffect(refresh, [characterId]);

  if (error) return <p style={{ color: "crimson", padding: "1rem 2rem" }}>{error}</p>;
  if (!character) return <p style={{ padding: "1rem 2rem" }}>Loading…</p>;

  const readOnly =
    character.system === "dnd5e" &&
    (character.sheetData as Partial<Dnd5eSheetData>).status !== undefined &&
    (character.sheetData as Partial<Dnd5eSheetData>).status !== "active";

  return (
    <div style={{ padding: "0 2rem 2rem" }}>
      <button onClick={onBack}>&larr; Back</button>
      {readOnly && (
        <p style={{ background: "#fff3cd", padding: "0.5rem 1rem", borderRadius: 6 }}>
          This character is retired or deceased — read-only memorial view. Reactivate below to resume editing.
        </p>
      )}
      {character.system === "dnd5e" ? (
        <Dnd5eSheet character={character} onSaved={setCharacter} readOnly={readOnly} />
      ) : character.system === "pf2e" ? (
        <Pf2eSheet character={character} onSaved={setCharacter} />
      ) : (
        <GenericSheet character={character} onSaved={setCharacter} />
      )}
    </div>
  );
}
