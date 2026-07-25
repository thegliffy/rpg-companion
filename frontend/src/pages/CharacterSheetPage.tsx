import { lazy, Suspense, useEffect, useState } from "react";
import type { Character, Dnd5eSheetData } from "shared";
import * as charactersApi from "../api/characters";
import { useAuth } from "../context/AuthContext";

const Dnd5eSheet = lazy(() =>
  import("../components/systems/Dnd5eSheet").then((m) => ({ default: m.Dnd5eSheet })),
);
const TraditionalDnd5eSheet = lazy(() =>
  import("../components/systems/TraditionalDnd5eSheet").then((m) => ({ default: m.TraditionalDnd5eSheet })),
);
const Pf2eSheet = lazy(() =>
  import("../components/systems/Pf2eSheet").then((m) => ({ default: m.Pf2eSheet })),
);
const GenericSheet = lazy(() =>
  import("../components/systems/GenericSheet").then((m) => ({ default: m.GenericSheet })),
);

type Dnd5eViewMode = "edit" | "sheet";

const VIEW_MODE_KEY = "rpg-companion:dnd5e-view-mode";

function loadViewMode(): Dnd5eViewMode {
  try {
    const stored = sessionStorage.getItem(VIEW_MODE_KEY);
    return stored === "sheet" ? "sheet" : "edit";
  } catch {
    return "edit";
  }
}

export function CharacterSheetPage({
  characterId,
  onBack,
}: {
  characterId: number;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const [character, setCharacter] = useState<Character | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<Dnd5eViewMode>(loadViewMode);

  function refresh() {
    charactersApi
      .getCharacter(characterId)
      .then(setCharacter)
      .catch((err) => setError(err.message));
  }

  useEffect(refresh, [characterId]);

  function chooseMode(mode: Dnd5eViewMode) {
    setViewMode(mode);
    try {
      sessionStorage.setItem(VIEW_MODE_KEY, mode);
    } catch {
      // ignore quota / private mode
    }
  }

  if (error) return <p style={{ color: "crimson", padding: "1rem 2rem" }}>{error}</p>;
  if (!character) return <p style={{ padding: "1rem 2rem" }}>Loading…</p>;

  const readOnly =
    character.system === "dnd5e" &&
    (character.sheetData as Partial<Dnd5eSheetData>).status !== undefined &&
    (character.sheetData as Partial<Dnd5eSheetData>).status !== "active";

  const isDnd5e = character.system === "dnd5e";
  const showPrivateNotes = user?.id === character.ownerUserId || user?.role === "admin";

  return (
    <div style={{ padding: "0 2rem 2rem" }}>
      <div
        className="no-print"
        style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.75rem" }}
      >
        <button type="button" onClick={onBack}>
          &larr; Back
        </button>
        {isDnd5e && (
          <span style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => chooseMode("edit")}
              disabled={viewMode === "edit"}
              style={{ fontWeight: viewMode === "edit" ? 700 : 400 }}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => chooseMode("sheet")}
              disabled={viewMode === "sheet"}
              style={{ fontWeight: viewMode === "sheet" ? 700 : 400 }}
            >
              Sheet
            </button>
          </span>
        )}
      </div>
      {readOnly && viewMode === "edit" && (
        <p className="no-print" style={{ background: "#fff3cd", padding: "0.5rem 1rem", borderRadius: 6 }}>
          This character is retired or deceased — read-only memorial view. Reactivate below to resume editing.
        </p>
      )}
      <Suspense fallback={<p>Loading sheet…</p>}>
        {isDnd5e ? (
          viewMode === "sheet" ? (
            <TraditionalDnd5eSheet character={character} showPrivateNotes={!!showPrivateNotes} />
          ) : (
            <Dnd5eSheet character={character} onSaved={setCharacter} readOnly={readOnly} />
          )
        ) : character.system === "pf2e" ? (
          <Pf2eSheet character={character} onSaved={setCharacter} />
        ) : (
          <GenericSheet character={character} onSaved={setCharacter} />
        )}
      </Suspense>
    </div>
  );
}
