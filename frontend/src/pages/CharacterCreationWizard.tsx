import { useEffect, useMemo, useState } from "react";
import type { SystemId, Dnd5eAbility } from "shared";
import type { CustomRaceData, CustomSubraceData, CustomBackgroundData } from "shared";
import {
  SYSTEMS,
  DND5E_ABILITIES,
  DND5E_ABILITY_NAMES,
  DND5E_CLASSES,
  DND5E_SKILLS,
  DND5E_LANGUAGES,
  SRD_RACES,
  SRD_SUBRACES,
  SRD_BACKGROUNDS,
  DND5E_STANDARD_ARRAY,
  DND5E_POINT_BUY_COSTS,
  DND5E_POINT_BUY_BUDGET,
  abilityModifier,
  formatModifier,
  emptyDnd5eSheet,
  emptyPf2eSheet,
  recommendedStatPriority,
  normalizeClassId,
  customBackgroundDataSchema,
  expectedCantripsKnown,
  expectedSlots,
} from "shared";
import * as charactersApi from "../api/characters";
import * as diceApi from "../api/dice";
import { useCustomContent } from "../hooks/useCustomContent";
import { WizardSpellbookPicker, type PickedSpell } from "../components/systems/WizardSpellbookPicker";

type StatMethod = "roll" | "array" | "pointbuy" | "manual";

type Abilities = Record<Dnd5eAbility, number>;

const DEFAULT_ABILITIES: Abilities = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

const box: React.CSSProperties = { border: "1px solid #bbb", borderRadius: 6, padding: "1rem" };

