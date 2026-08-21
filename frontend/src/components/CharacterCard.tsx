import type { ReactNode } from "react";
import type { Character, SheetField, Dnd5eSheetData, Pf2eSheetData } from "shared";
import { SYSTEMS } from "shared";
import { CharacterPortrait } from "./CharacterPortrait";
import { card, badge } from "../styles";

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
    <div style={{ ...card, display: "flex", gap: "0.85rem", alignItems: "flex-start", marginBottom: "0.5rem" }}>
      <CharacterPortrait characterId={character.id} canEdit={false} size={64} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <h3 style={{ fontFamily: "var(--font-display)", display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          {character.name}
          <small style={{ fontFamily: "var(--font-body)", fontWeight: "normal" }}>({character.ownerUsername})</small>
          <span style={badge}>{SYSTEMS[character.system]?.name ?? character.system}</span>
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
    </div>
  );
}
