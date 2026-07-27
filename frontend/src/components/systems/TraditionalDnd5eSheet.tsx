import { useState } from "react";
import type { Character, Dnd5eSheetData, Dnd5eAbility } from "shared";
import {
  dnd5eSheetSchema,
  DND5E_ABILITIES,
  DND5E_ABILITY_NAMES,
  DND5E_SKILLS,
  abilityModifier,
  effectiveAbilityScore,
  effectiveAC,
  acBreakdownText,
  formatModifier,
  skillBonus,
  saveBonus,
  isSkillProficient,
  passiveScore,
  proficiencyBonus,
  spellSaveDC,
  spellAttackBonus,
  attackBonus,
  featBonusTotal,
  totalInventoryWeight,
  conditionTags,
} from "shared";
import * as charactersApi from "../../api/characters";
import "./traditional-sheet.css";

export function TraditionalDnd5eSheet({
  character,
  showPrivateNotes,
}: {
  character: Character;
  /** When false, omit private notes (DM viewing someone else's sheet). */
  showPrivateNotes: boolean;
}) {
  // Parsed (not just cast) so a row stored before a schema field existed still gets that field's
  // default -- the sheet's own edit view (Dnd5eSheet.tsx) already does this; a raw cast left every
  // array/object field `undefined` on an old row, throwing on the very first .map()/spread below.
  const sheet = dnd5eSheetSchema.parse(character.sheetData ?? {});
  const [portraitOk, setPortraitOk] = useState(true);
  const prof = proficiencyBonus(sheet.level);
  const ac = effectiveAC(sheet);
  const acBreakdown = acBreakdownText(sheet);
  const saveDC = spellSaveDC(sheet);
  const spellAtk = spellAttackBonus(sheet);
  const conditions = conditionTags(sheet);
  const listedSpells = sheet.spells
    .slice()
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  return (
    <div className="traditional-sheet">
      <div className="ts-toolbar no-print">
        <button type="button" onClick={() => window.print()}>
          Print
        </button>
      </div>

      <header className="ts-panel ts-header">
        {portraitOk ? (
          <img
            className="ts-portrait"
            src={charactersApi.portraitUrl(character.id, 0)}
            alt=""
            onError={() => setPortraitOk(false)}
          />
        ) : (
          <div className="ts-portrait-placeholder">No portrait</div>
        )}

        <div>
          <h1>{character.name}</h1>
          <div className="ts-meta">
            {[
              [sheet.race, sheet.subrace ? `(${sheet.subrace})` : ""].filter(Boolean).join(" "),
              [sheet.class, sheet.subclass ? `(${sheet.subclass})` : "", `Level ${sheet.level}`]
                .filter(Boolean)
                .join(" "),
              sheet.background,
              sheet.alignment,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          <div className="ts-meta-grid">
            <div>
              <label>Class &amp; level</label>
              <span>
                {sheet.class}
                {sheet.subclass ? ` (${sheet.subclass})` : ""} {sheet.level}
              </span>
            </div>
            <div>
              <label>Race</label>
              <span>
                {sheet.race}
                {sheet.subrace ? ` (${sheet.subrace})` : ""}
              </span>
            </div>
            <div>
              <label>Background</label>
              <span>{sheet.background || "—"}</span>
            </div>
            <div>
              <label>Alignment</label>
              <span>{sheet.alignment || "—"}</span>
            </div>
            <div>
              <label>Player</label>
              <span>{character.ownerUsername}</span>
            </div>
            <div>
              <label>Campaign</label>
              <span>{character.campaignName || "Personal"}</span>
            </div>
          </div>
        </div>

        <div className="ts-prof-badge">
          <div className="ts-value">{formatModifier(prof)}</div>
          <div className="ts-label">Proficiency bonus</div>
        </div>
      </header>

      <div className="ts-main">
        <div className="ts-col">
          <section className="ts-panel">
            <h2>Ability scores</h2>
            <div className="ts-ability">
              {DND5E_ABILITIES.map((a) => {
                const score = effectiveAbilityScore(sheet, a);
                return (
                  <div key={a} className="ts-ability-row">
                    <span className="ts-ab-name">{DND5E_ABILITY_NAMES[a]}</span>
                    <span className="ts-ab-score">{score}</span>
                    <span className="ts-ab-mod">{formatModifier(abilityModifier(score))}</span>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="ts-panel">
            <h2>Saving throws</h2>
            {DND5E_ABILITIES.map((a) => (
              <SaveRow key={a} sheet={sheet} ability={a} />
            ))}
          </section>
        </div>

        <div className="ts-col">
          <section className="ts-panel">
            <h2>Combat</h2>
            <div className="ts-combat-grid">
              <div className="ts-stat-cell">
                <div className="ts-value">{ac}</div>
                <div className="ts-label">Armor class</div>
              </div>
              <div className="ts-stat-cell">
                <div className="ts-value">
                  {formatModifier(abilityModifier(effectiveAbilityScore(sheet, "dex")))}
                </div>
                <div className="ts-label">Initiative</div>
              </div>
              <div className="ts-stat-cell">
                <div className="ts-value">{sheet.speed}</div>
                <div className="ts-label">Speed (ft)</div>
              </div>
            </div>
            {acBreakdown && (
              <p className="ts-muted" style={{ margin: "0.35rem 0 0", fontSize: "0.7rem" }}>
                {acBreakdown}
              </p>
            )}
            <div className="ts-hp-block">
              <div className="ts-stat-cell">
                <div className="ts-value">
                  {character.hpCurrent ?? "—"} / {character.hpMax ?? "—"}
                </div>
                <div className="ts-label">Hit points</div>
              </div>
              <div className="ts-stat-cell">
                <div className="ts-value">
                  {sheet.hitDiceAvailable}/{sheet.hitDiceTotal}
                  {sheet.hitDice ? ` (${sheet.hitDice})` : ""}
                </div>
                <div className="ts-label">Hit dice</div>
              </div>
            </div>
            {conditions.length > 0 && (
              <p style={{ margin: "0.4rem 0 0", fontSize: "0.78rem" }}>
                <strong>Conditions:</strong> {conditions.join(", ")}
              </p>
            )}
          </section>

          <section className="ts-panel">
            <h2>Attacks</h2>
            {sheet.attacks.length === 0 ? (
              <p className="ts-muted">No attacks listed.</p>
            ) : (
              <table className="ts-attacks">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Bonus</th>
                    <th>Damage</th>
                  </tr>
                </thead>
                <tbody>
                  {sheet.attacks.map((atk) => {
                    const dmgBonus =
                      abilityModifier(effectiveAbilityScore(sheet, atk.ability)) +
                      atk.magicBonus +
                      featBonusTotal(sheet, "damageBonus");
                    return (
                      <tr key={atk.id}>
                        <td>{atk.name || "—"}</td>
                        <td>{formatModifier(attackBonus(sheet, atk))}</td>
                        <td>
                          {atk.damageDice
                            ? `${atk.damageDice} ${formatModifier(dmgBonus)}${atk.damageType ? ` ${atk.damageType}` : ""}`
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </div>

        <div className="ts-col">
          <section className="ts-panel">
            <h2>Skills</h2>
            {DND5E_SKILLS.map((s) => (
              <div key={s.id} className="ts-skill-row">
                <span className="ts-mark">{isSkillProficient(sheet, s.id) ? "●" : "○"}</span>
                <strong>{formatModifier(skillBonus(sheet, s.id))}</strong>
                <span>
                  {s.name} <span className="ts-muted">({s.ability.toUpperCase()})</span>
                </span>
              </div>
            ))}
            <h3>Passive scores</h3>
            <p style={{ margin: 0, fontSize: "0.78rem" }}>
              Perception {passiveScore(sheet, "perception")} · Investigation{" "}
              {passiveScore(sheet, "investigation")} · Insight {passiveScore(sheet, "insight")}
            </p>
          </section>

          {sheet.proficienciesText && (
            <section className="ts-panel">
              <h2>Proficiencies &amp; languages</h2>
              <p className="ts-pre">{sheet.proficienciesText}</p>
            </section>
          )}
        </div>
      </div>

      <div className="ts-below">
        {(sheet.spellcastingAbility || sheet.spells.length > 0) && (
          <section className="ts-panel">
            <h2>Spellcasting</h2>
            <p style={{ margin: "0 0 0.4rem", fontSize: "0.8rem" }}>
              Ability{" "}
              <strong>
                {sheet.spellcastingAbility
                  ? DND5E_ABILITY_NAMES[sheet.spellcastingAbility]
                  : "—"}
              </strong>{" "}
              · Save DC <strong>{saveDC ?? "—"}</strong> · Spell attack{" "}
              <strong>{spellAtk !== null ? formatModifier(spellAtk) : "—"}</strong>
            </p>
            <SpellSlots sheet={sheet} />
            {listedSpells.length > 0 ? (
              <div className="ts-spell-list">
                {listedSpells.map((sp) => (
                  <div key={sp.id}>
                    <strong>{sp.name || "—"}</strong>{" "}
                    <span className="ts-muted">
                      ({sp.level === 0 ? "cantrip" : `L${sp.level}`}
                      {sp.atWill ? ", at will" : ""}
                      {sp.level > 0 && !sp.atWill ? (sp.prepared ? ", prepared" : ", not prepared") : ""})
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ts-muted">No spells listed.</p>
            )}
          </section>
        )}

        <div className="ts-two-col">
          <section className="ts-panel">
            <h2>Features &amp; feats</h2>
            {sheet.feats.length === 0 && sheet.features.length === 0 ? (
              <p className="ts-muted">None listed.</p>
            ) : (
              <div className="ts-feature-list">
                {[...sheet.feats, ...sheet.features].map((f) => (
                  <div key={f.id}>
                    <strong>{f.name || "—"}</strong>
                    {f.description && <div className="ts-muted">{f.description}</div>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="ts-panel">
            <h2>Inventory</h2>
            <div className="ts-currency">
              <span>
                <strong>{sheet.currency.pp}</strong> pp
              </span>
              <span>
                <strong>{sheet.currency.gp}</strong> gp
              </span>
              <span>
                <strong>{sheet.currency.ep}</strong> ep
              </span>
              <span>
                <strong>{sheet.currency.sp}</strong> sp
              </span>
              <span>
                <strong>{sheet.currency.cp}</strong> cp
              </span>
              <span className="ts-muted">{totalInventoryWeight(sheet)} lb</span>
            </div>
            {sheet.items.length === 0 ? (
              <p className="ts-muted">No items.</p>
            ) : (
              <div className="ts-item-list">
                {sheet.items.map((item) => (
                  <div key={item.id}>
                    {item.equipped ? "▣" : "▢"} {item.name || "—"}
                    {item.quantity !== 1 ? ` ×${item.quantity}` : ""}
                    {item.requiresAttunement ? (item.attuned ? " (attuned)" : " (attune)") : ""}
                  </div>
                ))}
              </div>
            )}
            {sheet.equipmentText && (
              <>
                <h3>Other equipment</h3>
                <p className="ts-pre">{sheet.equipmentText}</p>
              </>
            )}
          </section>
        </div>

        {(sheet.personalityText || character.notes || (showPrivateNotes && sheet.privateNotes)) && (
          <div className="ts-two-col">
            {sheet.personalityText && (
              <section className="ts-panel">
                <h2>Personality</h2>
                <p className="ts-pre">{sheet.personalityText}</p>
              </section>
            )}
            {(character.notes || (showPrivateNotes && sheet.privateNotes)) && (
              <section className="ts-panel">
                <h2>Notes</h2>
                {character.notes && <p className="ts-pre">{character.notes}</p>}
                {showPrivateNotes && sheet.privateNotes && (
                  <>
                    <h3>Private notes</h3>
                    <p className="ts-pre">{sheet.privateNotes}</p>
                  </>
                )}
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SaveRow({ sheet, ability }: { sheet: Dnd5eSheetData; ability: Dnd5eAbility }) {
  const proficient = sheet.saveProficiencies.includes(ability);
  return (
    <div className="ts-save-row">
      <span className="ts-mark">{proficient ? "●" : "○"}</span>
      <strong>{formatModifier(saveBonus(sheet, ability))}</strong>
      <span>{DND5E_ABILITY_NAMES[ability]}</span>
    </div>
  );
}

function SpellSlots({ sheet }: { sheet: Dnd5eSheetData }) {
  const rows = sheet.spellSlots
    .filter((slot) => slot.total > 0)
    .slice()
    .sort((a, b) => a.level - b.level)
    .map((slot) => (
      <span key={slot.level}>
        L{slot.level} {slot.available}/{slot.total}
      </span>
    ));

  if (rows.length === 0) return null;

  return (
    <p style={{ margin: "0 0 0.4rem", fontSize: "0.78rem", display: "flex", flexWrap: "wrap", gap: "0.5rem 0.85rem" }}>
      {rows}
    </p>
  );
}
