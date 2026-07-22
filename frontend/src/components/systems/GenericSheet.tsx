import type { Character } from "shared";
import * as charactersApi from "../../api/characters";
import { CharacterSheetForm } from "../CharacterSheetForm";

export function GenericSheet({
  character,
  onSaved,
}: {
  character: Character;
  onSaved: (c: Character) => void;
}) {
  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <h1>
        {character.name} <small>({character.ownerUsername})</small>
      </h1>
      <p>
        <em>Generic sheet{character.campaignName ? ` · ${character.campaignName}` : ""}</em>
      </p>
      <CharacterSheetForm
        initial={character}
        onSubmit={async (input) => {
          const updated = await charactersApi.updateCharacter(character.id, input);
          onSaved(updated);
        }}
      />
    </div>
  );
}
