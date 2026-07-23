import { useMemo, useState } from "react";
import { SRD_SPELLS } from "shared";

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
  width: "min(600px, 92vw)",
  maxHeight: "85vh",
  overflowY: "auto",
};

export interface PickedSpell {
  id: string;
  name: string;
  level: number;
}

/** Modal for choosing an exact number of new spells for a class-restricted known list (creation or
 * level-up growth) -- originally Wizard-only (spellbook), generalized with `classId` so the same
 * exact-count picker also drives a Warlock's starting cantrip choice. */
export function WizardSpellbookPicker({
  title,
  requiredCount,
  maxLevel,
  onlyLevel,
  excludeIds,
  classId = "wizard",
  onConfirm,
  onClose,
}: {
  title: string;
  requiredCount: number;
  maxLevel: number;
  onlyLevel?: number;
  excludeIds: string[];
  classId?: string;
  onConfirm: (spells: PickedSpell[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Record<string, PickedSpell>>({});
  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);

  const eligible = useMemo(
    () =>
      SRD_SPELLS.filter((s) => {
        if (!s.classes.includes(classId)) return false;
        if (excludeSet.has(s.id)) return false;
        if (onlyLevel !== undefined) return s.level === onlyLevel;
        return s.level >= 1 && s.level <= maxLevel;
      }),
    [maxLevel, onlyLevel, excludeSet, classId],
  );

  const byLevel = useMemo(() => {
    const groups = new Map<number, typeof eligible>();
    for (const s of eligible) {
      if (!groups.has(s.level)) groups.set(s.level, []);
      groups.get(s.level)!.push(s);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [eligible]);

  const count = Object.keys(selected).length;

  function toggle(s: PickedSpell) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[s.id]) {
        delete next[s.id];
      } else {
        if (Object.keys(next).length >= requiredCount) return prev;
        next[s.id] = s;
      }
      return next;
    });
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        <p>
          {count} / {requiredCount} selected
        </p>
        {byLevel.map(([level, spells]) => (
          <div key={level} style={{ marginBottom: "0.75rem" }}>
            <div style={{ fontWeight: "bold", borderBottom: "1px solid #ddd" }}>{level === 0 ? "Cantrips" : `Level ${level}`}</div>
            {spells.map((s) => (
              <label key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.15rem 0" }}>
                <input
                  type="checkbox"
                  checked={!!selected[s.id]}
                  disabled={!selected[s.id] && count >= requiredCount}
                  onChange={() => toggle({ id: s.id, name: s.name, level: s.level })}
                />
                <span style={{ flex: 1 }}>{s.name}</span>
                <small style={{ color: "#777" }}>{s.school}</small>
              </label>
            ))}
          </div>
        ))}
        {byLevel.length === 0 && <p>No eligible spells.</p>}
        <button type="button" onClick={onClose} style={{ marginRight: "0.5rem" }}>
          Cancel
        </button>
        <button type="button" disabled={count !== requiredCount} onClick={() => onConfirm(Object.values(selected))}>
          Confirm
        </button>
      </div>
    </div>
  );
}
