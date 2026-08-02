import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { ThemeId } from "shared";
import { THEME_IDS } from "shared";
import { useAuth } from "../context/AuthContext";

const STORAGE_KEY = "rpgc-theme";

function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

/** Reads the cached theme written by the last successful load. Exported so main.tsx can apply it
 * to <html> *before* React mounts -- without that, every page load paints Default first and then
 * snaps to the real theme once the session request resolves. */
export function cachedTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isThemeId(stored) ? stored : "default";
  } catch {
    // Private mode / storage disabled -- fall back to default rather than failing to boot.
    return "default";
  }
}

export function applyTheme(theme: ThemeId) {
  // "default" is the :root definition in index.css, so it carries no attribute at all rather than
  // a data-theme="default" block that would have to duplicate every token.
  if (theme === "default") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Non-fatal: the theme still applies for this session, it just won't pre-paint next time.
  }
}

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  saving: boolean;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth();
  const [theme, setThemeState] = useState<ThemeId>(cachedTheme);
  const [saving, setSaving] = useState(false);

  // The account value is authoritative and overwrites the local cache once the session resolves --
  // the cache exists only to avoid the first-paint flash, never to win a disagreement.
  useEffect(() => {
    if (!user) return;
    const accountTheme = user.theme ?? "default";
    setThemeState(accountTheme);
    applyTheme(accountTheme);
  }, [user]);

  const setTheme = useCallback(
    (next: ThemeId) => {
      // Applied immediately so the picker feels instant; the PATCH is what makes it persist, and a
      // failure there leaves the theme visibly applied but unsaved rather than silently reverting.
      setThemeState(next);
      applyTheme(next);
      setSaving(true);
      fetch("/api/auth/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: next }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          if (body?.user) setUser(body.user);
        })
        .catch(() => {
          /* keep the local choice; it will re-sync from the account on next load */
        })
        .finally(() => setSaving(false));
    },
    [setUser],
  );

  return <ThemeContext.Provider value={{ theme, setTheme, saving }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
