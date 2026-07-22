import type { Dnd5eSheetData } from "shared";
import { SRD_INVOCATIONS } from "shared";

const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const dialogStyle: React.CSSProperties = {
  background: "white",
  color: "black",
  borderRadius: 8,
  padding: "1rem",
  width: "min(560px, 92vw)",
  maxHeight: "85vh",
  overflowY: "auto",
};

type FeatureEntry = Dnd5eSheetData["features"][number];

export const INVOCATION_PREFIX = "Invocation: ";

/** Picks an Eldritch Invocation (SRD-only) and hands back a blank-bonus sheet feature entry. */
export function InvocationPickerModal({
  level,
  alreadyKnownIds,
  onPick,
  onClose,
}: {
  level: number;
  alreadyKnownIds: Set<string>;
  onPick: (feature: FeatureEntry) => void;
  onClose: () => void;
}) {
  function pick(inv: (typeof SRD_INVOCATIONS)[number]) {
    onPick({
      id: `invocation-${Date.now()}`,
      name: `${INVOCATION_PREFIX}${inv.name}`,
      description: inv.description,
      abilityBonuses: {},
      acBonus: 0,
      attackBonus: 0,
      damageBonus: 0,
      spellDCBonus: 0,
      spellAttackBonus: 0,
    });
  }

  const rowStyle: React.CSSProperties = { display: "block", width: "100%", textAlign: "left", padding: "0.4rem 0" };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h3>Add an Eldritch Invocation</h3>
        {SRD_INVOCATIONS.map((inv) => {
          const known = alreadyKnownIds.has(inv.id);
          const belowLevel = level < inv.prereqLevel;
          return (
            <button
              key={inv.id}
              type="button"
              style={{ ...rowStyle, opacity: known ? 0.5 : 1, borderBottom: "1px solid #eee" }}
              disabled={known}
              onClick={() => pick(inv)}
            >
              <strong>{inv.name}</strong>{" "}
              <small style={{ color: belowLevel ? "crimson" : "#888" }}>
                (level {inv.prereqLevel}
                {inv.prereqPact ? `, Pact of the ${inv.prereqPact[0].toUpperCase()}${inv.prereqPact.slice(1)}` : ""}
                {inv.prereqSpell ? `, requires ${inv.prereqSpell}` : ""})
              </small>
              {known && <small> — already known</small>}
              <br />
              <small style={{ color: "#555" }}>{inv.description}</small>
            </button>
          );
        })}
        <div style={{ marginTop: "0.75rem" }}>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
