import type { ThemeId } from "shared";
import { THEME_IDS, THEME_LABELS, THEME_DESCRIPTIONS } from "shared";
import { useTheme } from "../theme/ThemeProvider";

// A literal swatch per theme rather than a plain <select>: the whole point is the look, and a
// dropdown of names makes you apply each one to find out what it is. Values are duplicated from
// themes.css deliberately -- a swatch has to render a theme that isn't currently applied, so it
// can't read the live tokens.
const SWATCHES: Record<ThemeId, { bg: string; ink: string; accent: string }> = {
  default: { bg: "#ffffff", ink: "#6b6375", accent: "#aa3bff" },
  ledger: { bg: "#f6f2e8", ink: "#1c1a17", accent: "#8c2f22" },
  vellum: { bg: "#e5d7b8", ink: "#241a10", accent: "#6d3719" },
  graph: { bg: "#fbfaf7", ink: "#2f343a", accent: "#2f5d8a" },
  console: { bg: "#0e1418", ink: "#c6d4dc", accent: "#35e0c8" },
  contrast: { bg: "#ffffff", ink: "#000000", accent: "#0b4fa8" },
};

export function ThemePicker() {
  const { theme, setTheme, saving } = useTheme();

  return (
    <div>
      <h2>Theme</h2>
      <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0 0 0.6rem" }}>
        Applies everywhere and follows your account, so it's the same on every device.
        {saving && " Saving…"}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {THEME_IDS.map((id) => {
          const s = SWATCHES[id];
          const selected = theme === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTheme(id)}
              aria-pressed={selected}
              title={THEME_DESCRIPTIONS[id]}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                padding: "0.35rem 0.6rem",
                borderWidth: selected ? 2 : 1,
                borderStyle: "solid",
                borderColor: selected ? "var(--accent)" : "var(--border)",
                background: "var(--surface-raised)",
                color: "var(--text)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  width: 26,
                  height: 18,
                  background: s.bg,
                  border: "1px solid var(--border-strong)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                }}
              >
                <span style={{ width: 12, height: 2, background: s.ink }} />
                <span style={{ width: 5, height: 5, background: s.accent, marginLeft: 2 }} />
              </span>
              {THEME_LABELS[id]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
