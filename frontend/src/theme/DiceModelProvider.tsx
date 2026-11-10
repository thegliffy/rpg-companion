import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { DiceModelId } from "shared";
import { DICE_MODEL_IDS } from "shared";
import { useAuth } from "../context/AuthContext";

const STORAGE_KEY = "rpgc-dice-model";

function isDiceModelId(value: unknown): value is DiceModelId {
  return typeof value === "string" && (DICE_MODEL_IDS as readonly string[]).includes(value);
}

/** Reads the cached model written by the last successful load, mirrored from ThemeProvider --
 * main.tsx applies it to <html> before React mounts so a non-default model doesn't flash
 * Default first. */
export function cachedDiceModel(): DiceModelId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isDiceModelId(stored) ? stored : "default";
  } catch {
    return "default";
  }
}

export function applyDiceModel(model: DiceModelId) {
  // "default" carries no attribute: the base --dice-* tokens live in dice.css and follow the
  // theme, exactly like Default does for themes.
  if (model === "default") document.documentElement.removeAttribute("data-dice-model");
  else document.documentElement.setAttribute("data-dice-model", model);

  try {
    localStorage.setItem(STORAGE_KEY, model);
  } catch {
    // Non-fatal: applies for this session, just won't pre-paint next time.
  }
}

interface DiceModelContextValue {
  diceModel: DiceModelId;
  setDiceModel: (model: DiceModelId) => void;
  saving: boolean;
}

const DiceModelContext = createContext<DiceModelContextValue | undefined>(undefined);

export function DiceModelProvider({ children }: { children: ReactNode }) {
  const { user, setUser } = useAuth();
  const [diceModel, setDiceModelState] = useState<DiceModelId>(cachedDiceModel);
  const [saving, setSaving] = useState(false);

  // The account value is authoritative once the session resolves; the cache only exists to
  // avoid the first-paint flash.
  useEffect(() => {
    if (!user) return;
    const accountModel = user.diceModel ?? "default";
    setDiceModelState(accountModel);
    applyDiceModel(accountModel);
  }, [user]);

  const setDiceModel = useCallback(
    (next: DiceModelId) => {
      setDiceModelState(next);
      applyDiceModel(next);
      setSaving(true);
      fetch("/api/auth/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diceModel: next }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          if (body?.user) setUser(body.user);
        })
        .catch(() => {
          /* keep the local choice; it re-syncs from the account on next load */
        })
        .finally(() => setSaving(false));
    },
    [setUser],
  );

  return <DiceModelContext.Provider value={{ diceModel, setDiceModel, saving }}>{children}</DiceModelContext.Provider>;
}

export function useDiceModel(): DiceModelContextValue {
  const ctx = useContext(DiceModelContext);
  if (!ctx) throw new Error("useDiceModel must be used within a DiceModelProvider");
  return ctx;
}