export function CharacterCreationWizard({
  campaignId,
  onDone,
}: {
  campaignId: number | null;
  onDone: (characterId: number | null) => void;
}) {
  const [step, setStep] = useState<"system" | "basics" | "abilities" | "spellbook" | "warlock" | "review">("system");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const {
    classes: customClasses,
    races: customRaces,
    backgrounds: customBackgrounds,
    subraces: customSubraces,
  } = useCustomContent();

  // step 1
  const [name, setName] = useState("");
  const [system, setSystem] = useState<SystemId>("dnd5e");

  // step 2 (basics, 5e/pf2e)
  const [charClass, setCharClass] = useState("");
  const [raceOrAncestry, setRaceOrAncestry] = useState("");
  const [subrace, setSubrace] = useState("");
  const [background, setBackground] = useState("");
  const [level, setLevel] = useState(1);

  // step 3 (abilities)
  const [method, setMethod] = useState<StatMethod>("roll");
  const [abilities, setAbilities] = useState<Abilities>({ ...DEFAULT_ABILITIES });
  const [pool, setPool] = useState<number[]>([]);
  const [assignments, setAssignments] = useState<Partial<Record<Dnd5eAbility, number>>>({});
  const [rolling, setRolling] = useState(false);
  const [rollDetails, setRollDetails] = useState<string[]>([]);

  // spellbook (Wizard only)
  const [spellbookSpells, setSpellbookSpells] = useState<PickedSpell[]>([]);
  const [spellbookPickerOpen, setSpellbookPickerOpen] = useState(false);

  // warlock (Warlock only): starting cantrips (player choice, count from expectedCantripsKnown)
  // and Pact Boon (only relevant when starting at level >= 3, when the feature is already known).
  const [warlockCantrips, setWarlockCantrips] = useState<PickedSpell[]>([]);
  const [warlockCantripPickerOpen, setWarlockCantripPickerOpen] = useState(false);
  const [pactBoon, setPactBoon] = useState<"" | "chain" | "blade" | "tome">("");

  // review
  const [hpMax, setHpMax] = useState<string>("");
  const [notes, setNotes] = useState("");

  const isStructured = system === "dnd5e" || system === "pf2e";

  const pointsSpent = useMemo(
    () => DND5E_ABILITIES.reduce((sum, a) => sum + (DND5E_POINT_BUY_COSTS[abilities[a]] ?? 99), 0),
    [abilities],
  );

  const baseAbilities: Abilities = useMemo(() => {
    if (method === "roll" || method === "array") {
      const result = { ...DEFAULT_ABILITIES };
      for (const a of DND5E_ABILITIES) {
        if (assignments[a] !== undefined) result[a] = assignments[a]!;
      }
      return result;
    }
    return abilities;
  }, [method, abilities, assignments]);

  function raceBonusesFor(raceName: string): Partial<Record<Dnd5eAbility, number>> {
    if (system !== "dnd5e") return {};
    const custom = customRaces.find((r) => r.name.toLowerCase() === raceName.trim().toLowerCase());
    if (custom) return (custom.data as CustomRaceData).abilityBonuses;
    return SRD_RACES.find((r) => r.name.toLowerCase() === raceName.trim().toLowerCase())?.abilityBonuses ?? {};
  }

  const raceBonuses = useMemo(() => raceBonusesFor(raceOrAncestry), [raceOrAncestry, customRaces, system]);

  // Subraces whose parent matches the chosen race (SRD + approved/own-pending custom).
  const subraceOptions = useMemo(() => {
    if (system !== "dnd5e" || !raceOrAncestry.trim()) return [];
    const race = raceOrAncestry.trim().toLowerCase();
    const srd = SRD_SUBRACES.filter((s) => s.parentRace.toLowerCase() === race).map((s) => ({
      name: s.name,
      pending: false,
    }));
    const custom = customSubraces
      .filter((s) => (s.data as CustomSubraceData).parentRace.trim().toLowerCase() === race)
      .map((s) => ({ name: s.name, pending: s.status === "pending" }));
    return [...srd, ...custom];
  }, [system, raceOrAncestry, customSubraces]);

  function subraceBonusesFor(subraceName: string): Partial<Record<Dnd5eAbility, number>> {
    if (system !== "dnd5e" || !subraceName.trim()) return {};
    const custom = customSubraces.find((s) => s.name.toLowerCase() === subraceName.trim().toLowerCase());
    if (custom) return (custom.data as CustomSubraceData).abilityBonuses;
    return SRD_SUBRACES.find((s) => s.name.toLowerCase() === subraceName.trim().toLowerCase())?.abilityBonuses ?? {};
  }

  const subraceBonuses = useMemo(() => subraceBonusesFor(subrace), [subrace, customSubraces, system]);

  // Clear a stale subrace when the race changes so it can't be saved for a mismatched race.
  useEffect(() => {
    if (subrace && !subraceOptions.some((s) => s.name === subrace)) setSubrace("");
  }, [subraceOptions, subrace]);

  // Combined race + subrace ability bonuses -- both stack on top of the base scores.
  const raceAndSubraceBonuses = useMemo(() => {
    const combined: Partial<Record<Dnd5eAbility, number>> = { ...raceBonuses };
    for (const a of DND5E_ABILITIES) {
      const sub = subraceBonuses[a];
      if (sub) combined[a] = (combined[a] ?? 0) + sub;
    }
    return combined;
  }, [raceBonuses, subraceBonuses]);

  const statPriority = useMemo(
    () => (system === "dnd5e" ? recommendedStatPriority(charClass) : null),
    [system, charClass],
  );

  const isWizardClass = system === "dnd5e" && normalizeClassId(charClass) === "wizard";
  const isWarlockClass = system === "dnd5e" && normalizeClassId(charClass) === "warlock";
  const warlockCantripsExpected = expectedCantripsKnown("Warlock", level) ?? 2;

  // Background entries store skill proficiencies either as ids (SRD data) or as
  // human-typed names (custom content) -- resolve either against the skill list.
  function resolveSkillId(value: string): string | undefined {
    const trimmed = value.trim().toLowerCase();
    return DND5E_SKILLS.find((s) => s.id === trimmed || s.name.toLowerCase() === trimmed)?.id;
  }

  // Structured grant data for the selected background -- from custom content directly, or
  // synthesized from the (much sparser) SRD entry so both sources share one resolution path.
  const resolvedBackgroundData = useMemo((): CustomBackgroundData | null => {
    if (system !== "dnd5e" || !background.trim()) return null;
    const custom = customBackgrounds.find((b) => b.name.toLowerCase() === background.trim().toLowerCase());
    if (custom) return customBackgroundDataSchema.parse(custom.data);
    const srd = SRD_BACKGROUNDS.find((b) => b.name.toLowerCase() === background.trim().toLowerCase());
    if (srd) {
      return customBackgroundDataSchema.parse({
        skills: { fixed: srd.skillProficiencies },
        feature: { name: srd.feature },
      });
    }
    return null;
  }, [system, background, customBackgrounds]);

  const backgroundFixedSkillIds = useMemo(
    () => (resolvedBackgroundData?.skills.fixed ?? []).map(resolveSkillId).filter((id): id is string => id !== undefined),
    [resolvedBackgroundData],
  );

  const backgroundSkillNames = useMemo(
    () => backgroundFixedSkillIds.map((id) => DND5E_SKILLS.find((s) => s.id === id)?.name ?? id),
    [backgroundFixedSkillIds],
  );

  // Player selections for each of the background's choice slots -- reset whenever the chosen
  // background changes so a leftover pick from a previous background can't carry over.
  const [bgSkillChoiceSel, setBgSkillChoiceSel] = useState<string[][]>([]);
  const [bgToolChoiceSel, setBgToolChoiceSel] = useState<string[][]>([]);
  const [bgLanguageSel, setBgLanguageSel] = useState<string[]>([]);
  const [bgVariantSel, setBgVariantSel] = useState<string[]>([]);

  useEffect(() => {
    setBgSkillChoiceSel([]);
    setBgToolChoiceSel([]);
    setBgLanguageSel([]);
    setBgVariantSel([]);
  }, [background]);

  function skillChoiceOptions(choice: NonNullable<typeof resolvedBackgroundData>["skills"]["choices"][number]) {
    if (choice.from.kind === "list") {
      return choice.from.skillIds.map(resolveSkillId).filter((id): id is string => id !== undefined);
    }
    if (choice.from.kind === "ability") {
      return DND5E_SKILLS.filter((s) => choice.from.kind === "ability" && choice.from.abilities.includes(s.ability)).map(
        (s) => s.id,
      );
    }
    return DND5E_SKILLS.map((s) => s.id);
  }

  function toggleSkillChoice(rowIndex: number, count: number, skillId: string) {
    setBgSkillChoiceSel((prev) => {
      const next = prev.slice();
      const current = next[rowIndex] ?? [];
      if (current.includes(skillId)) {
        next[rowIndex] = current.filter((id) => id !== skillId);
      } else if (current.length < count) {
        next[rowIndex] = [...current, skillId];
      } else {
        next[rowIndex] = current;
      }
      return next;
    });
  }

  function toggleToolChoice(rowIndex: number, count: number, option: string) {
    setBgToolChoiceSel((prev) => {
      const next = prev.slice();
      const current = next[rowIndex] ?? [];
      if (current.includes(option)) {
        next[rowIndex] = current.filter((o) => o !== option);
      } else if (current.length < count) {
        next[rowIndex] = [...current, option];
      } else {
        next[rowIndex] = current;
      }
      return next;
    });
  }

  function toggleLanguage(count: number, lang: string) {
    setBgLanguageSel((prev) => {
      if (prev.includes(lang)) return prev.filter((l) => l !== lang);
      if (prev.length < count) return [...prev, lang];
      return prev;
    });
  }

  function toggleVariant(count: number, variantId: string) {
    setBgVariantSel((prev) => {
      if (prev.includes(variantId)) return prev.filter((v) => v !== variantId);
      if (count <= 1) return [variantId];
      if (prev.length < count) return [...prev, variantId];
      return prev;
    });
  }

  const backgroundChoicesComplete = useMemo(() => {
    if (!resolvedBackgroundData) return true;
    const skillOk = resolvedBackgroundData.skills.choices.every(
      (c, i) => (bgSkillChoiceSel[i]?.length ?? 0) === c.count,
    );
    const toolOk = resolvedBackgroundData.tools.choices.every((c, i) => (bgToolChoiceSel[i]?.length ?? 0) === c.count);
    const langOk = bgLanguageSel.length === resolvedBackgroundData.languages.anyCount;
    const variantOk =
      resolvedBackgroundData.variants.length === 0 || bgVariantSel.length === resolvedBackgroundData.variantPickCount;
    return skillOk && toolOk && langOk && variantOk;
  }, [resolvedBackgroundData, bgSkillChoiceSel, bgToolChoiceSel, bgLanguageSel, bgVariantSel]);

  const backgroundGrantSkillIds = useMemo(
    () => Array.from(new Set([...backgroundFixedSkillIds, ...bgSkillChoiceSel.flat()])),
    [backgroundFixedSkillIds, bgSkillChoiceSel],
  );

  // Everything from the background that isn't a skill proficiency (tools/languages as text,
  // the feature + any chosen variants as structured feature entries, equipment as items/gold).
  function backgroundGrants() {
    const data = resolvedBackgroundData;
    if (!data) {
      return {
        proficienciesText: "",
        features: [] as ReturnType<typeof emptyDnd5eSheet>["features"],
        items: [] as ReturnType<typeof emptyDnd5eSheet>["items"],
        gold: 0,
      };
    }

    const toolNames = [...data.tools.fixed, ...bgToolChoiceSel.flat()];
    const languageNames = [...data.languages.fixed, ...bgLanguageSel];
    const profLines: string[] = [];
    if (toolNames.length) profLines.push(`Tool Proficiencies: ${toolNames.join(", ")}`);
    if (languageNames.length) profLines.push(`Languages: ${languageNames.join(", ")}`);

    const features: ReturnType<typeof emptyDnd5eSheet>["features"] = [];
    if (data.feature.name) {
      features.push({
        id: `bg-feature-${Date.now()}`,
        name: data.feature.name,
        description: data.feature.description,
        abilityBonuses: {},
        acBonus: 0,
        attackBonus: 0,
        damageBonus: 0,
        spellDCBonus: 0,
        spellAttackBonus: 0,
        skillProficiencies: [],
      });
    }
    for (const variantId of bgVariantSel) {
      const variant = data.variants.find((v) => v.id === variantId);
      if (!variant) continue;
      features.push({
        id: `bg-variant-${variant.id}-${Date.now()}`,
        name: variant.title,
        description: variant.description,
        abilityBonuses: {},
        skillProficiencies: [],
        acBonus: 0,
        attackBonus: 0,
        damageBonus: 0,
        spellDCBonus: 0,
        spellAttackBonus: 0,
      });
    }

    const items: ReturnType<typeof emptyDnd5eSheet>["items"] = data.equipment.items.map((name, i) => ({
      id: `bg-item-${Date.now()}-${i}`,
      name,
      quantity: 1,
      weight: 0,
      notes: "",
      equipped: false,
      abilityBonuses: {},
      acBonus: 0,
      requiresAttunement: false,
      attuned: false,
      value: 0,
    }));

    return { proficienciesText: profLines.join("\n"), features, items, gold: data.equipment.gold };
  }

  // The racial (race + subrace) ability bonuses are applied on top of the base scores from
  // whichever generation method was used — this combined value is what
  // actually gets saved as the character's abilities.
  const finalAbilities: Abilities = useMemo(() => {
    const result = { ...baseAbilities };
    for (const a of DND5E_ABILITIES) {
      result[a] = baseAbilities[a] + (raceAndSubraceBonuses[a] ?? 0);
    }
    return result;
  }, [baseAbilities, raceAndSubraceBonuses]);

  // "Ability modifier + level" spells prepared by default at creation, min 1.
  const wizardPrepCap = Math.max(1, abilityModifier(finalAbilities.int) + level);

  const assignmentComplete = DND5E_ABILITIES.every((a) => assignments[a] !== undefined);

  async function rollStats() {
    setRolling(true);
    setError(null);
    try {
      const totals: number[] = [];
      const details: string[] = [];
      for (let i = 0; i < 6; i++) {
        const roll = await diceApi.createRoll(null, "4d6kh3", `Ability score roll ${i + 1}`);
        totals.push(roll.total);
        details.push(roll.breakdown);
      }
      setPool(totals);
      setRollDetails(details);
      setAssignments({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Rolling failed");
    } finally {
      setRolling(false);
    }
  }

  function selectMethod(m: StatMethod) {
    setMethod(m);
    setAssignments({});
    setRollDetails([]);
    if (m === "array") setPool([...DND5E_STANDARD_ARRAY]);
    else if (m === "roll") setPool([]);
    else if (m === "pointbuy") setAbilities({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
    else setAbilities({ ...DEFAULT_ABILITIES });
  }

  // Values still assignable: pool minus already-assigned (by count)
  function availableFor(ability: Dnd5eAbility): number[] {
    const used = new Map<number, number>();
    for (const a of DND5E_ABILITIES) {
      if (a !== ability && assignments[a] !== undefined) {
        used.set(assignments[a]!, (used.get(assignments[a]!) ?? 0) + 1);
      }
    }
    const avail: number[] = [];
    const seen = new Map<number, number>();
    for (const v of pool) {
      seen.set(v, (seen.get(v) ?? 0) + 1);
      if (seen.get(v)! > (used.get(v) ?? 0) && !avail.includes(v)) avail.push(v);
    }
    return avail.sort((a, b) => b - a);
  }

  function hitDieForClass(className: string): number | undefined {
    const custom = customClasses.find((c) => c.name.toLowerCase() === className.trim().toLowerCase());
    if (custom) return (custom.data as { hitDie: number }).hitDie;
    return DND5E_CLASSES.find((c) => c.name.toLowerCase() === className.trim().toLowerCase())?.hitDie;
  }

  const suggestedHp = useMemo(() => {
    if (system !== "dnd5e") return null;
    const hitDie = hitDieForClass(charClass);
    if (hitDie === undefined) return null;
    return hitDie + abilityModifier(finalAbilities.con);
  }, [system, charClass, finalAbilities, customClasses]);

  async function create() {
    setCreating(true);
    setError(null);
    try {
      let sheetData: unknown;
      if (system === "dnd5e") {
        const grants = backgroundGrants();
        sheetData = {
          ...emptyDnd5eSheet(),
          class: charClass,
          race: raceOrAncestry,
          subrace,
          background,
          level,
          abilities: finalAbilities,
          skillProficiencies: backgroundGrantSkillIds,
          proficienciesText: grants.proficienciesText,
          features: grants.features,
          items: grants.items,
          currency: { ...emptyDnd5eSheet().currency, gp: grants.gold },
          hitDice: hitDieForClass(charClass) !== undefined ? `${level}d${hitDieForClass(charClass)}` : "",
          hitDiceTotal: level,
          hitDiceAvailable: level,
          // Level-1 entry only (die-only, CON excluded) -- matches suggestedHp's formula and
          // seeds computeHpMax() for later level-ups; starting above level 1 doesn't backfill
          // history for the skipped levels, same simplification already made for suggestedHp.
          hpDiceHistory: hitDieForClass(charClass) !== undefined ? [hitDieForClass(charClass)!] : [],
          spellcastingAbility: isWizardClass ? "int" : isWarlockClass ? "cha" : "",
          spells: isWizardClass
            ? spellbookSpells.map((s, i) => ({
                id: `spell-${Date.now()}-${i}`,
                srdId: s.id,
                name: s.name,
                level: s.level,
                prepared: i < wizardPrepCap,
              }))
            : isWarlockClass
              ? warlockCantrips.map((s, i) => ({
                  id: `spell-${Date.now()}-${i}`,
                  srdId: s.id,
                  name: s.name,
                  level: 0,
                  prepared: false,
                }))
              : [],
          // Pact Magic slots are fixed by level (no player choice, unlike which cantrips/spells
          // are known) -- seed them from the same table the sheet's "Set to expected" button uses,
          // so a Warlock isn't created with an empty Spell slots block.
          spellSlots: isWarlockClass
            ? Object.entries(expectedSlots("Warlock", level)).map(([lvl, total]) => ({
                level: Number(lvl),
                total,
                available: total,
              }))
            : [],
          pactBoon: isWarlockClass && level >= 3 ? pactBoon : "",
        };
      } else if (system === "pf2e") {
        sheetData = {
          ...emptyPf2eSheet(),
          class: charClass,
          ancestry: raceOrAncestry,
          background,
          level,
          abilities: finalAbilities,
        };
      } else {
        sheetData = [];
      }

      const hp = hpMax === "" ? null : Number(hpMax);
      const character = await charactersApi.createCharacter({
        campaignId,
        name,
        system,
        hpCurrent: hp,
        hpMax: hp,
        notes: notes || undefined,
        sheetData,
      });
      onDone(character.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create character");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "0 1rem 2rem" }}>
      <button onClick={() => onDone(null)}>&larr; Cancel</button>
      <h1>New character</h1>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {step === "system" && (
        <div style={box}>
          <label>
            Name
            <br />
            <input value={name} onChange={(e) => setName(e.target.value)} style={{ fontSize: "1.1rem", width: "100%" }} />
          </label>
          <h3>Game system</h3>
          {(Object.keys(SYSTEMS) as SystemId[]).map((id) => (
            <label key={id} style={{ display: "block", marginBottom: "0.4rem" }}>
              <input type="radio" name="system" checked={system === id} onChange={() => setSystem(id)} />{" "}
              {SYSTEMS[id].name}
            </label>
          ))}
          <button
            disabled={name.trim() === ""}
            onClick={() => {
              if (isStructured) {
                setStep("basics");
              } else {
                setStep("review");
              }
            }}
          >
            Next
          </button>
        </div>
      )}

      {step === "basics" && (
        <div style={box}>
          <h3>Basics</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            <label>
              Class
              <br />
              {system === "dnd5e" ? (
                <>
                  <select
                    value={
                      DND5E_CLASSES.some((c) => c.name.toLowerCase() === charClass.trim().toLowerCase()) ||
                      customClasses.some((c) => c.name.toLowerCase() === charClass.trim().toLowerCase())
                        ? charClass
                        : "__other__"
                    }
                    onChange={(e) => setCharClass(e.target.value === "__other__" ? "" : e.target.value)}
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
                  {!DND5E_CLASSES.some((c) => c.name.toLowerCase() === charClass.trim().toLowerCase()) &&
                    !customClasses.some((c) => c.name.toLowerCase() === charClass.trim().toLowerCase()) && (
                    <input
                      placeholder="Homebrew class name"
                      value={charClass}
                      onChange={(e) => setCharClass(e.target.value)}
                      style={{ marginLeft: "0.4rem" }}
                    />
                  )}
                </>
              ) : (
                <input value={charClass} onChange={(e) => setCharClass(e.target.value)} />
              )}
            </label>
            <label>
              {system === "pf2e" ? "Ancestry" : "Race"}
              <br />
              {system === "dnd5e" ? (
                <>
                  <select
                    value={
                      SRD_RACES.some((r) => r.name.toLowerCase() === raceOrAncestry.trim().toLowerCase()) ||
                      customRaces.some((r) => r.name.toLowerCase() === raceOrAncestry.trim().toLowerCase())
                        ? raceOrAncestry
                        : "__other__"
                    }
                    onChange={(e) => setRaceOrAncestry(e.target.value === "__other__" ? "" : e.target.value)}
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
                  {!SRD_RACES.some((r) => r.name.toLowerCase() === raceOrAncestry.trim().toLowerCase()) &&
                    !customRaces.some((r) => r.name.toLowerCase() === raceOrAncestry.trim().toLowerCase()) && (
                    <input
                      placeholder="Homebrew race name"
                      value={raceOrAncestry}
                      onChange={(e) => setRaceOrAncestry(e.target.value)}
                      style={{ marginLeft: "0.4rem" }}
                    />
                  )}
                </>
              ) : (
                <input value={raceOrAncestry} onChange={(e) => setRaceOrAncestry(e.target.value)} />
              )}
            </label>
            {system === "dnd5e" && subraceOptions.length > 0 && (
              <label>
                Subrace
                <br />
                <select value={subrace} onChange={(e) => setSubrace(e.target.value)}>
                  <option value="">(none)</option>
                  {subraceOptions.map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.name}
                      {s.pending ? " (pending)" : ""}
                    </option>
                  ))}
                </select>
                {Object.keys(subraceBonuses).length > 0 && (
                  <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.2rem" }}>
                    {Object.entries(subraceBonuses)
                      .map(([a, b]) => `${a.toUpperCase()} ${formatModifier(b!)}`)
                      .join(", ")}{" "}
                    — stacks on top of the race bonus.
                  </div>
                )}
              </label>
            )}
            <label>
              Background
              <br />
              {system === "dnd5e" ? (
                <>
                  <select
                    value={
                      SRD_BACKGROUNDS.some((b) => b.name.toLowerCase() === background.trim().toLowerCase()) ||
                      customBackgrounds.some((b) => b.name.toLowerCase() === background.trim().toLowerCase())
                        ? background
                        : "__other__"
                    }
                    onChange={(e) => setBackground(e.target.value === "__other__" ? "" : e.target.value)}
                  >
                    {SRD_BACKGROUNDS.map((b) => (
                      <option key={b.id} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                    {customBackgrounds.length > 0 && (
                      <optgroup label="Custom">
                        {customBackgrounds.map((b) => (
                          <option key={b.id} value={b.name}>
                            {b.name}
                            {b.status === "pending" ? " (pending)" : ""}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <option value="__other__">Other (homebrew)</option>
                  </select>
                  {!SRD_BACKGROUNDS.some((b) => b.name.toLowerCase() === background.trim().toLowerCase()) &&
                    !customBackgrounds.some((b) => b.name.toLowerCase() === background.trim().toLowerCase()) && (
                    <input
                      placeholder="Homebrew background name"
                      value={background}
                      onChange={(e) => setBackground(e.target.value)}
                      style={{ marginLeft: "0.4rem" }}
                    />
                  )}
                  {backgroundSkillNames.length > 0 && (
                    <p>
                      <small>
                        <strong>{background}</strong> grants proficiency in: {backgroundSkillNames.join(", ")} —
                        applied automatically.
                      </small>
                    </p>
                  )}
                  {resolvedBackgroundData && resolvedBackgroundData.skills.choices.length > 0 && (
                    <div style={{ marginTop: "0.5rem" }}>
                      {resolvedBackgroundData.skills.choices.map((choice, i) => (
                        <div key={i} style={{ marginBottom: "0.4rem" }}>
                          <small>
                            Choose {choice.count} skill{choice.count > 1 ? "s" : ""} ({(bgSkillChoiceSel[i]?.length ?? 0)}/
                            {choice.count} selected):
                          </small>
                          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            {skillChoiceOptions(choice).map((skillId) => (
                              <label key={skillId} style={{ fontSize: "0.85rem" }}>
                                <input
                                  type="checkbox"
                                  checked={(bgSkillChoiceSel[i] ?? []).includes(skillId)}
                                  onChange={() => toggleSkillChoice(i, choice.count, skillId)}
                                />{" "}
                                {DND5E_SKILLS.find((s) => s.id === skillId)?.name ?? skillId}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {resolvedBackgroundData && resolvedBackgroundData.tools.choices.length > 0 && (
                    <div style={{ marginTop: "0.5rem" }}>
                      {resolvedBackgroundData.tools.choices.map((choice, i) => (
                        <div key={i} style={{ marginBottom: "0.4rem" }}>
                          <small>
                            Choose {choice.count} tool{choice.count > 1 ? "s" : ""} ({(bgToolChoiceSel[i]?.length ?? 0)}/
                            {choice.count} selected):
                          </small>
                          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                            {choice.from.map((option) => (
                              <label key={option} style={{ fontSize: "0.85rem" }}>
                                <input
                                  type="checkbox"
                                  checked={(bgToolChoiceSel[i] ?? []).includes(option)}
                                  onChange={() => toggleToolChoice(i, choice.count, option)}
                                />{" "}
                                {option}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {resolvedBackgroundData && resolvedBackgroundData.languages.anyCount > 0 && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <small>
                        Choose {resolvedBackgroundData.languages.anyCount} language
                        {resolvedBackgroundData.languages.anyCount > 1 ? "s" : ""} ({bgLanguageSel.length}/
                        {resolvedBackgroundData.languages.anyCount} selected):
                      </small>
                      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        {DND5E_LANGUAGES.filter((lang) => !resolvedBackgroundData.languages.fixed.includes(lang)).map(
                          (lang) => (
                            <label key={lang} style={{ fontSize: "0.85rem" }}>
                              <input
                                type="checkbox"
                                checked={bgLanguageSel.includes(lang)}
                                onChange={() => toggleLanguage(resolvedBackgroundData.languages.anyCount, lang)}
                              />{" "}
                              {lang}
                            </label>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                  {resolvedBackgroundData && resolvedBackgroundData.variants.length > 0 && (
                    <div style={{ marginTop: "0.5rem" }}>
                      <small>
                        Choose {resolvedBackgroundData.variantPickCount} ({bgVariantSel.length}/
                        {resolvedBackgroundData.variantPickCount} selected):
                      </small>
                      {resolvedBackgroundData.variants.map((v) => (
                        <label
                          key={v.id}
                          style={{
                            display: "block",
                            border: "1px solid #ddd",
                            borderRadius: 6,
                            padding: "0.4rem",
                            marginTop: "0.3rem",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={bgVariantSel.includes(v.id)}
                            onChange={() => toggleVariant(resolvedBackgroundData.variantPickCount, v.id)}
                          />{" "}
                          <strong>{v.title}</strong>
                          {v.description && <div style={{ fontSize: "0.8rem", color: "#666" }}>{v.description}</div>}
                        </label>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <input value={background} onChange={(e) => setBackground(e.target.value)} />
              )}
            </label>
            <label>
              Level
              <br />
              <input
                type="number"
                min={1}
                max={20}
                value={level}
                onChange={(e) => setLevel(Number(e.target.value) || 1)}
                style={{ width: "4rem" }}
              />
            </label>
          </div>
          {!backgroundChoicesComplete && (
            <p>
              <small style={{ color: "crimson" }}>Finish the background's choices above before continuing.</small>
            </p>
          )}
          <p>
            <button onClick={() => setStep("system")}>Back</button>{" "}
            <button onClick={() => setStep("abilities")} disabled={!backgroundChoicesComplete}>
              Next: ability scores
            </button>
          </p>
        </div>
      )}

      {step === "abilities" && (
        <div style={box}>
          <h3>Ability scores</h3>
          {system === "dnd5e" && Object.keys(raceAndSubraceBonuses).length > 0 && (
            <p>
              <strong>{[raceOrAncestry, subrace].filter(Boolean).join(" / ")}</strong> racial bonus:{" "}
              {Object.entries(raceAndSubraceBonuses)
                .map(([a, bonus]) => `${a.toUpperCase()} ${formatModifier(bonus!)}`)
                .join(", ")}{" "}
              — applied automatically on top of the scores below.
            </p>
          )}
          {statPriority && (
            <p>
              <strong>{charClass}</strong> recommended priority:{" "}
              {statPriority.map((a) => DND5E_ABILITY_NAMES[a]).join(" > ")}.
            </p>
          )}
          <p>
            {(
              [
                ["roll", "Roll 4d6 drop lowest"],
                ["array", "Standard array"],
                ["pointbuy", "Point buy"],
                ["manual", "Manual entry"],
              ] as [StatMethod, string][]
            ).map(([m, label]) => (
              <label key={m} style={{ marginRight: "1rem" }}>
                <input type="radio" name="method" checked={method === m} onChange={() => selectMethod(m)} /> {label}
              </label>
            ))}
          </p>

          {method === "roll" && (
            <div>
              <button onClick={rollStats} disabled={rolling}>
                {rolling ? "Rolling…" : pool.length > 0 ? "Reroll all six" : "Roll 4d6 drop lowest ×6"}
              </button>
              {rollDetails.length > 0 && (
                <ul>
                  {rollDetails.map((d, i) => (
                    <li key={i}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {(method === "roll" || method === "array") && pool.length > 0 && (
            <div>
              <p>Assign your scores ({pool.join(", ")}):</p>
              {DND5E_ABILITIES.map((a) => (
                <div key={a} style={{ marginBottom: "0.3rem" }}>
                  <span style={{ display: "inline-block", width: "7rem" }}>{DND5E_ABILITY_NAMES[a]}</span>
                  <select
                    value={assignments[a] ?? ""}
                    onChange={(e) =>
                      setAssignments((prev) => ({
                        ...prev,
                        [a]: e.target.value === "" ? undefined : Number(e.target.value),
                      }))
                    }
                  >
                    <option value="">—</option>
                    {availableFor(a).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                    {assignments[a] !== undefined && !availableFor(a).includes(assignments[a]!) && (
                      <option value={assignments[a]}>{assignments[a]}</option>
                    )}
                  </select>
                  {assignments[a] !== undefined && (
                    <>
                      <strong style={{ marginLeft: "0.5rem" }}>{formatModifier(abilityModifier(assignments[a]!))}</strong>
                      {(raceAndSubraceBonuses[a] ?? 0) !== 0 && (
                        <small style={{ marginLeft: "0.5rem" }}>
                          {formatModifier(raceAndSubraceBonuses[a]!)} racial = {finalAbilities[a]} (
                          {formatModifier(abilityModifier(finalAbilities[a]))})
                        </small>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {(method === "pointbuy" || method === "manual") && (
            <div>
              {method === "pointbuy" && (
                <p>
                  Points spent: <strong>{pointsSpent}</strong> / {DND5E_POINT_BUY_BUDGET}
                  {pointsSpent > DND5E_POINT_BUY_BUDGET && <span style={{ color: "crimson" }}> — over budget!</span>}
                </p>
              )}
              {DND5E_ABILITIES.map((a) => (
                <div key={a} style={{ marginBottom: "0.3rem" }}>
                  <span style={{ display: "inline-block", width: "7rem" }}>{DND5E_ABILITY_NAMES[a]}</span>
                  <input
                    type="number"
                    min={method === "pointbuy" ? 8 : 1}
                    max={method === "pointbuy" ? 15 : 30}
                    value={abilities[a]}
                    onChange={(e) =>
                      setAbilities((prev) => ({ ...prev, [a]: Number(e.target.value) || (method === "pointbuy" ? 8 : 10) }))
                    }
                    style={{ width: "4rem" }}
                  />
                  <strong style={{ marginLeft: "0.5rem" }}>{formatModifier(abilityModifier(abilities[a]))}</strong>
                  {method === "pointbuy" && (
                    <small style={{ marginLeft: "0.5rem" }}>cost {DND5E_POINT_BUY_COSTS[abilities[a]] ?? "—"}</small>
                  )}
                  {(raceAndSubraceBonuses[a] ?? 0) !== 0 && (
                    <small style={{ marginLeft: "0.5rem" }}>
                      {formatModifier(raceAndSubraceBonuses[a]!)} racial = {finalAbilities[a]} (
                      {formatModifier(abilityModifier(finalAbilities[a]))})
                    </small>
                  )}
                </div>
              ))}
            </div>
          )}

          <p>
            <button onClick={() => setStep("basics")}>Back</button>{" "}
            <button
              onClick={() => setStep(isWizardClass ? "spellbook" : isWarlockClass ? "warlock" : "review")}
              disabled={
                (method === "roll" || method === "array") ? !assignmentComplete :
                method === "pointbuy" ? pointsSpent > DND5E_POINT_BUY_BUDGET : false
              }
            >
              {isWizardClass ? "Next: spellbook" : isWarlockClass ? "Next: warlock" : "Next: review"}
            </button>
          </p>
        </div>
      )}

      {step === "spellbook" && (
        <div style={box}>
          <h3>Spellbook</h3>
          <p>
            <small>
              Wizards start with 6 first-level spells in their spellbook. Up to {wizardPrepCap} of them (Intelligence
              modifier + level) are prepared by default — the rest stay in the spellbook, ready to prepare later.
            </small>
          </p>
          <p>
            {spellbookSpells.length} / 6 chosen
            {spellbookSpells.length > 0 && ": " + spellbookSpells.map((s) => s.name).join(", ")}
          </p>
          <button type="button" onClick={() => setSpellbookPickerOpen(true)}>
            {spellbookSpells.length > 0 ? "Change spells" : "Choose spells"}
          </button>
          {spellbookPickerOpen && (
            <WizardSpellbookPicker
              title="Choose 6 first-level spells for your spellbook"
              requiredCount={6}
              maxLevel={1}
              onlyLevel={1}
              excludeIds={[]}
              onConfirm={(spells) => {
                setSpellbookSpells(spells);
                setSpellbookPickerOpen(false);
              }}
              onClose={() => setSpellbookPickerOpen(false)}
            />
          )}
          <p>
            <button onClick={() => setStep("abilities")}>Back</button>{" "}
            <button onClick={() => setStep("review")} disabled={spellbookSpells.length !== 6}>
              Next: review
            </button>
          </p>
        </div>
      )}

      {step === "warlock" && (
        <div style={box}>
          <h3>Warlock</h3>
          <p>
            <small>
              Choose {warlockCantripsExpected} cantrip{warlockCantripsExpected === 1 ? "" : "s"} from the Warlock spell list.
            </small>
          </p>
          <p>
            {warlockCantrips.length} / {warlockCantripsExpected} chosen
            {warlockCantrips.length > 0 && ": " + warlockCantrips.map((s) => s.name).join(", ")}
          </p>
          <button type="button" onClick={() => setWarlockCantripPickerOpen(true)}>
            {warlockCantrips.length > 0 ? "Change cantrips" : "Choose cantrips"}
          </button>
          {warlockCantripPickerOpen && (
            <WizardSpellbookPicker
              title={`Choose ${warlockCantripsExpected} Warlock cantrip${warlockCantripsExpected === 1 ? "" : "s"}`}
              requiredCount={warlockCantripsExpected}
              maxLevel={0}
              onlyLevel={0}
              classId="warlock"
              excludeIds={[]}
              onConfirm={(spells) => {
                setWarlockCantrips(spells);
                setWarlockCantripPickerOpen(false);
              }}
              onClose={() => setWarlockCantripPickerOpen(false)}
            />
          )}

          {level >= 3 && (
            <div style={{ marginTop: "1rem" }}>
              <h4 style={{ marginBottom: "0.25rem" }}>Pact Boon</h4>
              <p>
                <small>Starting at level 3 or higher, choose the boon your patron grants (can also be set later on the sheet).</small>
              </p>
              <select value={pactBoon} onChange={(e) => setPactBoon(e.target.value as typeof pactBoon)}>
                <option value="">Not chosen yet</option>
                <option value="chain">Pact of the Chain</option>
                <option value="blade">Pact of the Blade</option>
                <option value="tome">Pact of the Tome</option>
              </select>
            </div>
          )}

          <p>
            <button onClick={() => setStep("abilities")}>Back</button>{" "}
            <button onClick={() => setStep("review")} disabled={warlockCantrips.length !== warlockCantripsExpected}>
              Next: review
            </button>
          </p>
        </div>
      )}

      {step === "review" && (
        <div style={box}>
          <h3>Review</h3>
          <p>
            <strong>{name}</strong> — {SYSTEMS[system].name}
            {isStructured && (
              <>
                {" "}
                · {charClass || "no class"} {level} · {[raceOrAncestry, subrace].filter(Boolean).join(" / ") || "—"}
              </>
            )}
            {campaignId !== null && " · will be added to this campaign"}
          </p>
          {isStructured && (
            <ul>
              {DND5E_ABILITIES.map((a) => {
                const bonus = raceAndSubraceBonuses[a] ?? 0;
                return (
                  <li key={a}>
                    {DND5E_ABILITY_NAMES[a]}:{" "}
                    {bonus !== 0 ? (
                      <>
                        {baseAbilities[a]} base {formatModifier(bonus)} racial ={" "}
                        <strong>{finalAbilities[a]}</strong> ({formatModifier(abilityModifier(finalAbilities[a]))})
                      </>
                    ) : (
                      <>
                        {finalAbilities[a]} ({formatModifier(abilityModifier(finalAbilities[a]))})
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <label>
            Max HP{suggestedHp !== null && ` (suggested for level-1 ${charClass}: ${suggestedHp})`}
            <br />
            <input type="number" value={hpMax} onChange={(e) => setHpMax(e.target.value)} style={{ width: "5rem" }} />
            {suggestedHp !== null && hpMax === "" && (
              <button type="button" onClick={() => setHpMax(String(suggestedHp))} style={{ marginLeft: "0.5rem" }}>
                Use suggestion
              </button>
            )}
          </label>
          <br />
          <label>
            Notes
            <br />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} style={{ width: "100%" }} />
          </label>
          <p>
            <button onClick={() => setStep(isStructured ? "abilities" : "system")}>Back</button>{" "}
            <button onClick={create} disabled={creating || !backgroundChoicesComplete}>
              {creating ? "Creating…" : "Create character"}
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
