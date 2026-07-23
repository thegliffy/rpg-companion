import { useMemo, useState } from "react";
import type { CustomContent, Dnd5eSheetData } from "shared";
import { SRD_SPELLS, DND5E_CLASSES, casterTypeForClass, maxPreparableSpellLevel, customSpellToSrdShape } from "shared";

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

export function SpellPickerModal({
  characterClass,
  characterLevel,
  currentSpells,
  customSpells,
  onToggle,
  onClose,
  cantripsOnly = false,
  maxPicks,
}: {
  characterClass: string;
  characterLevel: number;
  currentSpells: Dnd5eSheetData["spells"];
  customSpells: CustomContent[];
  onToggle: (spell: { id: string; name: string; level: number }, adding: boolean) => void;
  onClose: () => void;
  // Pact of the Tome: restrict to cantrips, from any class's spell list (no per-class filter).
  cantripsOnly?: boolean;
  // Pact of the Tome: caps the Book of Shadows at 3 cantrips -- unchecked boxes past the cap
  // are disabled, already-checked ones stay togglable so removal still works.
  maxPicks?: number;
}) {
  const allSpells = useMemo(
    () => [...SRD_SPELLS, ...customSpells.map(customSpellToSrdShape)],
    [customSpells],
  );
  const customSpellIds = new Set(customSpells.map((c) => `custom-${c.id}`));
  const characterClassIsBuiltIn = DND5E_CLASSES.some((c) => c.name.toLowerCase() === characterClass.trim().toLowerCase());
  const defaultClass =
    DND5E_CLASSES.find((c) => c.name.toLowerCase() === characterClass.trim().toLowerCase())?.name ??
    DND5E_CLASSES[0].name;
  const [selectedClass, setSelectedClass] = useState(defaultClass);
  // A custom/homebrew class has no SRD spell-list association, so default to
  // browsing every spell rather than showing an unrelated built-in class's list.
  const [overrideAllClasses, setOverrideAllClasses] = useState(!characterClassIsBuiltIn || cantripsOnly);

  const casterType = casterTypeForClass(selectedClass);
  const maxLevel = overrideAllClasses || casterType === "none" ? 9 : maxPreparableSpellLevel(selectedClass, characterLevel);

  const eligibleSpells = useMemo(() => {
    const classId = selectedClass.toLowerCase();
    return allSpells.filter((s) => {
      if (cantripsOnly) return s.level === 0;
      const classOk = overrideAllClasses || s.classes.includes(classId);
      const levelOk = s.level === 0 || s.level <= maxLevel;
      return classOk && levelOk;
    });
  }, [allSpells, selectedClass, overrideAllClasses, maxLevel, cantripsOnly]);

  const currentIds = new Set(currentSpells.map((s) => s.srdId).filter(Boolean));
  const atCap = maxPicks !== undefined && currentIds.size >= maxPicks;

  const byLevel = useMemo(() => {
    const groups = new Map<number, typeof eligibleSpells>();
    for (const s of eligibleSpells) {
      if (!groups.has(s.level)) groups.set(s.level, []);
      groups.get(s.level)!.push(s);
    }
    return [...groups.entries()].sort((a, b) => a[0] - b[0]);
  }, [eligibleSpells]);

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h3>{cantripsOnly ? "Add a cantrip (any class's spell list)" : "Add spells"}</h3>
        {maxPicks !== undefined && (
          <p style={{ margin: "0 0 0.5rem" }}>
            <small>
              {currentIds.size} / {maxPicks} chosen
            </small>
          </p>
        )}
        {!cantripsOnly && (
          <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.75rem" }}>
            <label>
              Class{" "}
              <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                {DND5E_CLASSES.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                checked={overrideAllClasses}
                onChange={(e) => setOverrideAllClasses(e.target.checked)}
              />{" "}
              Show all classes' spells
            </label>
          </div>
        )}

        {!cantripsOnly && casterType === "prepared" && (
          <p>
            <small>
              {DND5E_CLASSES.find((c) => c.name === selectedClass)?.name} prepares from its full spell list —
              check any spell to prepare it.
            </small>
          </p>
        )}
        {casterType === "none" && !overrideAllClasses && (
          <p>
            <small>{selectedClass} has no spellcasting by default. Enable "Show all classes' spells" to browse anyway.</small>
          </p>
        )}

        {byLevel.map(([level, spells]) => (
          <div key={level} style={{ marginBottom: "0.75rem" }}>
            <div style={{ fontWeight: "bold", borderBottom: "1px solid #ddd" }}>
              {level === 0 ? "Cantrips" : `Level ${level}`}
            </div>
            {spells.map((s) => (
              <label key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.4rem", padding: "0.15rem 0" }}>
                <input
                  type="checkbox"
                  checked={currentIds.has(s.id)}
                  disabled={atCap && !currentIds.has(s.id)}
                  onChange={(e) => onToggle({ id: s.id, name: s.name, level: s.level }, e.target.checked)}
                />
                <span style={{ flex: 1 }}>
                  {s.name}
                  {customSpellIds.has(s.id) && <small style={{ color: "#a60" }}> (homebrew)</small>}
                </span>
                <small style={{ color: "#777" }}>{s.school}</small>
              </label>
            ))}
          </div>
        ))}
        {byLevel.length === 0 && <p>No spells match this class/level.</p>}

        <button type="button" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
