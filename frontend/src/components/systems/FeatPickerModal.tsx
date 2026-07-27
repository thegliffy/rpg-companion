import type { CustomContent, CustomFeatData, Dnd5eAbility, Dnd5eSheetData, GrantedSpell } from "shared";
import { DND5E_ABILITY_NAMES, effectiveAbilityScore, SRD_FEATS } from "shared";

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
  width: "min(520px, 92vw)",
  maxHeight: "85vh",
  overflowY: "auto",
};

type FeatEntry = Dnd5eSheetData["feats"][number];

const BLANK_BONUSES = {
  abilityBonuses: {},
  acBonus: 0,
  attackBonus: 0,
  damageBonus: 0,
  spellDCBonus: 0,
  spellAttackBonus: 0,
  skillProficiencies: [] as string[],
};

/** Picks a feat (SRD, approved/own-pending custom, or a blank custom) and hands back a sheet
 * FeatEntry plus any spells it grants (SRD feats grant nothing structured -- description only). */
export function FeatPickerModal({
  sheet,
  customFeats,
  onPick,
  onClose,
}: {
  sheet: Dnd5eSheetData;
  customFeats: CustomContent[];
  onPick: (feat: FeatEntry, grantedSpells: GrantedSpell[]) => void;
  onClose: () => void;
}) {
  // Prereqs are a hint, never enforced -- same house rule as InvocationPickerModal /
  // SRD_INVOCATIONS' prereqLevel (srd-invocations.ts): shown in red when unmet, still pickable.
  function prereqLine(d: CustomFeatData): { text: string; unmet: boolean } | null {
    const parts: string[] = [];
    let unmet = false;
    for (const [ability, min] of Object.entries(d.prereqAbility)) {
      parts.push(`${DND5E_ABILITY_NAMES[ability as Dnd5eAbility]} ${min}`);
      if (effectiveAbilityScore(sheet, ability as Dnd5eAbility) < min) unmet = true;
    }
    if (d.prereqLevel > 0) {
      parts.push(`level ${d.prereqLevel}`);
      if (sheet.level < d.prereqLevel) unmet = true;
    }
    if (d.prereqText.trim()) parts.push(d.prereqText.trim());
    if (parts.length === 0) return null;
    return { text: parts.join(", "), unmet };
  }
  function pickSrd(name: string) {
    onPick({ id: `feat-${crypto.randomUUID()}`, name, description: "", ...BLANK_BONUSES }, []);
  }

  function pickCustom(item: CustomContent) {
    const d = item.data as CustomFeatData;
    onPick(
      {
        id: `feat-${crypto.randomUUID()}`,
        name: item.name,
        description: d.description,
        abilityBonuses: d.abilityBonuses,
        acBonus: d.acBonus,
        attackBonus: d.attackBonus,
        damageBonus: d.damageBonus,
        spellDCBonus: d.spellDCBonus,
        spellAttackBonus: d.spellAttackBonus,
        skillProficiencies: d.skillProficiencies,
      },
      d.grantedSpells,
    );
  }

  const rowStyle: React.CSSProperties = { display: "block", width: "100%", textAlign: "left", padding: "0.3rem 0" };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h3>Add a feat</h3>
        <div style={{ fontWeight: "bold", borderBottom: "1px solid #ddd" }}>SRD</div>
        {SRD_FEATS.map((f) => (
          <button key={f.id} type="button" style={rowStyle} onClick={() => pickSrd(f.name)}>
            {f.name}
          </button>
        ))}
        {customFeats.length > 0 && (
          <>
            <div style={{ fontWeight: "bold", borderBottom: "1px solid #ddd", marginTop: "0.5rem" }}>Custom</div>
            {customFeats.map((f) => {
              const prereq = prereqLine(f.data as CustomFeatData);
              return (
                <button key={f.id} type="button" style={rowStyle} onClick={() => pickCustom(f)}>
                  {f.name}
                  {f.status === "pending" ? " (pending)" : ""}
                  {prereq && (
                    <>
                      {" "}
                      <small style={{ color: prereq.unmet ? "crimson" : "#888" }}>({prereq.text})</small>
                    </>
                  )}
                </button>
              );
            })}
          </>
        )}
        <div style={{ marginTop: "0.75rem" }}>
          <button type="button" onClick={() => onPick({ id: `feat-${crypto.randomUUID()}`, name: "", description: "", ...BLANK_BONUSES }, [])}>
            Blank custom feat
          </button>{" "}
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
