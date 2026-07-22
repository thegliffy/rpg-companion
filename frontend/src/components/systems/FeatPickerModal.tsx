import type { CustomContent, CustomFeatData, Dnd5eSheetData } from "shared";
import { SRD_FEATS } from "shared";

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
};

/** Picks a feat (SRD, approved/own-pending custom, or a blank custom) and hands back a sheet FeatEntry. */
export function FeatPickerModal({
  customFeats,
  onPick,
  onClose,
}: {
  customFeats: CustomContent[];
  onPick: (feat: FeatEntry) => void;
  onClose: () => void;
}) {
  function pickSrd(name: string) {
    onPick({ id: `feat-${Date.now()}`, name, description: "", ...BLANK_BONUSES });
  }

  function pickCustom(item: CustomContent) {
    const d = item.data as CustomFeatData;
    onPick({
      id: `feat-${Date.now()}`,
      name: item.name,
      description: d.description,
      abilityBonuses: d.abilityBonuses,
      acBonus: d.acBonus,
      attackBonus: d.attackBonus,
      damageBonus: d.damageBonus,
      spellDCBonus: d.spellDCBonus,
      spellAttackBonus: d.spellAttackBonus,
    });
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
            {customFeats.map((f) => (
              <button key={f.id} type="button" style={rowStyle} onClick={() => pickCustom(f)}>
                {f.name}
                {f.status === "pending" ? " (pending)" : ""}
              </button>
            ))}
          </>
        )}
        <div style={{ marginTop: "0.75rem" }}>
          <button type="button" onClick={() => onPick({ id: `feat-${Date.now()}`, name: "", description: "", ...BLANK_BONUSES })}>
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
