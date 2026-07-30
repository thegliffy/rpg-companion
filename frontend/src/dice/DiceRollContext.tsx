import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import type { DiceRoll } from "shared";
import * as diceApi from "../api/dice";
import { DiceRollModal } from "./DiceRollModal";

export interface RollGroupResult {
  id: string;
  label: string;
  roll: DiceRoll;
}

interface SessionState {
  id: string;
  title: string;
  groups: RollGroupResult[];
  // Set by a caller mid-session (#140) to render interactive content inside the modal -- e.g.
  // AttackRollControl's Hit/Miss buttons, which need to appear after the attack roll lands and
  // before damage is rolled.
  actions: ReactNode | null;
}

type ScopedRoll = (formula: string, label?: string) => Promise<DiceRoll>;

interface DiceRollContextValue {
  // Same signature and resolved value as diceApi.createRoll (#136/#138) -- every one of the app's
  // 18 call sites keeps working as a drop-in replacement. Opens (or replaces) a one-roll session.
  roll: (campaignId: number | null, formula: string, label?: string) => Promise<DiceRoll>;
  // Opens (or replaces) a session titled `title`. Every roll made through the scoped `roll`
  // function passed into `fn` joins the same modal as one more die group, instead of each roll
  // popping its own dialog (#138) -- what makes "every roll, everywhere" viable rather than
  // punishing for the wizard's six ability rolls, Eldritch Blast's beams, Arena's initiative pair.
  session: <T>(campaignId: number | null, title: string, fn: (roll: ScopedRoll) => Promise<T>) => Promise<T>;
  // Lets the code currently inside a session's `fn` (or a handler it kicked off, e.g. a Hit
  // button click) swap what's rendered in the modal's action slot. Ignored once a later
  // roll()/session() call has replaced the session it belonged to.
  setSessionActions: (node: ReactNode | null) => void;
}

const DiceRollContext = createContext<DiceRollContextValue | undefined>(undefined);

export function DiceRollProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState | null>(null);
  // The session id "owns" its slice of state; a scoped-roll or setSessionActions call from a
  // session that's since been replaced (e.g. the user started a different roll before clicking
  // this one's Hit/Miss) is a no-op instead of corrupting whatever the new session is showing.
  const activeIdRef = useRef<string | null>(null);

  const session = useCallback(async function session<T>(
    campaignId: number | null,
    title: string,
    fn: (roll: ScopedRoll) => Promise<T>,
  ): Promise<T> {
    const id = crypto.randomUUID();
    activeIdRef.current = id;
    setState({ id, title, groups: [], actions: null });

    const scopedRoll: ScopedRoll = async (formula, label) => {
      const result = await diceApi.createRoll(campaignId, formula, label);
      setState((prev) =>
        prev && prev.id === id
          ? { ...prev, groups: [...prev.groups, { id: crypto.randomUUID(), label: label ?? "Roll", roll: result }] }
          : prev,
      );
      return result;
    };

    return fn(scopedRoll);
  }, []);

  const roll = useCallback(
    (campaignId: number | null, formula: string, label?: string) =>
      session(campaignId, label ?? "Roll", (scopedRoll) => scopedRoll(formula, label)),
    [session],
  );

  const setSessionActions = useCallback((node: ReactNode | null) => {
    const id = activeIdRef.current;
    setState((prev) => (prev && prev.id === id ? { ...prev, actions: node } : prev));
  }, []);

  function close() {
    activeIdRef.current = null;
    setState(null);
  }

  return (
    <DiceRollContext.Provider value={{ roll, session, setSessionActions }}>
      {children}
      {state && (
        <DiceRollModal
          title={state.title}
          groups={state.groups}
          actions={state.actions}
          onClose={close}
          onReroll={(group) => {
            const id = state.id;
            diceApi.createRoll(group.roll.campaignId, group.roll.formula, group.roll.label ?? undefined).then((result) => {
              setState((prev) =>
                prev && prev.id === id
                  ? { ...prev, groups: prev.groups.map((g) => (g.id === group.id ? { ...g, roll: result } : g)) }
                  : prev,
              );
            });
          }}
        />
      )}
    </DiceRollContext.Provider>
  );
}

export function useDiceRoll(): DiceRollContextValue {
  const ctx = useContext(DiceRollContext);
  if (!ctx) throw new Error("useDiceRoll must be used within a DiceRollProvider");
  return ctx;
}
