import { useEffect, useState } from "react";
import type { Npc } from "shared";
import * as campaignsApi from "../api/campaigns";
import { cardRaised } from "../styles";

// DM-only NPC roster (the backend gates every route to the campaign's DM/admin). Prose fields
// are hand-editable; the Generate buttons fill them via the LLM (existing fields act as canon
// hints), and Generate art queues a ComfyUI job from the NPC's own description.
export function NpcSection({ campaignId }: { campaignId: number }) {
  const [npcs, setNpcs] = useState<Npc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | "new" | null>(null);
  const [seed, setSeed] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  useEffect(() => {
    campaignsApi.listNpcs(campaignId).then(setNpcs).catch((err) => setError(err.message));
  }, [campaignId]);

  async function addNpc(e: React.FormEvent) {
    e.preventDefault();
    if (!seed.trim()) return;
    setBusyId("new");
    setError(null);
    try {
      const npc = await campaignsApi.createNpc(campaignId, { name: seed.trim() });
      setNpcs((prev) => [...prev, npc].sort((a, b) => a.name.localeCompare(b.name)));
      setSeed("");
      setOpenId(npc.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusyId(null);
    }
  }

  async function generate(id: number, kind: "prose" | "art") {
    setBusyId(id);
    setError(null);
    try {
      const npc = kind === "prose" ? await campaignsApi.generateNpc(id) : await campaignsApi.generateNpcArt(id);
      setNpcs((prev) => prev.map((n) => (n.id === id ? npc : n)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setBusyId(null);
    }
  }

  async function save(id: number, updates: Partial<Npc>) {
    setError(null);
    try {
      const npc = await campaignsApi.updateNpc(id, updates);
      setNpcs((prev) => prev.map((n) => (n.id === id ? npc : n)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this NPC?")) return;
    setError(null);
    try {
      await campaignsApi.deleteNpc(id);
      setNpcs((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  const labelStyle: React.CSSProperties = { display: "block", fontSize: "0.75rem", color: "var(--text-dim)", margin: "0.4rem 0 0.15rem" };

  return (
    <div style={{ ...cardRaised, marginTop: "1rem" }}>
      <h2 style={{ marginTop: 0 }}>NPCs</h2>
      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      <form onSubmit={addNpc} style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        <input placeholder="Name or seed (e.g. Grisha, a treacherous lighthouse keeper)" value={seed} onChange={(e) => setSeed(e.target.value)} style={{ flex: 1 }} />
        <button type="submit" disabled={busyId === "new" || !seed.trim()}>{busyId === "new" ? "Adding…" : "Add NPC"}</button>
      </form>
      {npcs.length === 0 && <p style={{ color: "var(--text-dim)" }}>No NPCs yet.</p>}
      {npcs.map((npc) => (
        <div key={npc.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "0.5rem 0.75rem", marginBottom: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button style={{ background: "none", border: "none", cursor: "pointer", fontWeight: "bold", padding: 0 }} onClick={() => setOpenId(openId === npc.id ? null : npc.id)}>
              {openId === npc.id ? "▾" : "▸"} {npc.name}
            </button>
            {npc.role && <span style={{ color: "var(--text-dim)", fontSize: "0.85rem" }}>— {npc.role}</span>}
            <span style={{ flex: 1 }} />
            <button onClick={() => generate(npc.id, "prose")} disabled={busyId !== null} title="Fill the prose fields with the AI">{busyId === npc.id ? "…" : "Generate"}</button>
            <button onClick={() => generate(npc.id, "art")} disabled={busyId !== null} title="Generate portrait art (ComfyUI)">Art</button>
            <button onClick={() => remove(npc.id)} disabled={busyId !== null}>✕</button>
          </div>
          {openId === npc.id && (
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "0.75rem", marginTop: "0.5rem" }}>
              <div>
                <img
                  src={campaignsApi.npcImageUrl(npc.id, npc.updatedAt ? new Date(npc.updatedAt).getTime() : 0)}
                  alt=""
                  style={{ width: 160, height: 200, objectFit: "cover", border: "1px solid var(--border-strong)", borderRadius: 6, background: "var(--surface-sunken)" }}
                  onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
                />
              </div>
              <div>
                {(["appearance", "personality", "motivation", "secret", "notes"] as const).map((field) => (
                  <div key={field}>
                    <label style={labelStyle}>{field}</label>
                    <textarea
                      defaultValue={npc[field]}
                      rows={2}
                      style={{ width: "100%", resize: "vertical" }}
                      onBlur={(e) => {
                        if (e.target.value !== npc[field]) save(npc.id, { [field]: e.target.value });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
