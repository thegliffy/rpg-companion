import type { CSSProperties } from "react";

/* Shared style objects (#151).
 *
 * These were copy-pasted before this existed -- `box` was duplicated across 7 files (5 of them
 * byte-identical) and the modal overlay/dialog pair across 6 more. Consolidating them is worth
 * doing on its own merits, and it's what makes theming tractable: every value below resolves
 * through a token, so a theme changes all of them at once.
 *
 * Inline styles beat stylesheets on specificity, so a theme can't override a literal written into
 * a style object -- the tokens have to be substituted in here rather than layered on top. */

/** The standard bordered panel used for nearly every section on every page. */
export const panel: CSSProperties = {
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius)",
  padding: "0.75rem",
};

/** Same panel with the roomier padding the creation wizard and a few forms use. */
export const panelRoomy: CSSProperties = {
  border: "1px solid var(--border-strong)",
  borderRadius: "var(--radius)",
  padding: "1rem",
};

export const panelSpaced: CSSProperties = {
  ...panel,
  marginBottom: "1rem",
};

export const modalOverlay: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "var(--overlay)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

export const modalDialog: CSSProperties = {
  background: "var(--surface-raised)",
  color: "var(--text)",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  padding: "1rem",
  width: "min(520px, 92vw)",
  maxHeight: "85vh",
  overflowY: "auto",
};

/** Narrow numeric input, repeated across the 5e/PF2e sheets. */
export const numInput: CSSProperties = { width: "3.5rem", textAlign: "center" };

/** Muted helper/caption text. */
export const muted: CSSProperties = { color: "var(--text-muted)" };

/** Error text. `crimson` was the de-facto error token across 27 files before this. */
export const errorText: CSSProperties = { color: "var(--danger)" };
