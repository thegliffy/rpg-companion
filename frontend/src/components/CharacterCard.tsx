import type { ReactNode } from "react";
import type { Character, SheetField, Dnd5eSheetData, Pf2eSheetData } from "shared";
import { SYSTEMS } from "shared";

function SheetSummary({ character }: { character: Character }) {
  if (character.system === "dnd5e") {
    const s = character.sheetData as Partial<Dnd5eSheetData>;
    return (
      <p>
        {[s.race, s.class && `${s.class} ${s.level ?? 1}`].filter(Boolean).join(" ") || "5e character"}
      </p>
    );
  }
  if (character.system === "pf2e") {
    const s = character.sheetData as Partial<Pf2eSheetData>;
    return (
      <p>
        {[s.ancestry, s.class && `${s.class} ${s.level ?? 1}`].filter(Boolean).join(" ") || "PF2e character"}
      </p>
    );
  }
  const fields = (character.sheetData as SheetField[] | undefined) ?? [];
  return fields.length > 0 ? (
    <ul>
      {fields.slice(0, 4).map((f) => (
        <li key={f.id}>
          <strong>{f.label}:</strong> {f.value}
        </li>
      ))}
    </ul>
  ) : null;
}

export function CharacterCard({
  character,
  showCampaign = false,
  actions,
}: {
  character: Character;
  showCampaign?: boolean;
  actions?: ReactNode;
}) {
  return (
    <div style={{ border: "1px solid #ddd", padding: "1rem", marginBottom: "0.5rem" }}>
      <h3>
        {character.name} <small>({character.ownerUsername})</small>{" "}
        <small style={{ background: "#eee", borderRadius: 4, padding: "0.1rem 0.4rem" }}>
          {SYSTEMS[character.system]?.name ?? character.system}
        </small>
      </h3>
      {showCampaign && (
        <p>
          <em>{character.campaignName ? `In campaign: ${character.campaignName}` : "Not in a campaign"}</em>
        </p>
      )}
      {(character.hpCurrent != null || character.hpMax != null) && (
        <p>
          HP: {character.hpCurrent ?? "?"} / {character.hpMax ?? "?"}
        </p>
      )}
      <SheetSummary character={character} />
      {actions && <div>{actions}</div>}
    </div>
  );
}
