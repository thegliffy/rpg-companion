import { useEffect, useState } from "react";
import type { Character, Dnd5eSheetData } from "shared";
import * as charactersApi from "../api/characters";
import { CharacterPortrait } from "./CharacterPortrait";

export function HallOfHeroesSection({ onOpenCharacter }: { onOpenCharacter: (id: number) => void }) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    charactersApi
      .listMyCharacters()
      .then((all) =>
        setCharacters(
          all.filter((c) => {
            if (c.system !== "dnd5e") return false;
            const status = (c.sheetData as Partial<Dnd5eSheetData>).status;
            return status === "dead" || status === "retired";
          }),
        ),
      )
      .catch((err) => setError(err.message));
  }, []);

  if (characters.length === 0) return null;

  return (
    <div>
      <h2>Hall of Heroes</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {characters.map((c) => {
          const sheet = c.sheetData as Partial<Dnd5eSheetData>;
          const label = sheet.status === "dead" ? "Died" : "Retired";
          const date = sheet.statusChangedAt ? new Date(sheet.statusChangedAt).toLocaleDateString() : null;
          return (
            <div
              key={c.id}
              onClick={() => onOpenCharacter(c.id)}
              style={{
                border: "1px solid #ddd",
                borderRadius: 6,
                padding: "0.75rem",
                width: "10rem",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <CharacterPortrait characterId={c.id} canEdit={false} size={96} />
              <div style={{ fontWeight: "bold", marginTop: "0.4rem" }}>{c.name}</div>
              <small style={{ color: "#666" }}>
                {label}
                {date ? ` — ${date}` : ""}
              </small>
            </div>
          );
        })}
      </div>
    </div>
  );
}
