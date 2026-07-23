import { useMemo, useState } from "react";
import type { Dnd5eSheetData } from "shared";
import { SRD_SPELLS, maxPreparableSpellLevel, maxPreparedSpells, usesSpellbook, normalizeClassId } from "shared";

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

interface Candidate {
  id: string;
  srdId?: string;
  name: string;
  level: number;
}

/** After a long rest: choose which spells a prepared caster has ready for the day. */
export function PrepareSpellsModal({
  sheet,
  onConfirm,
  onClose,
}: {
  sheet: Dnd5eSheetData;
  onConfirm: (spells: Dnd5eSheetData["spells"]) => void;
  onClose: () => void;
}) {
  const cap = maxPreparedSpells(sheet);
  const isSpellbookCaster = usesSpellbook(sheet.class);
  const classId = normalizeClassId(sheet.class);
  const maxLevel = maxPreparableSpellLevel(sheet.class, sheet.level);

  // Spellbook casters (Wizard) are keyed by the spellbook entry's own id (each spell
  // appears once, permanently); divine casters are keyed by the SRD spell id, since
  // their candidate list is the full class list, not a personal set of entries.
  function keyFor(c: Candidate): string {
    return isSpellbookCaster ? c.id : (c.srdId ?? c.id);
  }

  const candidates: Candidate[] = useMemo(() => {
    if (isSpellbookCaster) {
      return sheet.spells.filter((s) => s.level >= 1).map((s) => ({ id: s.id, srdId: s.srdId, name: s.name, level: s.level }));
    }
    return SRD_SPELLS.filter((s) => s.level >= 1 && s.level <= maxLevel && s.classes.includes(classId)).map((s) => ({
      id: s.id,
      srdId: s.id,
      name: s.name,
      level: s.level,
    }));
  }, [isSpellbookCaster, sheet.spells, classId, maxLevel]);

  const alreadyPrepared = new Set(
    sheet.spells.filter((s) => s.level >= 1 && s.prepared).map((s) => (isSpellbookCaster ? s.id : (s.srdId ?? s.id))),
  );
  const [selected, setSelected] = useState<Set<string>>(alreadyPrepared);

  const byLevel = useMemo(() => {
    const groups = new Map<number, Candidate[]>();
    for (const c of candidates) {
      if (!groups.has(c.level)) groups.set(c.level, []);
      groups.get(c.level)!.push(c);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [candidates]);

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (next.size >= cap) return prev;
        next.add(key);
      }
      return next;
    });
  }

  function confirm() {
    const cantrips = sheet.spells.filter((s) => s.level === 0);
    if (isSpellbookCaster) {
      // Spellbook casters keep every spellbook entry -- only the prepared flag changes.
      const rest = sheet.spells
        .filter((s) => s.level >= 1)
        .map((s) => ({ ...s, prepared: selected.has(s.id) }));
      onConfirm([...cantrips, ...rest]);
    } else {
      // Divine casters re-derive their day's preparation list from the full class list.
      const chosen = candidates.filter((c) => selected.has(keyFor(c)));
      const rest = chosen.map((c, i) => ({
        id: `spell-${Date.now()}-${i}`,
        srdId: c.srdId,
        name: c.name,
        level: c.level,
        prepared: true,
        atWill: false,
      }));
      onConfirm([...cantrips, ...rest]);
    }
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h3>Prepare spells</h3>
        <p>
          <small>
            {isSpellbookCaster
              ? "Choose which spellbook spells are prepared today."
              : `${sheet.class} prepares from its full spell list.`}
          </small>
        </p>
        <p>
          {selected.size} / {cap} prepared
        </p>
        {byLevel.map(([level, spells]) => (
          <div key={level} style={{ marginBottom: "0.75rem" }}>
            <div style={{ fontWeight: "bold", borderBottom: "1px solid #ddd" }}>Level {level}</div>
            {spells.map((c) => {
              const key = keyFor(c);
              return (
                <label key={c.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.15rem 0" }}>
                  <input
                    type="checkbox"
                    checked={selected.has(key)}
                    disabled={!selected.has(key) && selected.size >= cap}
                    onChange={() => toggle(key)}
                  />
                  <span>{c.name}</span>
                </label>
              );
            })}
          </div>
        ))}
        {byLevel.length === 0 && <p>No eligible spells.</p>}
        <button type="button" onClick={onClose} style={{ marginRight: "0.5rem" }}>
          Cancel
        </button>
        <button type="button" onClick={confirm}>
          Confirm
        </button>
      </div>
    </div>
  );
}
