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
}: {
  characterClass: string;
  characterLevel: number;
  currentSpells: Dnd5eSheetData["spells"];
  customSpells: CustomContent[];
  onToggle: (spell: { id: string; name: string; level: number }, adding: boolean) => void;
  onClose: () => void;
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
  const [overrideAllClasses, setOverrideAllClasses] = useState(!characterClassIsBuiltIn);

  const casterType = casterTypeForClass(selectedClass);
  const maxLevel = overrideAllClasses || casterType === "none" ? 9 : maxPreparableSpellLevel(selectedClass, characterLevel);

  const eligibleSpells = useMemo(() => {
    const classId = selectedClass.toLowerCase();
    return allSpells.filter((s) => {
      const classOk = overrideAllClasses || s.classes.includes(classId);
      const levelOk = s.level === 0 || s.level <= maxLevel;
      return classOk && levelOk;
    });
  }, [allSpells, selectedClass, overrideAllClasses, maxLevel]);

  const currentIds = new Set(currentSpells.map((s) => s.srdId).filter(Boolean));

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
        <h3>Add spells</h3>
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

        {casterType === "prepared" && (
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
