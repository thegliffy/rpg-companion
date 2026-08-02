import { useEffect, useState } from "react";
import type { Character } from "shared";
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
  passiveScore,
  proficiencyBonus,
  spellSaveDC,
  spellAttackBonus,
  totalInventoryWeight,
} from "shared";
import * as charactersApi from "../api/characters";
import { panel as box } from "../styles";

/**
 * Public, read-only view of a shared character -- reached via /c/:token, bypassing auth entirely
 * (see App.tsx). Deliberately a standalone presentational component, NOT the interactive
 * Dnd5eSheet reused in a "readOnly" mode: it has no inputs, no onClick handlers that call an API,
 * and no auto-save effect, so there is no code path here that could mutate anything even if some
 * gating were missed -- the safety property the share-link feature promises is enforced by the
 * backend (the public router is GET-only, see sharedCharacters.routes.ts) and reinforced here by
 * simply never wiring up anything that writes.
 */
export function SharedCharacterPage({ token }: { token: string }) {
  const [character, setCharacter] = useState<Character | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    charactersApi
      .getSharedCharacter(token)
      .then(setCharacter)
      .catch(() => setError("This share link is invalid or has been revoked."));
  }, [token]);

  if (error) {
    return (
      <div style={{ maxWidth: 500, margin: "4rem auto", textAlign: "center" }}>
        <p style={{ color: "var(--danger)" }}>{error}</p>
      </div>
    );
  }
  if (!character) return <p style={{ padding: "2rem" }}>Loading…</p>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "1rem 2rem 3rem" }}>
      <p style={{ background: "var(--surface-sunken)", padding: "0.5rem 1rem", borderRadius: 6, fontSize: "0.85rem" }}>
        Read-only shared view of {character.ownerUsername}'s character. No sign-in required, and nothing here can be
        edited.
      </p>
      {character.system === "dnd5e" ? (
        <SharedDnd5e character={character} token={token} />
      ) : (
        <div style={box}>
          <h2>{character.name}</h2>
          <p>This character's system isn't supported by the shared view yet.</p>
        </div>
      )}
    </div>
  );
}

function SharedDnd5e({ character, token }: { character: Character; token: string }) {
  // Parsed (not cast) so a row stored before a schema field existed still gets that field's
  // default instead of throwing on the first .map()/spread over an undefined array below.
  const sheet = dnd5eSheetSchema.parse(character.sheetData ?? {});
  const saveDC = spellSaveDC(sheet);
  const atkBonus = spellAttackBonus(sheet);
  const breakdown = acBreakdownText(sheet);
  const [portraitOk, setPortraitOk] = useState(true);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div style={{ ...box, display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
        {portraitOk && (
          <img
            src={charactersApi.sharedPortraitUrl(token)}
            alt=""
            onError={() => setPortraitOk(false)}
            style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8 }}
          />
        )}
        <div>
          <h1 style={{ margin: 0 }}>{character.name}</h1>
          <div style={{ color: "var(--text-muted)" }}>
            {sheet.race}
            {sheet.subrace ? ` (${sheet.subrace})` : ""} {sheet.class}
            {sheet.subclass ? ` (${sheet.subclass})` : ""} {sheet.level} — {sheet.background}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
        <div style={{ ...box, flex: "0 0 auto" }}>
          <h3>Combat</h3>
          <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "0.3rem 0.8rem" }}>
            <span>AC</span>
            <strong>
              {effectiveAC(sheet)}
              {breakdown && <small style={{ color: "var(--text-muted)" }}> ({breakdown})</small>}
            </strong>
            <span>HP</span>
            <strong>
              {character.hpCurrent ?? "—"} / {character.hpMax ?? "—"}
            </strong>
            <span>Speed</span>
            <strong>{sheet.speed} ft</strong>
            <span>Initiative</span>
            <strong>{formatModifier(abilityModifier(effectiveAbilityScore(sheet, "dex")))}</strong>
            <span>Proficiency</span>
            <strong>{formatModifier(proficiencyBonus(sheet.level))}</strong>
          </div>
        </div>

        <div style={{ ...box, flex: "0 0 auto" }}>
          <h3>Abilities</h3>
          <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "0.3rem 0.8rem" }}>
            {DND5E_ABILITIES.map((a) => (
              <>
                <span key={`${a}-label`}>{DND5E_ABILITY_NAMES[a]}</span>
                <strong key={`${a}-value`}>
                  {effectiveAbilityScore(sheet, a)} ({formatModifier(abilityModifier(effectiveAbilityScore(sheet, a)))})
                </strong>
              </>
            ))}
          </div>
        </div>

        <div style={{ ...box, flex: "1 1 260px" }}>
          <h3>Skills</h3>
          <div style={{ columnCount: 2, columnGap: "1.5rem", fontSize: "0.9rem" }}>
            {DND5E_SKILLS.map((s) => (
              <div key={s.id} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                <span>{s.name}</span>
                <strong>{formatModifier(skillBonus(sheet, s.id))}</strong>
              </div>
            ))}
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: 0 }}>
            Passive Perception {passiveScore(sheet, "perception")} · Passive Investigation{" "}
            {passiveScore(sheet, "investigation")} · Passive Insight {passiveScore(sheet, "insight")}
          </p>
        </div>
      </div>

      {sheet.spellcastingAbility && (
        <div style={box}>
          <h3>Spellcasting</h3>
          <p>
            Spell save DC <strong>{saveDC ?? "—"}</strong> · Spell attack{" "}
            <strong>{atkBonus !== null ? formatModifier(atkBonus) : "—"}</strong>
          </p>
          {sheet.spells.map((sp) => (
            <div key={sp.id} style={{ fontSize: "0.9rem" }}>
              {sp.name} <small style={{ color: "var(--text-muted)" }}>({sp.level === 0 ? "cantrip" : `level ${sp.level}`})</small>
            </div>
          ))}
        </div>
      )}

      {sheet.items.length > 0 && (
        <div style={box}>
          <h3>Inventory</h3>
          {sheet.items.map((item) => (
            <div key={item.id} style={{ fontSize: "0.9rem" }}>
              {item.equipped ? "▣" : "▢"} {item.name} × {item.quantity}
            </div>
          ))}
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>Total weight: {totalInventoryWeight(sheet)} lb</p>
        </div>
      )}

      {(sheet.feats.length > 0 || sheet.features.length > 0) && (
        <div style={box}>
          <h3>Feats &amp; features</h3>
          {[...sheet.feats, ...sheet.features].map((f) => (
            <div key={f.id} style={{ marginBottom: "0.4rem" }}>
              <strong>{f.name}</strong>
              {f.description && <div style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>{f.description}</div>}
            </div>
          ))}
        </div>
      )}

      {(sheet.proficienciesText || sheet.personalityText || sheet.equipmentText) && (
        <div style={box}>
          {sheet.proficienciesText && (
            <>
              <h4>Proficiencies &amp; languages</h4>
              <p style={{ whiteSpace: "pre-wrap" }}>{sheet.proficienciesText}</p>
            </>
          )}
          {sheet.equipmentText && (
            <>
              <h4>Other equipment</h4>
              <p style={{ whiteSpace: "pre-wrap" }}>{sheet.equipmentText}</p>
            </>
          )}
          {sheet.personalityText && (
            <>
              <h4>Personality</h4>
              <p style={{ whiteSpace: "pre-wrap" }}>{sheet.personalityText}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
