import { useEffect, useRef, useState } from "react";
import type {
  Character,
  Dnd5eSheetData,
  Dnd5eAbility,
  Dnd5eCondition,
  CustomRaceData,
  CustomClassData,
  CustomSubraceData,
  CustomSubclassData,
  CustomItemData,
} from "shared";
import {
  dnd5eSheetSchema,
  DND5E_ABILITIES,
  DND5E_ABILITY_NAMES,
  DND5E_SKILLS,
  DND5E_CONDITIONS,
  DND5E_CONDITION_LABELS,
  DND5E_ALIGNMENTS,
  DND5E_CLASSES,
  SRD_RACES,
  SRD_SUBRACES,
  SRD_SUBCLASSES,
  SRD_SPELLS,
  SRD_MAGIC_ITEMS,
  SRD_WEAPONS,
  SRD_ARMOR,
  SRD_GEAR,
  findSrdWeapon,
  findSrdArmor,
  findSrdGear,
  weaponDamageText,
  armorACFormulaText,
  srdArmorToInventoryArmor,
  customItemArmorPayload,
  acBreakdownText,
  hasArmorStealthDisadvantage,
  armorOverlapWarning,
  casterTypeForClass,
  expectedSpellsKnown,
  expectedCantripsKnown,
  expectedSlots,
  classLevelEntry,
  classHitDie,
  customClassLevelEntry,
  martialFeatureLines,
  abilityModifier,
  effectiveAbilityScore,
  equippedAbilityBonus,
  effectiveAC,
  proficiencyBonus,
  saveBonus,
  skillBonus,
  passiveScore,
  spellSaveDC,
  spellAttackBonus,
  spellSaveDCForAbility,
  spellAttackBonusForAbility,
  totalInventoryWeight,
  formatModifier,
  attackBonus,
  featBonusTotal,
  normalizeClassId,
  maxPreparableSpellLevel,
  maxPreparedSpells,
  computeHpMax,
  expectedInvocationsKnown,
  unlockedArcanumTiers,
  SRD_INVOCATIONS,
  customSpellToSrdShape,
  customItemNotesText,
} from "shared";
import * as charactersApi from "../../api/characters";
import * as diceApi from "../../api/dice";
import { useAuth } from "../../context/AuthContext";
import { useCustomContent } from "../../hooks/useCustomContent";
import { CharacterPortrait } from "../CharacterPortrait";
import { DiceRoller } from "../DiceRoller";
import { SpellCastControl } from "./SpellCastControl";
import { AttackRollControl } from "./AttackRollControl";
import { SpellPickerModal } from "./SpellPickerModal";
import { WizardSpellbookPicker } from "./WizardSpellbookPicker";
import { PrepareSpellsModal } from "./PrepareSpellsModal";
import { FeatPickerModal } from "./FeatPickerModal";
import { WildShapePanel } from "./WildShapePanel";
import { InvocationPickerModal, INVOCATION_PREFIX } from "./InvocationPickerModal";

const box: React.CSSProperties = { border: "1px solid #bbb", borderRadius: 6, padding: "0.75rem" };
const numInput: React.CSSProperties = { width: "3.5rem", textAlign: "center" };

