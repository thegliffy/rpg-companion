import type { RollMode } from "shared";

const MODES: { value: RollMode; label: string; title: string }[] = [
  { value: "normal", label: "—", title: "Normal: roll one d20" },
  { value: "advantage", label: "ADV", title: "Advantage: roll two d20s and keep the higher" },
  { value: "disadvantage", label: "DIS", title: "Disadvantage: roll two d20s and keep the lower" },
];

/** Compact three-way advantage selector (#176). Shared by every d20 surface so the control looks
 * and behaves identically whether you're rolling an attack, a save, or a skill check. */
export function RollModeSelect({ value, onChange, label }: { value: RollMode; onChange: (mode: RollMode) => void; label?: string }) {
  return (
    <span style={{ display: "inline-flex", gap: "0.15rem", alignItems: "center" }}>
      {label && <small style={{ color: "var(--text-muted)", marginRight: "0.15rem" }}>{label}</small>}
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          title={m.title}
          aria-pressed={value === m.value}
          onClick={() => onChange(m.value)}
          style={{
            padding: "0 0.3rem",
            fontSize: "0.7rem",
            fontWeight: value === m.value ? 700 : 400,
            // The selected mode is the only one with a filled background, so the current state
            // reads at a glance without needing colour alone to carry it.
            background: value === m.value ? "var(--border-subtle)" : "transparent",
          }}
        >
          {m.label}
        </button>
      ))}
    </span>
  );
}
