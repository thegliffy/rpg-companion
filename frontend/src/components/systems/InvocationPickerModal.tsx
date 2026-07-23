import type { SrdInvocation } from "shared";
import { SRD_INVOCATIONS, INVOCATION_PREFIX } from "shared";

// Re-exported so existing importers (Dnd5eSheet) keep working while the constant now lives in
// shared as the single source of truth (used by eldritchBlastProfile's invocation lookup).
export { INVOCATION_PREFIX };

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

/** Picks an Eldritch Invocation (SRD-only) and hands back the full invocation (including its
 * `grants` payload) for the caller to apply -- see Dnd5eSheet's addInvocation. */
export function InvocationPickerModal({
  level,
  alreadyKnownIds,
  onPick,
  onClose,
}: {
  level: number;
  alreadyKnownIds: Set<string>;
  onPick: (invocation: SrdInvocation) => void;
  onClose: () => void;
}) {
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
              onClick={() => onPick(inv)}
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
