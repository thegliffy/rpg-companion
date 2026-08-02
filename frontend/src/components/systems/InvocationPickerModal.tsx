import type { SrdInvocation } from "shared";
import { SRD_INVOCATIONS, INVOCATION_PREFIX } from "shared";
import { modalOverlay as overlayStyle, modalDialog } from "../../styles";
const dialogStyle = { ...modalDialog, width: "min(560px, 92vw)" };

// Re-exported so existing importers (Dnd5eSheet) keep working while the constant now lives in
// shared as the single source of truth (used by eldritchBlastProfile's invocation lookup).
export { INVOCATION_PREFIX };

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
              style={{ ...rowStyle, opacity: known ? 0.5 : 1, borderBottom: "1px solid var(--border-faint)" }}
              disabled={known}
              onClick={() => onPick(inv)}
            >
              <strong>{inv.name}</strong>{" "}
              <small style={{ color: belowLevel ? "var(--danger)" : "var(--text-dim)" }}>
                (level {inv.prereqLevel}
                {inv.prereqPact ? `, Pact of the ${inv.prereqPact[0].toUpperCase()}${inv.prereqPact.slice(1)}` : ""}
                {inv.prereqSpell ? `, requires ${inv.prereqSpell}` : ""})
              </small>
              {known && <small> — already known</small>}
              <br />
              <small style={{ color: "var(--text-muted)" }}>{inv.description}</small>
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
