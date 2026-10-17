import { useState } from "react";
import type { Character } from "shared";
import * as charactersApi from "../api/characters";

// AI Studio: backstory prose (via the LLM backend) and portrait art (via ComfyUI), both
// conditioned on the character's own sheet facts. The backend gates these to owner/DM/admin
// and rate-limits them, so the panel is rendered for everyone and surfaces the API's error
// (403/502/503) if the caller can't generate or a backend is down.
export function AiStudioPanel({
  character,
  onBackstorySaved,
}: {
  character: Character;
  onBackstorySaved: (character: Character) => void;
}) {
  const [open, setOpen] = useState(false);
  const [backstory, setBackstory] = useState(character.backstory ?? "");
  const [bsInstructions, setBsInstructions] = useState("");
  const [portInstructions, setPortInstructions] = useState("");
  const [busy, setBusy] = useState<"backstory" | "portrait" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portraitVersion, setPortraitVersion] = useState(0);

  async function generateBackstory() {
    setBusy("backstory");
    setError(null);
    try {
      const text = await charactersApi.generateBackstory(character.id, bsInstructions || undefined);
      setBackstory(text);
      // The endpoint already saved it; refetch the character so the caller's copy (and its
      // optimistic-concurrency updatedAt) stays in sync.
      const saved = await charactersApi.getCharacter(character.id);
      onBackstorySaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backstory generation failed");
    } finally {
      setBusy(null);
    }
  }

  // Manual edits to the textarea are saved through the normal PATCH (same path as notes).
  async function saveBackstory() {
    setBusy("backstory");
    setError(null);
    try {
      const saved = await charactersApi.updateCharacter(character.id, { backstory });
      onBackstorySaved(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function generatePortrait() {
    setBusy("portrait");
    setError(null);
    try {
      await charactersApi.generatePortrait(character.id, portInstructions || undefined);
      setPortraitVersion((v) => v + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Portrait generation failed");
    } finally {
      setBusy(null);
    }
  }

  const labelStyle: React.CSSProperties = { display: "block", fontSize: "0.8rem", color: "var(--text-dim)", margin: "0.5rem 0 0.25rem" };

  return (
    <div className="no-print" style={{ border: "1px solid var(--border-strong)", borderRadius: 8, padding: "0.5rem 0.75rem", margin: "0.75rem 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <button type="button" onClick={() => setOpen((o) => !o)}>
          {open ? "▾" : "▸"} AI Studio
        </button>
        <small style={{ color: "var(--text-dim)" }}>backstory &amp; portrait generation</small>
      </div>
      {open && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginTop: "0.5rem" }}>
          <div>
            <label style={labelStyle}>Backstory</label>
            <textarea
              value={backstory}
              onChange={(e) => setBackstory(e.target.value)}
              rows={8}
              style={{ width: "100%", resize: "vertical" }}
            />
            <input
              type="text"
              value={bsInstructions}
              onChange={(e) => setBsInstructions(e.target.value)}
              placeholder="Optional steering: tone, hooks, debts…"
              style={{ width: "100%", margin: "0.35rem 0" }}
            />
            <button type="button" onClick={generateBackstory} disabled={busy !== null}>
              {busy === "backstory" ? "Generating…" : "Generate backstory"}
            </button>{" "}
            <button type="button" onClick={saveBackstory} disabled={busy !== null}>
              Save
            </button>
          </div>
          <div>
            <label style={labelStyle}>Portrait</label>
            <div
              style={{
                width: 160,
                height: 200,
                border: "1px solid var(--border-strong)",
                borderRadius: 6,
                overflow: "hidden",
                background: "var(--surface-sunken)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                key={portraitVersion}
                src={charactersApi.portraitUrl(character.id, portraitVersion || Date.now())}
                alt="Character portrait"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              />
            </div>
            <input
              type="text"
              value={portInstructions}
              onChange={(e) => setPortInstructions(e.target.value)}
              placeholder="Optional steering: lighting, mood, gear…"
              style={{ width: "100%", margin: "0.35rem 0" }}
            />
            <button type="button" onClick={generatePortrait} disabled={busy !== null}>
              {busy === "portrait" ? "Generating… (this can take a minute)" : "Generate portrait"}
            </button>
          </div>
          {error && <p style={{ color: "var(--danger)", fontSize: "0.8rem", gridColumn: "1 / -1", margin: 0 }}>{error}</p>}
        </div>
      )}
    </div>
  );
}
