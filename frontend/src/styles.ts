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

/** A nested, tinted card -- e.g. one item inside a card-based list. Under every theme but Folio
 * this reads as a subtle recessed panel; Folio is the only one that gives it real visual weight. */
export const card: CSSProperties = {
  background: "var(--surface-sunken)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: "0.75rem",
};

/** An elevated container (e.g. a sidebar rail holding several `card`s). `--shadow-card` is `none`
 * on every theme except Folio, so this is a no-op visual upgrade everywhere else. */
export const cardRaised: CSSProperties = {
  background: "var(--surface-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-card)",
  padding: "1rem",
};

/** Small rounded status pill -- e.g. "Not prepared", a condition tag. */
export const badge: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "0.1rem 0.5rem",
  borderRadius: "999px",
  border: "1px solid var(--border)",
  fontSize: "0.75rem",
  fontWeight: 600,
  color: "var(--text-muted)",
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
