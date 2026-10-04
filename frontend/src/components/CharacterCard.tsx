import type { ReactNode } from "react";
import type { Character, SheetField, Dnd5eSheetData, Pf2eSheetData } from "shared";
import { SYSTEMS } from "shared";
import { CharacterPortrait } from "./CharacterPortrait";
import { badge } from "../styles";

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

/** Reference card anatomy: gold eyebrow (race/ancestry), serif name, class line, stat pills. */
function statPills(character: Character): ReactNode {
  const pills: string[] = [];
  if (character.system === "dnd5e") {
    const s = character.sheetData as Partial<Dnd5eSheetData>;
    if (s.level != null) pills.push(`Level ${s.level}`);
  }
  if (character.system === "pf2e") {
    const s = character.sheetData as Partial<Pf2eSheetData>;
    if (s.level != null) pills.push(`Level ${s.level}`);
  }
  if (character.hpMax != null) pills.push(`HP ${character.hpCurrent ?? "?"} / ${character.hpMax}`);
  if (pills.length === 0) return null;
  return (
    <div className="stat-pills">
      {pills.map((p) => (
        <span key={p} className="stat-pill">
          {p}
        </span>
      ))}
    </div>
  );
}

export function CharacterCard({
  character,
  showCampaign = false,
  actions,
  onClick,
}: {
  character: Character;
  showCampaign?: boolean;
  actions?: ReactNode;
  onClick?: () => void;
}) {
  const sheet = character.sheetData as
    | (Partial<Dnd5eSheetData> & Partial<Pf2eSheetData>)
    | undefined;
  const eyebrow =
    (character.system === "dnd5e" && sheet?.race) ||
    (character.system === "pf2e" && sheet?.ancestry) ||
    (SYSTEMS[character.system]?.name ?? character.system);

  const classLine =
    character.system === "dnd5e" && sheet?.class
      ? `${sheet.class} ${sheet.level ?? 1}`
      : character.system === "pf2e" && sheet?.class
        ? `${sheet.class} ${sheet.level ?? 1}`
        : null;

  const body = (
    <>
      <div style={{ display: "flex", gap: "0.85rem", alignItems: "flex-start" }}>
        <CharacterPortrait characterId={character.id} canEdit={false} size={64} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="click-card__eyebrow">{eyebrow}</p>
          <h3
            className="click-card__title"
            style={{ margin: "0.15rem 0 0", display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}
          >
            {character.name}
            <small style={{ fontFamily: "var(--font-body)", fontWeight: "normal", color: "var(--text-muted)" }}>
              ({character.ownerUsername})
            </small>
            <span style={badge}>{SYSTEMS[character.system]?.name ?? character.system}</span>
          </h3>
          {classLine && <p className="click-card__subtitle">{classLine}</p>}
          {showCampaign && (
            <p>
              <em>{character.campaignName ? `In campaign: ${character.campaignName}` : "Not in a campaign"}</em>
            </p>
          )}
          {statPills(character)}
          <SheetSummary character={character} />
        </div>
      </div>
      {actions && (
        <div style={{ marginTop: "0.6rem" }} onClick={(e) => e.stopPropagation()}>
          {actions}
        </div>
      )}
    </>
  );

  if (onClick) {
    return (
      <div
        className="click-card"
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onClick()}
      >
        {body}
      </div>
    );
  }
  return <div className="click-card" style={{ cursor: "default" }}>{body}</div>;
}