export function Dnd5eSheet({
  character,
  onSaved,
  readOnly = false,
}: {
  character: Character;
  onSaved: (c: Character) => void;
  readOnly?: boolean;
}) {
  const { user } = useAuth();
  const isOwner = user?.id === character.ownerUserId;
  const [sheet, setSheet] = useState<Dnd5eSheetData>(() => dnd5eSheetSchema.parse(character.sheetData ?? {}));
  const [name, setName] = useState(character.name);
  const [hpCurrent, setHpCurrent] = useState(character.hpCurrent != null ? String(character.hpCurrent) : "");
  const [hpMax, setHpMax] = useState(character.hpMax != null ? String(character.hpMax) : "");
  const [error, setError] = useState<string | null>(null);
  // Debounced whole-sheet auto-save: "pending" while waiting out the debounce window,
  // "saving" once the request is in flight, "saved"/"error" after it settles.
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const [autosaveError, setAutosaveError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [rollResults, setRollResults] = useState<Record<string, string>>({});
  const [levelUpPending, setLevelUpPending] = useState(false);
  const [levelUpReminders, setLevelUpReminders] = useState<string[]>([]);
  const [levelUpMessage, setLevelUpMessage] = useState<string | null>(null);
  const [levelUpBusy, setLevelUpBusy] = useState(false);
  const [asiPending, setAsiPending] = useState(false);
  const [asiMode, setAsiMode] = useState<"single" | "double" | "feat">("single");
  const [featPickerContext, setFeatPickerContext] = useState<"standalone" | "asi" | null>(null);
  const [invocationPickerOpen, setInvocationPickerOpen] = useState(false);
  const [asiChoiceA, setAsiChoiceA] = useState<Dnd5eAbility>("str");
  const [asiChoiceB, setAsiChoiceB] = useState<Dnd5eAbility>("con");
  const [restDiceCount, setRestDiceCount] = useState(1);
  const [restBusy, setRestBusy] = useState(false);
  const [restMessage, setRestMessage] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [deathSaveBusy, setDeathSaveBusy] = useState(false);
  const [deathSaveMessage, setDeathSaveMessage] = useState<string | null>(null);
  const [wizardSpellbookPending, setWizardSpellbookPending] = useState(false);
  const [wizardSpellbookPickerOpen, setWizardSpellbookPickerOpen] = useState(false);
  const [prepareSpellsOpen, setPrepareSpellsOpen] = useState(false);

  const {
    classes: customClasses,
    races: customRaces,
    subraces: customSubraces,
    subclasses: customSubclasses,
    feats: customFeats,
    spells: customSpells,
    customItems,
  } = useCustomContent();
  const matchedCustomClass = customClasses.find((c) => c.name.toLowerCase() === sheet.class.trim().toLowerCase());
  const matchedCustomRace = customRaces.find((r) => r.name.toLowerCase() === sheet.race.trim().toLowerCase());

  function effectiveLevelEntry(className: string, level: number) {
    if (matchedCustomClass && className.trim().toLowerCase() === matchedCustomClass.name.toLowerCase()) {
      return customClassLevelEntry((matchedCustomClass.data as CustomClassData).levels, level);
    }
    return classLevelEntry(className, level);
  }

  // Subrace options for the current race (SRD + custom), and its trait/bonus info for display.
  const subraceOptions = [
    ...SRD_SUBRACES.filter((s) => s.parentRace.toLowerCase() === sheet.race.trim().toLowerCase()).map((s) => ({
      name: s.name,
      pending: false,
    })),
    ...customSubraces
      .filter((s) => (s.data as CustomSubraceData).parentRace.trim().toLowerCase() === sheet.race.trim().toLowerCase())
      .map((s) => ({ name: s.name, pending: s.status === "pending" })),
  ];

  // Subclass options for the current class (SRD + custom).
  const subclassOptions = [
    ...SRD_SUBCLASSES.filter((s) => s.parentClass.toLowerCase() === sheet.class.trim().toLowerCase()).map((s) => ({
      name: s.name,
      pending: false,
    })),
    ...customSubclasses
      .filter((s) => (s.data as CustomSubclassData).parentClass.trim().toLowerCase() === sheet.class.trim().toLowerCase())
      .map((s) => ({ name: s.name, pending: s.status === "pending" })),
  ];

  // Subclass features granted at a given level (SRD + custom), for the Level Up flow.
  function subclassFeatureNames(subclassName: string, level: number): string[] {
    if (!subclassName.trim()) return [];
    const custom = customSubclasses.find((s) => s.name.toLowerCase() === subclassName.trim().toLowerCase());
    const levels = custom
      ? (custom.data as CustomSubclassData).levels
      : (SRD_SUBCLASSES.find((s) => s.name.toLowerCase() === subclassName.trim().toLowerCase())?.levels ?? []);
    return levels.find((e) => e.level === level)?.features ?? [];
  }

  const casterType = matchedCustomClass ? (matchedCustomClass.data as CustomClassData).casterType : casterTypeForClass(sheet.class);
  const isWizardCaster = !matchedCustomClass && normalizeClassId(sheet.class) === "wizard";
  const isDruid = !matchedCustomClass && normalizeClassId(sheet.class) === "druid" && sheet.level >= 2;
  const isWarlock = !matchedCustomClass && normalizeClassId(sheet.class) === "warlock";
  const knownExpected = matchedCustomClass
    ? effectiveLevelEntry(sheet.class, sheet.level)?.spellsKnown ?? null
    : expectedSpellsKnown(sheet.class, sheet.level);
  const cantripsExpected = matchedCustomClass
    ? effectiveLevelEntry(sheet.class, sheet.level)?.cantripsKnown ?? null
    : expectedCantripsKnown(sheet.class, sheet.level);
  const slotsExpected = matchedCustomClass
    ? effectiveLevelEntry(sheet.class, sheet.level)?.slots ?? {}
    : expectedSlots(sheet.class, sheet.level);

  const martialLines = martialFeatureLines(effectiveLevelEntry(sheet.class, sheet.level)?.martial);

  const pb = proficiencyBonus(sheet.level);
  const saveDC = spellSaveDC(sheet);
  const atkBonus = spellAttackBonus(sheet);
  const hitDie = matchedCustomClass ? (matchedCustomClass.data as CustomClassData).hitDie : classHitDie(sheet.class) ?? 8;
  // Effective (equip/feature-inclusive) CON mod -- used consistently for HP and healing,
  // so a CON-boosting item or ASI is reflected everywhere CON matters, not just base score.
  const conMod = abilityModifier(effectiveAbilityScore(sheet, "con"));

  const classIsKnown =
    DND5E_CLASSES.some((c) => c.name.toLowerCase() === sheet.class.trim().toLowerCase()) || !!matchedCustomClass;
  const selectedSrdRace = SRD_RACES.find((r) => r.name.toLowerCase() === sheet.race.trim().toLowerCase());
  const raceIsKnown = selectedSrdRace !== undefined || !!matchedCustomRace;
  const raceInfo = selectedSrdRace
    ? selectedSrdRace
    : matchedCustomRace
      ? { ...(matchedCustomRace.data as CustomRaceData) }
      : undefined;

  function set<K extends keyof Dnd5eSheetData>(key: K, value: Dnd5eSheetData[K]) {
    setSheet((prev) => ({ ...prev, [key]: value }));
  }

  function setAbility(ability: Dnd5eAbility, raw: string) {
    const score = Number(raw);
    if (!Number.isInteger(score)) return;
    setSheet((prev) => ({ ...prev, abilities: { ...prev.abilities, [ability]: score } }));
  }

  function toggleSaveProf(ability: Dnd5eAbility) {
    setSheet((prev) => ({
      ...prev,
      saveProficiencies: prev.saveProficiencies.includes(ability)
        ? prev.saveProficiencies.filter((a) => a !== ability)
        : [...prev.saveProficiencies, ability],
    }));
  }

  function toggleSkillProf(skillId: string) {
    setSheet((prev) => ({
      ...prev,
      skillProficiencies: prev.skillProficiencies.includes(skillId)
        ? prev.skillProficiencies.filter((s) => s !== skillId)
        : [...prev.skillProficiencies, skillId],
    }));
  }

  function toggleCondition(condition: Dnd5eCondition) {
    setSheet((prev) => ({
      ...prev,
      conditions: prev.conditions.includes(condition)
        ? prev.conditions.filter((c) => c !== condition)
        : [...prev.conditions, condition],
    }));
  }

  async function rollCheck(key: string, bonus: number, label: string) {
    if (readOnly) return;
    try {
      const formula = bonus === 0 ? "1d20" : `1d20${bonus > 0 ? "+" : ""}${bonus}`;
      const roll = await diceApi.createRoll(character.campaignId, formula, label);
      setRollResults((prev) => ({ ...prev, [key]: roll.breakdown }));
    } catch (err) {
      setRollResults((prev) => ({ ...prev, [key]: err instanceof Error ? err.message : "Roll failed" }));
    }
  }

  async function rollDeathSave() {
    setDeathSaveBusy(true);
    setError(null);
    try {
      const roll = await diceApi.createRoll(character.campaignId, "1d20", "Death save");
      const natural = roll.total;
      if (natural === 20) {
        setSheet((prev) => ({ ...prev, deathSaveSuccesses: 0, deathSaveFailures: 0 }));
        setHpCurrent("1");
        setDeathSaveMessage(`Natural 20 (${roll.breakdown}) — regains 1 HP and stops rolling death saves!`);
      } else if (natural === 1) {
        setSheet((prev) => ({ ...prev, deathSaveFailures: Math.min(3, prev.deathSaveFailures + 2) }));
        setDeathSaveMessage(`Natural 1 (${roll.breakdown}) — counts as two failures.`);
      } else if (natural >= 10) {
        setSheet((prev) => ({ ...prev, deathSaveSuccesses: Math.min(3, prev.deathSaveSuccesses + 1) }));
        setDeathSaveMessage(`${roll.breakdown} — success.`);
      } else {
        setSheet((prev) => ({ ...prev, deathSaveFailures: Math.min(3, prev.deathSaveFailures + 1) }));
        setDeathSaveMessage(`${roll.breakdown} — failure.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Death save roll failed");
    } finally {
      setDeathSaveBusy(false);
    }
  }

  function levelUp() {
    const newLevel = sheet.level + 1;
    const newEntry = effectiveLevelEntry(sheet.class, newLevel);
    const oldEntry = effectiveLevelEntry(sheet.class, sheet.level);
    const newSlots = newEntry?.slots ?? {};
    // Class features plus this level's subclass features (if a subclass is chosen), de-duplicated
    // since some base-class progression entries already list the default subclass's feature names.
    const featureNames = [
      ...new Set([...(newEntry?.features ?? []), ...subclassFeatureNames(sheet.subclass, newLevel)]),
    ];
    const oldKnown = oldEntry?.spellsKnown ?? null;
    const newKnown = newEntry?.spellsKnown ?? null;
    const oldCantrips = oldEntry?.cantripsKnown ?? null;
    const newCantrips = newEntry?.cantripsKnown ?? null;

    setSheet((prev) => {
      const spellSlots =
        Object.keys(newSlots).length > 0
          ? Object.entries(newSlots)
              .map(([lvl, total]) => {
                const existing = prev.spellSlots.find((s) => s.level === Number(lvl));
                return { level: Number(lvl), total, available: existing?.available ?? total };
              })
              .sort((a, b) => a.level - b.level)
          : prev.spellSlots;

      // One blank-bonus structured entry per newly-granted feature name, deduped against
      // names already on the sheet (a re-run of level-up, or a name also listed by the base
      // class progression and the subclass lookup, shouldn't create duplicates).
      const existingNames = new Set(prev.features.map((f) => f.name));
      const newFeatureEntries: Dnd5eSheetData["features"][number][] = featureNames
        .filter((name) => !existingNames.has(name))
        .map((name) => ({
          id: `feature-${newLevel}-${name}-${Date.now()}`,
          name,
          description: "",
          abilityBonuses: {},
          acBonus: 0,
          attackBonus: 0,
          damageBonus: 0,
          spellDCBonus: 0,
          spellAttackBonus: 0,
        }));

      return {
        ...prev,
        level: newLevel,
        hitDiceTotal: prev.hitDiceTotal + 1,
        hitDiceAvailable: prev.hitDiceAvailable + 1,
        spellSlots,
        features: [...prev.features, ...newFeatureEntries],
      };
    });

    const reminders: string[] = [];
    if (newKnown !== null && newKnown !== oldKnown) {
      reminders.push(`Spells known: ${oldKnown ?? 0} → ${newKnown} — open the spell picker to add.`);
    }
    if (newCantrips !== null && newCantrips !== oldCantrips) {
      reminders.push(`Cantrips known: ${oldCantrips ?? 0} → ${newCantrips}.`);
    }
    setLevelUpReminders(reminders);
    setLevelUpMessage(null);
    setLevelUpPending(true);
    setAsiPending(featureNames.some((f) => f.toLowerCase().includes("ability score improvement")));
    setAsiMode("single");
    setWizardSpellbookPending(isWizardCaster);
  }

  function applyAsi() {
    if (asiMode === "single") {
      setSheet((prev) => ({
        ...prev,
        abilities: { ...prev.abilities, [asiChoiceA]: Math.min(20, prev.abilities[asiChoiceA] + 2) },
      }));
      setLevelUpMessage((prev) => `${prev ?? ""} ASI: +2 ${DND5E_ABILITY_NAMES[asiChoiceA]}.`);
    } else if (asiMode === "double") {
      setSheet((prev) => {
        const abilities = { ...prev.abilities, [asiChoiceA]: Math.min(20, prev.abilities[asiChoiceA] + 1) };
        abilities[asiChoiceB] = Math.min(20, abilities[asiChoiceB] + 1);
        return { ...prev, abilities };
      });
      setLevelUpMessage(
        (prev) => `${prev ?? ""} ASI: +1 ${DND5E_ABILITY_NAMES[asiChoiceA]}, +1 ${DND5E_ABILITY_NAMES[asiChoiceB]}.`,
      );
    } else {
      // "Take a feat" -- open the feat picker; the chosen feat's bonuses apply automatically.
      setFeatPickerContext("asi");
      setAsiPending(false);
      return;
    }
    setAsiPending(false);
  }

  function addFeat(feat: Dnd5eSheetData["feats"][number]) {
    setSheet((prev) => ({ ...prev, feats: [...prev.feats, feat] }));
    if (featPickerContext === "asi") {
      setLevelUpMessage((prev) => `${prev ?? ""} Feat gained${feat.name ? `: ${feat.name}` : ""}.`);
    }
    setFeatPickerContext(null);
  }

  function addInvocation(feature: Dnd5eSheetData["features"][number]) {
    setSheet((prev) => ({ ...prev, features: [...prev.features, feature] }));
    setInvocationPickerOpen(false);
  }

  function addArcanumTier(spellLevel: 6 | 7 | 8 | 9) {
    setSheet((prev) => ({
      ...prev,
      mysticArcanum: [...prev.mysticArcanum, { spellLevel, spellName: "", used: false }],
    }));
  }

  function updateArcanum(index: number, patch: Partial<Dnd5eSheetData["mysticArcanum"][number]>) {
    setSheet((prev) => ({
      ...prev,
      mysticArcanum: prev.mysticArcanum.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    }));
  }

  async function resolveLevelUpHp(method: "roll" | "average") {
    setLevelUpBusy(true);
    try {
      let diceGain: number;
      let breakdown: string;
      if (method === "average") {
        diceGain = Math.floor(hitDie / 2) + 1;
        breakdown = `average (${diceGain})`;
      } else {
        const roll = await diceApi.createRoll(character.campaignId, `1d${hitDie}`, `Level ${sheet.level} hit die`);
        diceGain = Math.max(1, roll.total);
        breakdown = roll.breakdown;
      }
      // Max HP = sum of die-only rolls (CON excluded) + level x current CON mod, recomputed
      // fresh here so a CON change retroactively corrects every level already gained.
      const newHistory = [...sheet.hpDiceHistory, diceGain];
      const oldMax = hpMax !== "" ? Number(hpMax) : computeHpMax(sheet);
      const newMax = computeHpMax({ ...sheet, hpDiceHistory: newHistory });
      const delta = newMax - oldMax;
      setSheet((prev) => ({ ...prev, hpDiceHistory: newHistory }));
      setHpMax(String(newMax));
      if (hpCurrent !== "") setHpCurrent(String(Number(hpCurrent) + delta));
      setLevelUpPending(false);
      setLevelUpMessage(
        `Level up: +${delta} max HP (${breakdown} ${formatModifier(conMod)} CON).${levelUpReminders.length ? " " + levelUpReminders.join(" ") : ""}`,
      );
    } catch (err) {
      setLevelUpMessage(err instanceof Error ? err.message : "HP roll failed");
    } finally {
      setLevelUpBusy(false);
    }
  }

  function longRest() {
    setSheet((prev) => {
      const bonusDice = Math.max(1, Math.floor(prev.hitDiceTotal / 2));
      return {
        ...prev,
        spellSlots: prev.spellSlots.map((s) => ({ ...s, available: s.total })),
        exhaustionLevel: Math.max(0, prev.exhaustionLevel - 1),
        hitDiceAvailable: Math.min(prev.hitDiceTotal, prev.hitDiceAvailable + bonusDice),
        wildShape: { ...prev.wildShape, usesAvailable: 2 },
        mysticArcanum: prev.mysticArcanum.map((a) => ({ ...a, used: false })),
      };
    });
    if (hpMax !== "") setHpCurrent(hpMax);
    setRestMessage("Long rest: HP and spell slots restored, exhaustion -1, hit dice recovered.");
    if (casterType === "prepared") setPrepareSpellsOpen(true);
  }

  async function shortRest() {
    const n = Math.min(restDiceCount, sheet.hitDiceAvailable);
    if (n < 1) return;
    setRestBusy(true);
    setError(null);
    try {
      const bonusTotal = conMod * n;
      const formula = bonusTotal === 0 ? `${n}d${hitDie}` : `${n}d${hitDie}${bonusTotal > 0 ? "+" : ""}${bonusTotal}`;
      const roll = await diceApi.createRoll(character.campaignId, formula, "Short rest healing");
      const healed = Math.max(0, roll.total);

      const isPact = casterTypeForClass(sheet.class) === "pact";
      setSheet((prev) => ({
        ...prev,
        hitDiceAvailable: Math.max(0, prev.hitDiceAvailable - n),
        spellSlots: isPact ? prev.spellSlots.map((s) => ({ ...s, available: s.total })) : prev.spellSlots,
        wildShape: { ...prev.wildShape, usesAvailable: 2 },
      }));
      setHpCurrent((prevHp) => {
        const cur = prevHp === "" ? 0 : Number(prevHp);
        const max = hpMax === "" ? null : Number(hpMax);
        const newHp = max !== null ? Math.min(max, cur + healed) : cur + healed;
        return String(newHp);
      });
      setRestMessage(
        `Short rest: spent ${n} hit die${n > 1 ? "s" : ""}, healed ${healed} HP (${roll.breakdown}).${
          isPact ? " Pact Magic slots restored." : ""
        }`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rest failed");
    } finally {
      setRestBusy(false);
    }
  }

  // Refs mirror the latest values every render so a save triggered by the debounce timer (or a
  // follow-up save queued while one is in flight) always sends the current state, never a stale
  // snapshot captured when the timer was scheduled.
  const sheetRef = useRef(sheet);
  sheetRef.current = sheet;
  const nameRef = useRef(name);
  nameRef.current = name;
  const hpCurrentRef = useRef(hpCurrent);
  hpCurrentRef.current = hpCurrent;
  const hpMaxRef = useRef(hpMax);
  hpMaxRef.current = hpMax;

  const saveInFlightRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  async function persist() {
    if (saveInFlightRef.current) {
      pendingSaveRef.current = true;
      return;
    }
    saveInFlightRef.current = true;
    setAutosaveStatus("saving");
    setAutosaveError(null);
    try {
      const updated = await charactersApi.updateCharacter(character.id, {
        name: nameRef.current,
        hpCurrent: hpCurrentRef.current === "" ? null : Number(hpCurrentRef.current),
        hpMax: hpMaxRef.current === "" ? null : Number(hpMaxRef.current),
        sheetData: sheetRef.current,
      });
      onSaved(updated);
      setAutosaveStatus("saved");
    } catch (err) {
      setAutosaveError(err instanceof Error ? err.message : "Save failed");
      setAutosaveStatus("error");
    } finally {
      saveInFlightRef.current = false;
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        persist();
      }
    }
  }

  // Debounced auto-save: ~1s after the last change to any of these, persist the whole sheet.
  // Skips the initial mount (nothing to save yet) and re-arms the timer on every further change.
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (readOnly) return;
    setAutosaveStatus("pending");
    const t = setTimeout(() => {
      pendingTimeoutRef.current = null;
      persist();
    }, 1000);
    pendingTimeoutRef.current = t;
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, name, hpCurrent, hpMax, readOnly]);

  // Flush a still-pending debounced save on unmount (e.g. navigating away right after a cast
  // spent a slot) so it isn't silently lost. Empty deps -- this cleanup only runs on true unmount.
  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
        persist();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setStatus(status: Dnd5eSheetData["status"]) {
    setSheet((prev) => ({ ...prev, status, statusChangedAt: new Date().toISOString() }));
  }

  async function reactivate() {
    setStatusBusy(true);
    setError(null);
    try {
      const updated = await charactersApi.updateCharacter(character.id, {
        sheetData: { ...sheet, status: "active", statusChangedAt: null },
      });
      setSheet((prev) => ({ ...prev, status: "active", statusChangedAt: null }));
      onSaved(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reactivate failed");
    } finally {
      setStatusBusy(false);
    }
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Status: always interactive even in read-only mode, so Reactivate can escape it */}
      <div style={box}>
        <h3>Status</h3>
        {sheet.status === "active" ? (
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button type="button" onClick={() => setStatus("dead")} disabled={readOnly}>
              Mark as Dead
            </button>
            <button type="button" onClick={() => setStatus("retired")} disabled={readOnly}>
              Retire
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <span>
              {sheet.status === "dead" ? "💀 Died" : "🏳️ Retired"}
              {sheet.statusChangedAt ? ` — ${new Date(sheet.statusChangedAt).toLocaleDateString()}` : ""}
            </span>
            <button type="button" onClick={reactivate} disabled={statusBusy}>
              Reactivate
            </button>
          </div>
        )}
      </div>

      <fieldset disabled={readOnly} style={{ border: "none", margin: 0, padding: 0, display: "contents" }}>
      {/* Header */}
      <div style={{ ...box, display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "end" }}>
        <CharacterPortrait characterId={character.id} canEdit={!readOnly} />
        <label>
          Character name
          <br />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isOwner}
            title={isOwner ? "Only a DM or admin can rename a character after creation" : undefined}
            style={{ fontSize: "1.2rem" }}
          />
        </label>
        <label>
          Class
          <br />
          <select
            value={classIsKnown ? sheet.class : "__other__"}
            onChange={(e) => set("class", e.target.value === "__other__" ? "" : e.target.value)}
            disabled={isOwner}
            title={isOwner ? "Only a DM or admin can change class after creation" : undefined}
          >
            {DND5E_CLASSES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
            {customClasses.length > 0 && (
              <optgroup label="Custom">
                {customClasses.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                    {c.status === "pending" ? " (pending)" : ""}
                  </option>
                ))}
              </optgroup>
            )}
            <option value="__other__">Other (homebrew)</option>
          </select>
          {!classIsKnown && (
            <input
              placeholder="Homebrew class name"
              value={sheet.class}
              onChange={(e) => set("class", e.target.value)}
              disabled={isOwner}
              style={{ marginLeft: "0.4rem" }}
            />
          )}
        </label>
        {subclassOptions.length > 0 && (
          <label>
            Subclass
            <br />
            <select value={sheet.subclass} onChange={(e) => set("subclass", e.target.value)}>
              <option value="">(none)</option>
              {subclassOptions.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                  {s.pending ? " (pending)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Level
          <br />
          <input
            type="number"
            min={1}
            max={20}
            value={sheet.level}
            onChange={(e) => set("level", Number(e.target.value) || 1)}
            style={numInput}
          />
          {sheet.level < 20 && (
            <button type="button" onClick={levelUp} style={{ marginLeft: "0.3rem", fontSize: "0.8rem" }}>
              Level Up
            </button>
          )}
        </label>
        <label>
          Race
          <br />
          <select
            value={raceIsKnown ? sheet.race : "__other__"}
            onChange={(e) => set("race", e.target.value === "__other__" ? "" : e.target.value)}
          >
            {SRD_RACES.map((r) => (
              <option key={r.id} value={r.name}>
                {r.name}
              </option>
            ))}
            {customRaces.length > 0 && (
              <optgroup label="Custom">
                {customRaces.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                    {r.status === "pending" ? " (pending)" : ""}
                  </option>
                ))}
              </optgroup>
            )}
            <option value="__other__">Other (homebrew)</option>
          </select>
          {!raceIsKnown && (
            <input
              placeholder="Homebrew race name"
              value={sheet.race}
              onChange={(e) => set("race", e.target.value)}
              style={{ marginLeft: "0.4rem" }}
            />
          )}
          {raceInfo && (
            <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.2rem" }}>
              Speed {raceInfo.speed} · {raceInfo.size}
              {Object.keys(raceInfo.abilityBonuses).length > 0 && (
                <>
                  {" "}
                  ·{" "}
                  {Object.entries(raceInfo.abilityBonuses)
                    .map(([ability, bonus]) => `${ability.toUpperCase()} +${bonus}`)
                    .join(", ")}
                </>
              )}
              {raceInfo.traits.length > 0 && <> · {raceInfo.traits.join(", ")}</>}
            </div>
          )}
        </label>
        {subraceOptions.length > 0 && (
          <label>
            Subrace
            <br />
            <select
              value={sheet.subrace}
              onChange={(e) => set("subrace", e.target.value)}
              disabled={isOwner}
              title={isOwner ? "Only a DM or admin can change subrace after creation" : undefined}
            >
              <option value="">(none)</option>
              {subraceOptions.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                  {s.pending ? " (pending)" : ""}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Background
          <br />
          <input
            value={sheet.background}
            onChange={(e) => set("background", e.target.value)}
            disabled={isOwner}
            title={isOwner ? "Only a DM or admin can change background after creation" : undefined}
          />
        </label>
        <label>
          Alignment
          <br />
          <select value={sheet.alignment} onChange={(e) => set("alignment", e.target.value)}>
            {!DND5E_ALIGNMENTS.includes(sheet.alignment as (typeof DND5E_ALIGNMENTS)[number]) && sheet.alignment && (
              <option value={sheet.alignment}>{sheet.alignment}</option>
            )}
            {DND5E_ALIGNMENTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <div>
          Proficiency bonus: <strong>{formatModifier(pb)}</strong>
        </div>
      </div>

      {levelUpPending && (
        <div style={box}>
          Level up! Gain HP for level {sheet.level} (d{hitDie} hit die {formatModifier(conMod)} CON):{" "}
          <button type="button" onClick={() => resolveLevelUpHp("roll")} disabled={levelUpBusy}>
            Roll
          </button>{" "}
          <button type="button" onClick={() => resolveLevelUpHp("average")} disabled={levelUpBusy}>
            Take average ({Math.max(1, Math.floor(hitDie / 2) + 1 + conMod)})
          </button>
        </div>
      )}
      {!levelUpPending && asiPending && (
        <div style={box}>
          <div style={{ marginBottom: "0.4rem" }}>Ability Score Improvement — choose one:</div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <label>
              <input
                type="radio"
                name="asi-mode"
                checked={asiMode === "single"}
                onChange={() => setAsiMode("single")}
              />{" "}
              +2 to one ability
            </label>
            {asiMode === "single" && (
              <select value={asiChoiceA} onChange={(e) => setAsiChoiceA(e.target.value as Dnd5eAbility)}>
                {DND5E_ABILITIES.map((a) => (
                  <option key={a} value={a}>
                    {DND5E_ABILITY_NAMES[a]}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap", marginTop: "0.3rem" }}>
            <label>
              <input
                type="radio"
                name="asi-mode"
                checked={asiMode === "double"}
                onChange={() => setAsiMode("double")}
              />{" "}
              +1 to two abilities
            </label>
            {asiMode === "double" && (
              <>
                <select value={asiChoiceA} onChange={(e) => setAsiChoiceA(e.target.value as Dnd5eAbility)}>
                  {DND5E_ABILITIES.map((a) => (
                    <option key={a} value={a}>
                      {DND5E_ABILITY_NAMES[a]}
                    </option>
                  ))}
                </select>
                <select value={asiChoiceB} onChange={(e) => setAsiChoiceB(e.target.value as Dnd5eAbility)}>
                  {DND5E_ABILITIES.map((a) => (
                    <option key={a} value={a}>
                      {DND5E_ABILITY_NAMES[a]}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
          <div style={{ marginTop: "0.3rem" }}>
            <label>
              <input type="radio" name="asi-mode" checked={asiMode === "feat"} onChange={() => setAsiMode("feat")} />{" "}
              Take a feat instead
            </label>
          </div>
          <button type="button" onClick={applyAsi} style={{ marginTop: "0.5rem" }}>
            Confirm
          </button>
        </div>
      )}
      {!levelUpPending && wizardSpellbookPending && (
        <div style={box}>
          <div style={{ marginBottom: "0.4rem" }}>
            Add 2 new spells to your spellbook (level {sheet.level}, up to level{" "}
            {maxPreparableSpellLevel(sheet.class, sheet.level)}).
          </div>
          <button type="button" onClick={() => setWizardSpellbookPickerOpen(true)}>
            Choose spells
          </button>
        </div>
      )}
      {wizardSpellbookPickerOpen && (
        <WizardSpellbookPicker
          title="Choose 2 new spells for your spellbook"
          requiredCount={2}
          maxLevel={maxPreparableSpellLevel(sheet.class, sheet.level)}
          excludeIds={sheet.spells.map((s) => s.srdId).filter((id): id is string => id !== undefined)}
          onConfirm={(spells) => {
            setSheet((prev) => ({
              ...prev,
              spells: [
                ...prev.spells,
                ...spells.map((s, i) => ({
                  id: `spell-${Date.now()}-${i}`,
                  srdId: s.id,
                  name: s.name,
                  level: s.level,
                  prepared: false,
                })),
              ],
            }));
            setWizardSpellbookPending(false);
            setWizardSpellbookPickerOpen(false);
            setLevelUpMessage((prev) => `${prev ?? ""} Added to spellbook: ${spells.map((s) => s.name).join(", ")}.`);
          }}
          onClose={() => setWizardSpellbookPickerOpen(false)}
        />
      )}
      {levelUpMessage && (
        <div style={box}>
          <small>{levelUpMessage}</small>
        </div>
      )}

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        {/* Abilities */}
        <div style={{ ...box, flex: "0 0 auto" }}>
          <h3>Abilities</h3>
          {DND5E_ABILITIES.map((a) => {
            const eqBonus = equippedAbilityBonus(sheet, a);
            return (
              <div key={a} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                <span style={{ width: "6.5rem" }}>{DND5E_ABILITY_NAMES[a]}</span>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={sheet.abilities[a]}
                  onChange={(e) => setAbility(a, e.target.value)}
                  style={numInput}
                />
                <strong style={{ width: "2.5rem" }}>
                  {formatModifier(abilityModifier(effectiveAbilityScore(sheet, a)))}
                </strong>
                {eqBonus !== 0 && (
                  <small style={{ color: "#666" }} title="Bonus from equipped items">
                    ({formatModifier(eqBonus)} eq)
                  </small>
                )}
              </div>
            );
          })}
        </div>

        {/* Saves */}
        <div style={{ ...box, flex: "0 0 auto" }}>
          <h3>Saving throws</h3>
          {DND5E_ABILITIES.map((a) => (
            <div key={a}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={sheet.saveProficiencies.includes(a)}
                  onChange={() => toggleSaveProf(a)}
                />
                <span
                  style={{ width: "6.5rem", cursor: "pointer", textDecoration: "underline dotted" }}
                  title="Click to roll"
                  onClick={() => rollCheck(`save-${a}`, saveBonus(sheet, a), `${DND5E_ABILITY_NAMES[a]} save`)}
                >
                  {DND5E_ABILITY_NAMES[a]}
                </span>
                <strong>{formatModifier(saveBonus(sheet, a))}</strong>
              </div>
              {rollResults[`save-${a}`] && (
                <div style={{ marginLeft: "1.9rem" }}>
                  <small style={{ color: "#555" }}>{rollResults[`save-${a}`]}</small>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Skills, grouped by parent ability */}
        <div style={{ ...box, flex: "1 1 300px" }}>
          <h3>Skills</h3>
          <div style={{ columnCount: 2, columnGap: "1.5rem" }}>
            {DND5E_ABILITIES.map((a) => {
              const skillsForAbility = DND5E_SKILLS.filter((s) => s.ability === a);
              if (skillsForAbility.length === 0) return null;
              return (
                <div key={a} style={{ breakInside: "avoid", marginBottom: "0.6rem" }}>
                  <div style={{ fontWeight: "bold", fontSize: "0.85rem", color: "#666" }}>
                    {DND5E_ABILITY_NAMES[a]}
                  </div>
                  {skillsForAbility.map((s) => (
                    <div key={s.id}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                        <input
                          type="checkbox"
                          checked={sheet.skillProficiencies.includes(s.id)}
                          onChange={() => toggleSkillProf(s.id)}
                        />
                        <span
                          style={{ flex: 1, cursor: "pointer", textDecoration: "underline dotted" }}
                          title="Click to roll"
                          onClick={() => rollCheck(`skill-${s.id}`, skillBonus(sheet, s.id), `${s.name} check`)}
                        >
                          {s.name}
                          {s.id === "stealth" && hasArmorStealthDisadvantage(sheet) && (
                            <small style={{ color: "crimson" }} title="Equipped armor imposes Stealth disadvantage">
                              {" "}
                              (disadv.)
                            </small>
                          )}
                        </span>
                        <strong>{formatModifier(skillBonus(sheet, s.id))}</strong>
                      </div>
                      {rollResults[`skill-${s.id}`] && (
                        <div style={{ marginLeft: "1.7rem" }}>
                          <small style={{ color: "#555" }}>{rollResults[`skill-${s.id}`]}</small>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
          <hr />
          <div style={{ fontSize: "0.9rem" }}>
            <div>
              Passive Perception: <strong>{passiveScore(sheet, "perception")}</strong>
            </div>
            <div>
              Passive Investigation: <strong>{passiveScore(sheet, "investigation")}</strong>
            </div>
            <div>
              Passive Insight: <strong>{passiveScore(sheet, "insight")}</strong>
            </div>
          </div>
        </div>

        {/* Martial features */}
        {martialLines.length > 0 && (
          <div style={{ ...box, flex: "0 0 auto" }}>
            <h3>Martial features</h3>
            <div style={{ fontSize: "0.9rem" }}>
              {martialLines.map((line) => (
                <div key={line}>{line}</div>
              ))}
            </div>
          </div>
        )}

        {/* Combat */}
        <div style={{ ...box, flex: "0 0 auto" }}>
          <h3>Combat</h3>
          <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "0.4rem 0.8rem", alignItems: "center" }}>
            <span>AC</span>
            <span>
              {acBreakdownText(sheet) ? (
                <>
                  <strong style={{ fontSize: "1.1rem" }}>{effectiveAC(sheet)}</strong>{" "}
                  <small style={{ color: "#666" }}>({acBreakdownText(sheet)})</small>
                </>
              ) : (
                <>
                  <input type="number" value={sheet.ac} onChange={(e) => set("ac", Number(e.target.value) || 0)} style={numInput} />{" "}
                  {effectiveAC(sheet) !== sheet.ac && (
                    <small style={{ color: "#666" }} title="Effective AC including equipped items">
                      → {effectiveAC(sheet)}
                    </small>
                  )}
                </>
              )}
              {armorOverlapWarning(sheet) && (
                <div style={{ color: "crimson", fontSize: "0.8rem" }}>{armorOverlapWarning(sheet)}</div>
              )}
            </span>
            <span>Initiative</span>
            <strong>{formatModifier(abilityModifier(effectiveAbilityScore(sheet, "dex")))}</strong>
            <span>Speed</span>
            <input type="number" value={sheet.speed} onChange={(e) => set("speed", Number(e.target.value) || 0)} style={numInput} />
            <span>HP</span>
            <span>
              <input type="number" value={hpCurrent} onChange={(e) => setHpCurrent(e.target.value)} style={numInput} /> /{" "}
              <input type="number" value={hpMax} onChange={(e) => setHpMax(e.target.value)} style={numInput} />
              {hpMax !== "" && Number(hpMax) !== computeHpMax(sheet) && (
                <button
                  type="button"
                  title="Max HP formula (hit die history + level x current CON mod) doesn't match the stored value -- likely a CON change since the last level-up"
                  onClick={() => {
                    const newMax = computeHpMax(sheet);
                    const delta = newMax - Number(hpMax);
                    setHpMax(String(newMax));
                    if (hpCurrent !== "") setHpCurrent(String(Number(hpCurrent) + delta));
                  }}
                  style={{ marginLeft: "0.4rem", fontSize: "0.8rem" }}
                >
                  Recalculate max HP ({formatModifier(computeHpMax(sheet) - Number(hpMax))})
                </button>
              )}
            </span>
            <span>Hit dice</span>
            <input value={sheet.hitDice} onChange={(e) => set("hitDice", e.target.value)} style={{ width: "5rem" }} />
            <span>Hit dice (avail/total)</span>
            <span>
              <input
                type="number"
                min={0}
                max={20}
                value={sheet.hitDiceAvailable}
                onChange={(e) => set("hitDiceAvailable", Math.max(0, Number(e.target.value) || 0))}
                style={{ width: "2.8rem" }}
              />{" "}
              /{" "}
              <input
                type="number"
                min={0}
                max={20}
                value={sheet.hitDiceTotal}
                onChange={(e) => set("hitDiceTotal", Math.max(0, Number(e.target.value) || 0))}
                style={{ width: "2.8rem" }}
              />
            </span>
            <span>Death saves</span>
            <span>
              ✓{" "}
              <input
                type="number"
                min={0}
                max={3}
                value={sheet.deathSaveSuccesses}
                onChange={(e) => set("deathSaveSuccesses", Number(e.target.value) || 0)}
                style={{ width: "2.5rem" }}
              />{" "}
              ✗{" "}
              <input
                type="number"
                min={0}
                max={3}
                value={sheet.deathSaveFailures}
                onChange={(e) => set("deathSaveFailures", Number(e.target.value) || 0)}
                style={{ width: "2.5rem" }}
              />
            </span>
          </div>
          {hpCurrent === "0" && sheet.deathSaveSuccesses < 3 && sheet.deathSaveFailures < 3 && (
            <div style={{ marginTop: "0.5rem" }}>
              <button type="button" onClick={rollDeathSave} disabled={deathSaveBusy}>
                Roll death save
              </button>
            </div>
          )}
          {sheet.deathSaveSuccesses >= 3 && (
            <div style={{ marginTop: "0.5rem", color: "green" }}>
              <strong>Stabilized.</strong>
            </div>
          )}
          {sheet.deathSaveFailures >= 3 && (
            <div style={{ marginTop: "0.5rem", color: "crimson" }}>
              <strong>Character has died.</strong>{" "}
              <button type="button" onClick={() => setStatus("dead")}>
                Mark as dead
              </button>
            </div>
          )}
          {deathSaveMessage && (
            <div style={{ marginTop: "0.3rem" }}>
              <small>{deathSaveMessage}</small>
            </div>
          )}
        </div>

        {/* Conditions */}
        <div style={{ ...box, flex: "0 0 auto" }}>
          <h3>Conditions</h3>
          <div style={{ columnCount: 2, columnGap: "1rem" }}>
            {DND5E_CONDITIONS.map((c) => (
              <label key={c} style={{ display: "flex", alignItems: "center", gap: "0.3rem", breakInside: "avoid" }}>
                <input type="checkbox" checked={sheet.conditions.includes(c)} onChange={() => toggleCondition(c)} />
                {DND5E_CONDITION_LABELS[c]}
              </label>
            ))}
          </div>
          <label style={{ display: "block", marginTop: "0.5rem" }}>
            Exhaustion level (0-6){" "}
            <input
              type="number"
              min={0}
              max={6}
              value={sheet.exhaustionLevel}
              onChange={(e) => set("exhaustionLevel", Math.max(0, Math.min(6, Number(e.target.value) || 0)))}
              style={{ width: "3rem" }}
            />
          </label>
          {character.campaignId !== null && (
            <p>
              <small>Conditions here sync to the initiative tracker while this character is in an active encounter.</small>
            </p>
          )}
        </div>

        {/* Rest */}
        <div style={{ ...box, flex: "0 0 auto" }}>
          <h3>Rest</h3>
          <button type="button" onClick={longRest} style={{ marginBottom: "0.6rem" }}>
            Long rest
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.4rem" }}>
            <label>
              Hit dice to spend{" "}
              <input
                type="number"
                min={1}
                max={Math.max(1, sheet.hitDiceAvailable)}
                value={restDiceCount}
                onChange={(e) => setRestDiceCount(Math.max(1, Number(e.target.value) || 1))}
                style={{ width: "3rem" }}
              />
            </label>
            <button type="button" onClick={shortRest} disabled={restBusy || sheet.hitDiceAvailable < 1}>
              Short rest
            </button>
          </div>
          <div>
            Hit dice available: <strong>{sheet.hitDiceAvailable}</strong> / {sheet.hitDiceTotal}
          </div>
          {restMessage && <p style={{ fontSize: "0.85rem", color: "#555", maxWidth: "16rem" }}>{restMessage}</p>}
        </div>
      </div>

      {/* Attacks */}
      <div style={box}>
        <h3>Attacks</h3>
        {sheet.attacks.map((atk, i) => {
          function updateAttack(patch: Partial<Dnd5eSheetData["attacks"][number]>) {
            set("attacks", sheet.attacks.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          }
          const bonus = attackBonus(sheet, atk);
          return (
            <div key={atk.id} style={{ marginBottom: "0.5rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <input placeholder="Name" value={atk.name} onChange={(e) => updateAttack({ name: e.target.value })} />
                <label>
                  Ability{" "}
                  <select value={atk.ability} onChange={(e) => updateAttack({ ability: e.target.value as Dnd5eAbility })}>
                    {DND5E_ABILITIES.map((a) => (
                      <option key={a} value={a}>
                        {a.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Magic bonus{" "}
                  <input
                    type="number"
                    value={atk.magicBonus}
                    onChange={(e) => updateAttack({ magicBonus: Number(e.target.value) || 0 })}
                    style={{ width: "3rem" }}
                  />
                </label>
                <strong>Bonus: {formatModifier(bonus)}</strong>
                <input
                  placeholder="Damage dice, e.g. 1d8"
                  value={atk.damageDice}
                  onChange={(e) => updateAttack({ damageDice: e.target.value })}
                  style={{ width: "8rem" }}
                />
                <input
                  placeholder="Damage type"
                  value={atk.damageType}
                  onChange={(e) => updateAttack({ damageType: e.target.value })}
                  style={{ width: "7rem" }}
                />
                <button type="button" onClick={() => set("attacks", sheet.attacks.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
              <AttackRollControl
                name={atk.name}
                attackBonus={bonus}
                magicBonus={atk.magicBonus + featBonusTotal(sheet, "damageBonus")}
                damageDice={atk.damageDice}
                damageType={atk.damageType}
                campaignId={character.campaignId}
              />
            </div>
          );
        })}
        <button
          type="button"
          onClick={() =>
            set("attacks", [
              ...sheet.attacks,
              { id: `atk-${Date.now()}`, name: "", ability: "str", magicBonus: 0, damageDice: "", damageType: "" },
            ])
          }
        >
          Add attack
        </button>
      </div>

      {/* Spellcasting */}
      <div style={box}>
        <h3>Spellcasting</h3>
        <div style={{ display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap", marginBottom: "0.75rem" }}>
          <label>
            Spellcasting ability{" "}
            <select
              value={sheet.spellcastingAbility}
              onChange={(e) => set("spellcastingAbility", e.target.value as Dnd5eSheetData["spellcastingAbility"])}
            >
              <option value="">None</option>
              {DND5E_ABILITIES.map((a) => (
                <option key={a} value={a}>
                  {DND5E_ABILITY_NAMES[a]}
                </option>
              ))}
            </select>
          </label>
          <div>
            Spell save DC: <strong>{saveDC ?? "—"}</strong>
          </div>
          <div>
            Spell attack bonus: <strong>{atkBonus !== null ? formatModifier(atkBonus) : "—"}</strong>
          </div>
        </div>

        <h4>
          Spell slots (avail/total){" "}
          {Object.keys(slotsExpected).length > 0 && (
            <button
              type="button"
              onClick={() =>
                set(
                  "spellSlots",
                  Object.entries(slotsExpected)
                    .map(([lvl, total]) => {
                      const existing = sheet.spellSlots.find((s) => s.level === Number(lvl));
                      return { level: Number(lvl), total, available: existing?.available ?? total };
                    })
                    .sort((a, b) => a.level - b.level),
                )
              }
              style={{ fontSize: "0.8rem" }}
            >
              Set to expected for {sheet.class || "class"} lvl {sheet.level}
            </button>
          )}
        </h4>
        {sheet.spellSlots.map((slot, i) => (
          <span key={slot.level} style={{ marginRight: "1rem" }}>
            Lv {slot.level}:{" "}
            <input
              type="number"
              min={0}
              value={slot.available}
              onChange={(e) =>
                set(
                  "spellSlots",
                  sheet.spellSlots.map((x, j) => (j === i ? { ...x, available: Number(e.target.value) || 0 } : x)),
                )
              }
              style={{ width: "2.8rem" }}
              title="Available (unspent) slots"
            />{" "}
            /{" "}
            <input
              type="number"
              min={0}
              value={slot.total}
              onChange={(e) =>
                set("spellSlots", sheet.spellSlots.map((x, j) => (j === i ? { ...x, total: Number(e.target.value) || 0 } : x)))
              }
              style={{ width: "2.8rem" }}
            />
            {slotsExpected[slot.level] !== undefined && slotsExpected[slot.level] !== slot.total && (
              <small style={{ color: "#a60" }}> (expected {slotsExpected[slot.level]})</small>
            )}
          </span>
        ))}
        {sheet.spellSlots.length < 9 && (
          <button
            type="button"
            onClick={() => {
              const nextLevel = sheet.spellSlots.length > 0 ? Math.max(...sheet.spellSlots.map((s) => s.level)) + 1 : 1;
              if (nextLevel <= 9) set("spellSlots", [...sheet.spellSlots, { level: nextLevel, total: 0, available: 0 }]);
            }}
          >
            Add slot level
          </button>
        )}

        <h4>
          Spells known / prepared
          {(() => {
            // One "X/Y label" counter per applicable category. A counter is hidden when the
            // player is exactly at the expected number (X === Y), and shown red when over it.
            const counter = (label: string, x: number, y: number | null | undefined) => {
              if (y === null || y === undefined || x === y) return null;
              return (
                <small key={label} style={{ marginLeft: "0.6rem", fontWeight: "normal", color: x > y ? "crimson" : undefined }}>
                  {x}/{y} {label}
                </small>
              );
            };
            const cantripsCount = sheet.spells.filter((s) => s.level === 0).length;
            const spellsKnownCount = sheet.spells.filter((s) => s.level >= 1).length;
            const preparedCount = sheet.spells.filter((s) => s.level >= 1 && s.prepared).length;
            return (
              <>
                {counter("cantrips known", cantripsCount, cantripsExpected)}
                {counter("spells known", spellsKnownCount, knownExpected)}
                {casterType === "prepared" && counter("spells prepared", preparedCount, maxPreparedSpells(sheet))}
              </>
            );
          })()}
        </h4>
        {sheet.spells.map((sp, i) => {
          const srdSpell = sp.srdId
            ? (SRD_SPELLS.find((s) => s.id === sp.srdId) ??
              (() => {
                const custom = customSpells.find((c) => `custom-${c.id}` === sp.srdId);
                return custom ? customSpellToSrdShape(custom) : undefined;
              })())
            : undefined;
          const isCustom = !sp.srdId;
          const effectiveAbility = sp.abilityOverride ?? sheet.spellcastingAbility;
          const effectiveAtkBonus = spellAttackBonusForAbility(sheet, effectiveAbility);
          const effectiveSaveDC = spellSaveDCForAbility(sheet, effectiveAbility);
          // Cantrips have no prepared flag -- always treated as prepared/castable.
          const preparedOrCantrip = sp.prepared || sp.level === 0;
          // Ritual-only casts (unprepared wizard spellbook rituals) and cantrips never spend a slot.
          const consumesSlot = sp.level >= 1 && sp.prepared;
          const candidateSlots = consumesSlot
            ? sheet.spellSlots.filter((s) => s.level >= sp.level && s.available > 0).sort((a, b) => a.level - b.level)
            : [];
          const hasSlot = candidateSlots.length > 0;

          function updateSpell(patch: Partial<Dnd5eSheetData["spells"][number]>) {
            set("spells", sheet.spells.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          }

          function consumeSlot() {
            if (candidateSlots.length === 0) return;
            const target = candidateSlots[0];
            set(
              "spellSlots",
              sheet.spellSlots.map((s) => (s.level === target.level ? { ...s, available: s.available - 1 } : s)),
            );
          }

          return (
            <div key={sp.id} style={{ marginBottom: "0.5rem", paddingBottom: "0.5rem", borderBottom: "1px solid #eee" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
                <strong style={{ minWidth: "8rem" }}>{sp.name || "(unnamed)"}</strong>
                {isCustom && (
                  <>
                    <input
                      placeholder="Spell name"
                      value={sp.name}
                      onChange={(e) => updateSpell({ name: e.target.value })}
                      style={{ flex: 1, minWidth: "8rem" }}
                    />
                    <input
                      type="number"
                      min={0}
                      max={9}
                      value={sp.level}
                      onChange={(e) => updateSpell({ level: Number(e.target.value) || 0 })}
                      style={{ width: "2.8rem" }}
                      title="Spell level (0 = cantrip)"
                    />
                  </>
                )}

                {srdSpell && (
                  <label>
                    Ability{" "}
                    <select
                      value={sp.abilityOverride ?? ""}
                      onChange={(e) =>
                        updateSpell({ abilityOverride: (e.target.value || undefined) as Dnd5eAbility | undefined })
                      }
                    >
                      <option value="">
                        default{sheet.spellcastingAbility ? ` (${sheet.spellcastingAbility.toUpperCase()})` : ""}
                      </option>
                      {DND5E_ABILITIES.map((a) => (
                        <option key={a} value={a}>
                          {a.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {sp.level !== 0 && (
                  <label>
                    <input
                      type="checkbox"
                      checked={sp.prepared}
                      onChange={(e) => updateSpell({ prepared: e.target.checked })}
                    />{" "}
                    Prepared
                  </label>
                )}
                <button type="button" onClick={() => set("spells", sheet.spells.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>

              {srdSpell && (
                <div style={{ fontSize: "0.85rem", color: "#555", marginTop: "0.2rem" }}>
                  {srdSpell.school} · {srdSpell.castingTime} · {srdSpell.range} · {srdSpell.duration}
                  {srdSpell.saveAbility && (
                    <>
                      {" "}
                      · {srdSpell.saveAbility.toUpperCase()} save (DC {effectiveSaveDC ?? "—"})
                    </>
                  )}
                  {srdSpell.requiresAttackRoll && (
                    <> · spell attack {effectiveAtkBonus !== null ? formatModifier(effectiveAtkBonus) : "—"}</>
                  )}
                  {srdSpell.damageDice && (
                    <>
                      {" "}
                      · {srdSpell.damageDice} {srdSpell.damageType}
                    </>
                  )}
                </div>
              )}
              {srdSpell && (preparedOrCantrip || (srdSpell.ritual && isWizardCaster)) && (
                <SpellCastControl
                  key={srdSpell.id + effectiveAbility}
                  spell={srdSpell}
                  spellAttackBonus={effectiveAtkBonus}
                  campaignId={character.campaignId}
                  ritualOnly={!preparedOrCantrip}
                  consumesSlot={consumesSlot}
                  hasSlot={hasSlot}
                  onConsumeSlot={consumeSlot}
                />
              )}
            </div>
          );
        })}
        <button type="button" onClick={() => setPickerOpen(true)}>
          Add spell
        </button>{" "}
        <button
          type="button"
          onClick={() =>
            set("spells", [...sheet.spells, { id: `spell-${Date.now()}`, name: "", level: 0, prepared: false }])
          }
        >
          Add custom spell
        </button>

        {pickerOpen && (
          <SpellPickerModal
            characterClass={sheet.class}
            characterLevel={sheet.level}
            currentSpells={sheet.spells}
            customSpells={customSpells}
            onToggle={(spell, adding) => {
              if (adding) {
                set("spells", [
                  ...sheet.spells,
                  { id: `spell-${Date.now()}`, srdId: spell.id, name: spell.name, level: spell.level, prepared: false },
                ]);
              } else {
                set("spells", sheet.spells.filter((s) => s.srdId !== spell.id));
              }
            }}
            onClose={() => setPickerOpen(false)}
          />
        )}
        {prepareSpellsOpen && (
          <PrepareSpellsModal
            sheet={sheet}
            onConfirm={(spells) => {
              set("spells", spells);
              setPrepareSpellsOpen(false);
            }}
            onClose={() => setPrepareSpellsOpen(false)}
          />
        )}
      </div>

      {/* Inventory */}
      <div style={box}>
        <h3>
          Inventory{" "}
          {(() => {
            const attunedCount = sheet.items.filter((item) => item.attuned).length;
            return (
              <small style={{ fontWeight: "normal", color: attunedCount > 3 ? "crimson" : "#666" }}>
                Attuned: {attunedCount} / 3
              </small>
            );
          })()}
        </h3>
        <datalist id="srd-magic-items-list">
          {SRD_MAGIC_ITEMS.map((mi) => (
            <option key={mi.id} value={mi.name} />
          ))}
          {SRD_WEAPONS.map((w) => (
            <option key={w.id} value={w.name} />
          ))}
          {SRD_ARMOR.map((a) => (
            <option key={a.id} value={a.name} />
          ))}
          {SRD_GEAR.map((g) => (
            <option key={g.id} value={g.name} />
          ))}
          {customItems.map((ci) => (
            <option key={ci.id} value={ci.name} />
          ))}
        </datalist>
        {sheet.items.map((item, i) => {
          function updateItem(patch: Partial<Dnd5eSheetData["items"][number]>) {
            set("items", sheet.items.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          }
          function handleNameChange(newName: string) {
            const weapon = findSrdWeapon(newName);
            const armor = findSrdArmor(newName);
            const gear = findSrdGear(newName);
            const customItem = customItems.find((ci) => ci.name.toLowerCase() === newName.trim().toLowerCase());
            if (weapon) {
              updateItem({ name: newName, weight: weapon.weight, notes: weaponDamageText(weapon), armor: undefined });
            } else if (armor) {
              updateItem({
                name: newName,
                weight: armor.weight,
                notes: armorACFormulaText(armor),
                armor: srdArmorToInventoryArmor(armor),
              });
            } else if (gear) {
              updateItem({ name: newName, weight: gear.weight, armor: undefined });
            } else if (customItem) {
              const d = customItem.data as CustomItemData;
              updateItem({
                name: newName,
                weight: d.weight,
                value: d.value,
                notes: customItemNotesText(customItem),
                abilityBonuses: d.abilityBonuses,
                acBonus: d.acBonus,
                armor: d.kind === "armor" ? customItemArmorPayload(d) : undefined,
              });
            } else {
              updateItem({ name: newName, armor: undefined });
            }
          }
          const hasBonuses =
            item.equipped || item.acBonus !== 0 || item.requiresAttunement || Object.values(item.abilityBonuses).some((v) => v);
          return (
            <div key={item.id} style={{ marginBottom: "0.5rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  placeholder="Item"
                  list="srd-magic-items-list"
                  value={item.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  min={0}
                  value={item.quantity}
                  onChange={(e) => updateItem({ quantity: Number(e.target.value) || 0 })}
                  style={{ width: "3.5rem" }}
                  title="Quantity"
                />
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={item.weight}
                  onChange={(e) => updateItem({ weight: Number(e.target.value) || 0 })}
                  style={{ width: "4rem" }}
                  title="Weight (lb, each)"
                />
                <input
                  type="number"
                  min={0}
                  value={item.value}
                  onChange={(e) => updateItem({ value: Number(e.target.value) || 0 })}
                  style={{ width: "4rem" }}
                  title="Value (gp, each) -- used when selling to a campaign shop"
                />
                <input
                  placeholder="Notes"
                  value={item.notes}
                  onChange={(e) => updateItem({ notes: e.target.value })}
                  style={{ flex: 1 }}
                />
                <label style={{ display: "flex", alignItems: "center", gap: "0.2rem", whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={item.equipped} onChange={(e) => updateItem({ equipped: e.target.checked })} />
                  Equipped
                </label>
                <label
                  style={{ display: "flex", alignItems: "center", gap: "0.2rem", whiteSpace: "nowrap" }}
                  title="Only grants this item's bonuses once attuned (if it requires attunement)"
                >
                  <input type="checkbox" checked={item.attuned} onChange={(e) => updateItem({ attuned: e.target.checked })} />
                  Attuned
                </label>
                <button
                  type="button"
                  title="Add a row to Attacks pre-filled with this item's name"
                  onClick={() => {
                    const weapon = findSrdWeapon(item.name);
                    const customWeapon = customItems.find(
                      (ci) => ci.name.toLowerCase() === item.name.trim().toLowerCase() && (ci.data as CustomItemData).kind === "weapon",
                    );
                    const customWeaponData = customWeapon?.data as CustomItemData | undefined;
                    set("attacks", [
                      ...sheet.attacks,
                      {
                        id: `atk-${Date.now()}`,
                        name: item.name,
                        ability: "str",
                        magicBonus: 0,
                        damageDice: weapon?.damageDice ?? customWeaponData?.damageDice ?? "",
                        damageType: weapon?.damageType ?? customWeaponData?.damageType ?? "",
                      },
                    ]);
                  }}
                >
                  Add to Attacks
                </button>
                <button type="button" onClick={() => set("items", sheet.items.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
              {hasBonuses && (
                <div
                  style={{
                    display: "flex",
                    gap: "0.6rem",
                    alignItems: "center",
                    flexWrap: "wrap",
                    marginTop: "0.25rem",
                    marginLeft: "0.5rem",
                    fontSize: "0.85rem",
                    color: "#555",
                  }}
                >
                  <span>When equipped:</span>
                  <label>
                    <input
                      type="checkbox"
                      checked={item.requiresAttunement}
                      onChange={(e) => updateItem({ requiresAttunement: e.target.checked })}
                    />{" "}
                    Requires attunement
                  </label>
                  <label>
                    AC{" "}
                    <input
                      type="number"
                      value={item.acBonus}
                      onChange={(e) => updateItem({ acBonus: Number(e.target.value) || 0 })}
                      style={{ width: "3rem" }}
                    />
                  </label>
                  {DND5E_ABILITIES.map((a) => (
                    <label key={a}>
                      {a.toUpperCase()}{" "}
                      <input
                        type="number"
                        value={item.abilityBonuses[a] ?? 0}
                        onChange={(e) =>
                          updateItem({
                            abilityBonuses: { ...item.abilityBonuses, [a]: Number(e.target.value) || 0 },
                          })
                        }
                        style={{ width: "2.8rem" }}
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <button
          type="button"
          onClick={() =>
            set("items", [
              ...sheet.items,
              {
                id: `item-${Date.now()}`,
                name: "",
                quantity: 1,
                weight: 0,
                notes: "",
                equipped: false,
                abilityBonuses: {},
                acBonus: 0,
                requiresAttunement: false,
                attuned: false,
                value: 0,
              },
            ])
          }
        >
          Add item
        </button>
        <p>
          Total weight: <strong>{totalInventoryWeight(sheet)} lb</strong>
        </p>

        <h4>Currency</h4>
        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          {(["cp", "sp", "ep", "gp", "pp"] as const).map((coin) => (
            <label key={coin}>
              {coin.toUpperCase()}{" "}
              <input
                type="number"
                min={0}
                value={sheet.currency[coin]}
                onChange={(e) => set("currency", { ...sheet.currency, [coin]: Number(e.target.value) || 0 })}
                style={{ width: "4rem" }}
              />
            </label>
          ))}
        </div>

        <h4>Other equipment notes</h4>
        <textarea value={sheet.equipmentText} onChange={(e) => set("equipmentText", e.target.value)} rows={3} style={{ width: "100%" }} />
      </div>

      {/* Wild Shape (Druid) */}
      {isDruid && <WildShapePanel sheet={sheet} setSheet={setSheet} campaignId={character.campaignId} />}

      {/* Pact Magic (Warlock): invocations, Mystic Arcanum, Pact Boon */}
      {isWarlock && (
        <div style={box}>
          <h3>Pact Magic</h3>

          <div style={{ marginBottom: "0.75rem" }}>
            <h4 style={{ marginBottom: "0.25rem" }}>Eldritch Invocations</h4>
            {(() => {
              const knownNames = new Set(
                sheet.features.filter((f) => f.name.startsWith(INVOCATION_PREFIX)).map((f) => f.name.slice(INVOCATION_PREFIX.length)),
              );
              const knownIds = new Set(SRD_INVOCATIONS.filter((inv) => knownNames.has(inv.name)).map((inv) => inv.id));
              const expected = expectedInvocationsKnown(sheet.level);
              return (
                <>
                  <p style={{ margin: "0.25rem 0" }}>
                    Known: <strong>{knownNames.size}</strong> (expected {expected} at level {sheet.level})
                  </p>
                  <button type="button" onClick={() => setInvocationPickerOpen(true)}>
                    Add invocation
                  </button>{" "}
                  <small style={{ color: "#666" }}>Manage individual invocations in Features &amp; traits below.</small>
                  {invocationPickerOpen && (
                    <InvocationPickerModal
                      level={sheet.level}
                      alreadyKnownIds={knownIds}
                      onPick={addInvocation}
                      onClose={() => setInvocationPickerOpen(false)}
                    />
                  )}
                </>
              );
            })()}
          </div>

          <div style={{ marginBottom: "0.75rem" }}>
            <h4 style={{ marginBottom: "0.25rem" }}>Mystic Arcanum</h4>
            {(() => {
              const unlocked = unlockedArcanumTiers(sheet.level);
              if (unlocked.length === 0) {
                return <p style={{ color: "#888" }}>Unlocks at level 11 (one 6th-level spell, castable once per long rest).</p>;
              }
              return (
                <>
                  {unlocked.map((tier) => {
                    const idx = sheet.mysticArcanum.findIndex((a) => a.spellLevel === tier);
                    if (idx === -1) {
                      return (
                        <p key={tier}>
                          <button type="button" onClick={() => addArcanumTier(tier as 6 | 7 | 8 | 9)}>
                            + Add {tier}th-level Arcanum slot
                          </button>
                        </p>
                      );
                    }
                    const entry = sheet.mysticArcanum[idx];
                    return (
                      <p key={tier} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <strong>{tier}th level:</strong>
                        <input
                          placeholder="Spell name"
                          value={entry.spellName}
                          onChange={(e) => updateArcanum(idx, { spellName: e.target.value })}
                        />
                        <label>
                          <input
                            type="checkbox"
                            checked={entry.used}
                            onChange={(e) => updateArcanum(idx, { used: e.target.checked })}
                          />{" "}
                          Used (resets on long rest)
                        </label>
                      </p>
                    );
                  })}
                </>
              );
            })()}
          </div>

          <div>
            <h4 style={{ marginBottom: "0.25rem" }}>Pact Boon</h4>
            {sheet.level < 3 ? (
              <p style={{ color: "#888" }}>Unlocks at level 3.</p>
            ) : (
              <>
                <select value={sheet.pactBoon} onChange={(e) => set("pactBoon", e.target.value as Dnd5eSheetData["pactBoon"])}>
                  <option value="">Not chosen</option>
                  <option value="chain">Pact of the Chain</option>
                  <option value="blade">Pact of the Blade</option>
                  <option value="tome">Pact of the Tome</option>
                </select>
                {sheet.pactBoon === "chain" && (
                  <p style={{ fontSize: "0.85rem", color: "#555" }}>
                    You learn the find familiar spell and can cast it as a ritual, with an expanded choice of familiar forms.
                  </p>
                )}
                {sheet.pactBoon === "blade" && (
                  <p style={{ fontSize: "0.85rem", color: "#555" }}>
                    You can use your action to create a pact weapon in your empty hand, which counts as magical for overcoming resistance.
                  </p>
                )}
                {sheet.pactBoon === "tome" && (
                  <p style={{ fontSize: "0.85rem", color: "#555" }}>
                    Your patron gives you a Book of Shadows containing three cantrips of your choice from any class's spell list.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Feats */}
      <div style={box}>
        <h3>Feats</h3>
        {sheet.feats.map((feat, i) => {
          function updateFeat(patch: Partial<Dnd5eSheetData["feats"][number]>) {
            set("feats", sheet.feats.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          }
          return (
            <div key={feat.id} style={{ marginBottom: "0.6rem", borderBottom: "1px solid #eee", paddingBottom: "0.5rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  placeholder="Feat name"
                  value={feat.name}
                  onChange={(e) => updateFeat({ name: e.target.value })}
                  style={{ flex: 1 }}
                />
                <button type="button" onClick={() => set("feats", sheet.feats.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
              <input
                placeholder="Description (optional)"
                value={feat.description}
                onChange={(e) => updateFeat({ description: e.target.value })}
                style={{ width: "100%", marginTop: "0.25rem" }}
              />
              <div
                style={{
                  display: "flex",
                  gap: "0.6rem",
                  alignItems: "center",
                  flexWrap: "wrap",
                  marginTop: "0.25rem",
                  fontSize: "0.85rem",
                  color: "#555",
                }}
              >
                <span>Bonuses:</span>
                {DND5E_ABILITIES.map((a) => (
                  <label key={a}>
                    {a.toUpperCase()}{" "}
                    <input
                      type="number"
                      value={feat.abilityBonuses[a] ?? 0}
                      onChange={(e) =>
                        updateFeat({ abilityBonuses: { ...feat.abilityBonuses, [a]: Number(e.target.value) || 0 } })
                      }
                      style={{ width: "2.6rem" }}
                    />
                  </label>
                ))}
                <label>
                  AC{" "}
                  <input type="number" value={feat.acBonus} onChange={(e) => updateFeat({ acBonus: Number(e.target.value) || 0 })} style={{ width: "2.6rem" }} />
                </label>
                <label>
                  Atk{" "}
                  <input type="number" value={feat.attackBonus} onChange={(e) => updateFeat({ attackBonus: Number(e.target.value) || 0 })} style={{ width: "2.6rem" }} />
                </label>
                <label>
                  Dmg{" "}
                  <input type="number" value={feat.damageBonus} onChange={(e) => updateFeat({ damageBonus: Number(e.target.value) || 0 })} style={{ width: "2.6rem" }} />
                </label>
                <label>
                  Spell DC{" "}
                  <input type="number" value={feat.spellDCBonus} onChange={(e) => updateFeat({ spellDCBonus: Number(e.target.value) || 0 })} style={{ width: "2.6rem" }} />
                </label>
                <label>
                  Spell atk{" "}
                  <input type="number" value={feat.spellAttackBonus} onChange={(e) => updateFeat({ spellAttackBonus: Number(e.target.value) || 0 })} style={{ width: "2.6rem" }} />
                </label>
              </div>
            </div>
          );
        })}
        <button type="button" onClick={() => setFeatPickerContext("standalone")}>
          Add feat
        </button>
        {featPickerContext !== null && (
          <FeatPickerModal customFeats={customFeats} onPick={addFeat} onClose={() => setFeatPickerContext(null)} />
        )}
      </div>

      {/* Features & traits */}
      <div style={box}>
        <h3>Features &amp; traits</h3>
        {sheet.features.map((feature, i) => {
          function updateFeature(patch: Partial<Dnd5eSheetData["features"][number]>) {
            set("features", sheet.features.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          }
          return (
            <div key={feature.id} style={{ marginBottom: "0.6rem", borderBottom: "1px solid #eee", paddingBottom: "0.5rem" }}>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  placeholder="Feature/trait name"
                  value={feature.name}
                  onChange={(e) => updateFeature({ name: e.target.value })}
                  style={{ flex: 1 }}
                />
                <button type="button" onClick={() => set("features", sheet.features.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
              <input
                placeholder="Description (optional)"
                value={feature.description}
                onChange={(e) => updateFeature({ description: e.target.value })}
                style={{ width: "100%", marginTop: "0.25rem" }}
              />
              <div
                style={{
                  display: "flex",
                  gap: "0.6rem",
                  alignItems: "center",
                  flexWrap: "wrap",
                  marginTop: "0.25rem",
                  fontSize: "0.85rem",
                  color: "#555",
                }}
              >
                <span>Bonuses:</span>
                {DND5E_ABILITIES.map((a) => (
                  <label key={a}>
                    {a.toUpperCase()}{" "}
                    <input
                      type="number"
                      value={feature.abilityBonuses[a] ?? 0}
                      onChange={(e) =>
                        updateFeature({ abilityBonuses: { ...feature.abilityBonuses, [a]: Number(e.target.value) || 0 } })
                      }
                      style={{ width: "2.6rem" }}
                    />
                  </label>
                ))}
                <label>
                  AC{" "}
                  <input type="number" value={feature.acBonus} onChange={(e) => updateFeature({ acBonus: Number(e.target.value) || 0 })} style={{ width: "2.6rem" }} />
                </label>
                <label>
                  Atk{" "}
                  <input type="number" value={feature.attackBonus} onChange={(e) => updateFeature({ attackBonus: Number(e.target.value) || 0 })} style={{ width: "2.6rem" }} />
                </label>
                <label>
                  Dmg{" "}
                  <input type="number" value={feature.damageBonus} onChange={(e) => updateFeature({ damageBonus: Number(e.target.value) || 0 })} style={{ width: "2.6rem" }} />
                </label>
                <label>
                  Spell DC{" "}
                  <input type="number" value={feature.spellDCBonus} onChange={(e) => updateFeature({ spellDCBonus: Number(e.target.value) || 0 })} style={{ width: "2.6rem" }} />
                </label>
                <label>
                  Spell atk{" "}
                  <input type="number" value={feature.spellAttackBonus} onChange={(e) => updateFeature({ spellAttackBonus: Number(e.target.value) || 0 })} style={{ width: "2.6rem" }} />
                </label>
              </div>
            </div>
          );
        })}
        <button
          type="button"
          onClick={() =>
            set("features", [
              ...sheet.features,
              {
                id: `feature-${Date.now()}`,
                name: "",
                description: "",
                abilityBonuses: {},
                acBonus: 0,
                attackBonus: 0,
                damageBonus: 0,
                spellDCBonus: 0,
                spellAttackBonus: 0,
              },
            ])
          }
        >
          Add feature
        </button>
      </div>

      {/* Text sections */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
        <label style={box}>
          Other notes / history <small style={{ color: "#777" }}>(freeform — the structured list above is now the source of truth)</small>
          <textarea value={sheet.featuresText} onChange={(e) => set("featuresText", e.target.value)} rows={5} style={{ width: "100%" }} />
        </label>
        <label style={box}>
          Proficiencies &amp; languages
          <textarea value={sheet.proficienciesText} onChange={(e) => set("proficienciesText", e.target.value)} rows={5} style={{ width: "100%" }} />
        </label>
        <label style={{ ...box, gridColumn: "1 / -1" }}>
          Personality, ideals, bonds &amp; flaws
          <textarea value={sheet.personalityText} onChange={(e) => set("personalityText", e.target.value)} rows={5} style={{ width: "100%" }} />
        </label>
        {isOwner && (
          <label style={{ ...box, gridColumn: "1 / -1" }}>
            Personal notes <small style={{ color: "#777" }}>(private — never visible to your DM)</small>
            <textarea
              value={sheet.privateNotes}
              onChange={(e) => set("privateNotes", e.target.value)}
              rows={5}
              style={{ width: "100%" }}
            />
          </label>
        )}
      </div>

      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {!readOnly && (
        <div style={{ fontSize: "1.1rem" }}>
          {autosaveStatus === "saving" && <span style={{ color: "#666" }}>Saving…</span>}
          {autosaveStatus === "pending" && <span style={{ color: "#666" }}>Unsaved changes…</span>}
          {autosaveStatus === "saved" && <span style={{ color: "green" }}>All changes saved ✓</span>}
          {autosaveStatus === "error" && (
            <span style={{ color: "crimson" }}>
              Save failed{autosaveError ? `: ${autosaveError}` : ""} —{" "}
              <button type="button" onClick={persist}>
                Retry
              </button>
            </span>
          )}
        </div>
      )}

      <div style={box}>
        <DiceRoller campaignId={character.campaignId} />
      </div>
      </fieldset>
    </div>
  );
}
