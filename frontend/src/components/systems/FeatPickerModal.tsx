import { useState } from "react";
import type { CustomContent, CustomFeatData, Dnd5eAbility, Dnd5eSheetData, GrantedSpell, SpellChoice } from "shared";
import { DND5E_ABILITY_NAMES, effectiveAbilityScore, SRD_FEATS } from "shared";
import { WizardSpellbookPicker, type PickedSpell } from "./WizardSpellbookPicker";
import { modalOverlay as overlayStyle, modalDialog } from "../../styles";
const dialogStyle = modalDialog;

type FeatEntry = Dnd5eSheetData["feats"][number];

const BLANK_BONUSES = {
  abilityBonuses: {},
  acBonus: 0,
  attackBonus: 0,
  damageBonus: 0,
  spellDCBonus: 0,
  spellAttackBonus: 0,
  saveBonus: 0,
  skillProficiencies: [] as string[],
};

// Pending resolution of a custom feat's spellChoices rows -- one WizardSpellbookPicker per row,
// chained in sequence. `collected` accumulates each row's picks (already converted to
// GrantedSpell, tagged with that row's atWill) across rows; once stepIndex reaches
// choices.length, the fixed grantedSpells + collected are combined into a single onPick call.
interface Resolving {
  feat: FeatEntry;
  fixedSpells: GrantedSpell[];
  choices: SpellChoice[];
  stepIndex: number;
  collected: GrantedSpell[];
}

/** Picks a feat (SRD, approved/own-pending custom, or a blank custom) and hands back a sheet
 * FeatEntry plus any spells it grants (SRD feats grant nothing structured -- description only).
 * A custom feat with spellChoices rows (e.g. Magic Initiate) resolves each row via
 * WizardSpellbookPicker before handing the feat + combined spells back in one onPick call. */
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
  const [resolving, setResolving] = useState<Resolving | null>(null);

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
    const feat: FeatEntry = {
      id: `feat-${crypto.randomUUID()}`,
      name: item.name,
      description: d.description,
      abilityBonuses: d.abilityBonuses,
      acBonus: d.acBonus,
      attackBonus: d.attackBonus,
      damageBonus: d.damageBonus,
      spellDCBonus: d.spellDCBonus,
      spellAttackBonus: d.spellAttackBonus,
      saveBonus: d.saveBonus,
      skillProficiencies: d.skillProficiencies,
    };
    if (d.spellChoices.length === 0) {
      onPick(feat, d.grantedSpells);
      return;
    }
    setResolving({ feat, fixedSpells: d.grantedSpells, choices: d.spellChoices, stepIndex: 0, collected: [] });
  }

  function resolveStep(spells: PickedSpell[]) {
    if (!resolving) return;
    const choice = resolving.choices[resolving.stepIndex];
    const converted: GrantedSpell[] = spells.map((s) => ({ name: s.name, srdId: s.id, level: s.level, atWill: choice.atWill }));
    const nextCollected = [...resolving.collected, ...converted];
    const nextIndex = resolving.stepIndex + 1;
    if (nextIndex >= resolving.choices.length) {
      onPick(resolving.feat, [...resolving.fixedSpells, ...nextCollected]);
      setResolving(null);
      return;
    }
    setResolving({ ...resolving, stepIndex: nextIndex, collected: nextCollected });
  }

  if (resolving) {
    const choice = resolving.choices[resolving.stepIndex];
    const levelLabel = choice.maxLevel === 0 ? "cantrip" : `level-${choice.maxLevel}`;
    return (
      <WizardSpellbookPicker
        key={resolving.stepIndex}
        title={`${resolving.feat.name}: choose ${choice.count} ${levelLabel} spell${choice.count === 1 ? "" : "s"}`}
        requiredCount={choice.count}
        maxLevel={choice.maxLevel}
        onlyLevel={choice.maxLevel}
        excludeIds={[
          ...sheet.spells.map((s) => s.srdId).filter((id): id is string => id !== undefined),
          ...resolving.collected.map((s) => s.srdId).filter((id): id is string => id !== undefined),
        ]}
        classId={choice.from.kind === "class" ? choice.from.classId : undefined}
        anyClass={choice.from.kind === "any"}
        srdIds={choice.from.kind === "list" ? choice.from.srdIds : undefined}
        onConfirm={resolveStep}
        onClose={onClose}
      />
    );
  }

  const rowStyle: React.CSSProperties = { display: "block", width: "100%", textAlign: "left", padding: "0.3rem 0" };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h3>Add a feat</h3>
        <div style={{ fontWeight: "bold", borderBottom: "1px solid var(--border-subtle)" }}>SRD</div>
        {SRD_FEATS.map((f) => (
          <button key={f.id} type="button" style={rowStyle} onClick={() => pickSrd(f.name)}>
            {f.name}
          </button>
        ))}
        {customFeats.length > 0 && (
          <>
            <div style={{ fontWeight: "bold", borderBottom: "1px solid var(--border-subtle)", marginTop: "0.5rem" }}>Custom</div>
            {customFeats.map((f) => {
              const prereq = prereqLine(f.data as CustomFeatData);
              return (
                <button key={f.id} type="button" style={rowStyle} onClick={() => pickCustom(f)}>
                  {f.name}
                  {f.status === "pending" ? " (pending)" : ""}
                  {prereq && (
                    <>
                      {" "}
                      <small style={{ color: prereq.unmet ? "var(--danger)" : "var(--text-dim)" }}>({prereq.text})</small>
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
