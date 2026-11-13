import { useEffect, useState, type CSSProperties, type FormEvent } from "react";
import type { CampaignSummary } from "shared";
import * as campaignsApi from "../api/campaigns";
import { useAuth } from "../context/AuthContext";
import { MyCharactersSection } from "../components/MyCharactersSection";
import { HallOfHeroesSection } from "../components/HallOfHeroesSection";
import { DiceRoller } from "../components/DiceRoller";
import { ApiTokensPanel } from "../components/ApiTokensPanel";
import { PasswordChangePanel } from "../components/PasswordChangePanel";
import { ThemePicker } from "../components/ThemePicker";
import { DiceModelPicker } from "../components/DiceModelPicker";
import { NotesSection } from "../components/NotesSection";
import { InitiativeTracker } from "../components/InitiativeTracker";

/* GUI rework: the home page used to be one long grid where play panels (characters, dice,
 * notes) and account settings (theme, dice model, password, API tokens) all competed as
 * equal-weight cards. It now splits into two tabs — Play and Settings — so the dashboard
 * leads with what you touch every session and preferences are out of the way until asked for.
 * The campaign list is also no longer buried at the bottom: it sits directly under characters,
 * with create/join folded into it as a single inline row instead of a separate panel. */

/** Home = the stuff you touch every session; Settings = account preferences. */
type HomeTab = "play" | "settings";

const tabBtn = (active: boolean): CSSProperties => ({
  padding: "0.35rem 1rem",
  borderRadius: 999,
  border: `1px solid ${active ? "var(--accent)" : "var(--border-strong)"}`,
  background: active ? "var(--accent)" : "transparent",
  color: active ? "var(--accent-contrast)" : "var(--text-muted)",
  fontWeight: 700,
  cursor: "pointer",
});

export function CampaignList({
  onOpenCampaign,
  onOpenCharacter,
  onCreateCharacter,
  initialTab = "play",
}: {
  onOpenCampaign: (id: number) => void;
  onOpenCharacter: (id: number) => void;
  onCreateCharacter: () => void;
  /** Where to land (#gui-rework): the header's Settings button opens straight into settings. */
  initialTab?: HomeTab;
}) {
  const { user } = useAuth();
  const [tab, setTab] = useState<HomeTab>(initialTab);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  // Create/join used to be a always-visible panel below the campaign cards; they now reveal
  // from small header actions so the default view shows campaigns, not empty forms.
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  function refresh() {
    setLoading(true);
    campaignsApi
      .listCampaigns()
      .then(setCampaigns)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  const isDM = user?.role === "dm" || user?.role === "admin";

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await campaignsApi.createCampaign(newName, newDescription || undefined);
      setNewName("");
      setNewDescription("");
      setShowCreate(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create campaign");
    }
  }

  async function handleJoin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await campaignsApi.joinCampaign(inviteCode);
      setInviteCode("");
      setShowJoin(false);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join campaign");
    }
  }

  return (
    <div className="page-shell">
      <div className="hero" style={{ marginBottom: "0.25rem" }}>
        <p className="eyebrow" style={{ margin: 0 }}>Welcome back</p>
        <h1 style={{ margin: 0 }}>{user?.username}</h1>
        <p className="hero__description">
          Your characters, campaigns, dice and notes — everything a tabletop adventurer carries.
        </p>
      </div>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      {/* Two tabs instead of one long mixed grid: Play vs Settings. */}
      <div role="tablist" aria-label="Home sections" style={{ display: "flex", gap: "0.5rem", margin: "1rem 0" }}>
        <button type="button" role="tab" aria-selected={tab === "play"} style={tabBtn(tab === "play")} onClick={() => setTab("play")}>
          Play
        </button>
        <button type="button" role="tab" aria-selected={tab === "settings"} style={tabBtn(tab === "settings")} onClick={() => setTab("settings")}>
          Settings
        </button>
      </div>

      {tab === "play" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <MyCharactersSection
              campaigns={campaigns}
              onOpenCharacter={onOpenCharacter}
              onCreateCharacter={onCreateCharacter}
            />
          </div>

          {/* Campaigns moved up from the bottom of the page, with create/join inline. */}
          <div className="panel" style={{ gridColumn: "1 / -1" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem", flexWrap: "wrap" }}>
              <h2 className="panel__title" style={{ margin: 0 }}>Campaigns</h2>
              {isDM && (
                <button className="btn" onClick={() => { setShowJoin(false); setShowCreate((v) => !v); }}>
                  {showCreate ? "Cancel" : "+ Create"}
                </button>
              )}
              <button className="btn" onClick={() => { setShowCreate(false); setShowJoin((v) => !v); }}>
                {showJoin ? "Cancel" : "+ Join with code"}
              </button>
            </div>

            {loading ? (
              <p>Loading…</p>
            ) : campaigns.length === 0 && !showCreate && !showJoin ? (
              <p style={{ marginBottom: 0 }}>
                Not in any campaigns. Playing with a group? {isDM ? "Create one or " : ""}join with an invite code.
              </p>
            ) : (
              <ul className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%,14rem),1fr))", marginTop: "0.75rem" }}>
                {campaigns.map((c) => (
                  <li key={c.id} style={{ minWidth: 0 }}>
                    <div className="click-card" style={{ minHeight: 0 }} onClick={() => onOpenCampaign(c.id)} role="button" tabIndex={0}>
                      <p className="click-card__eyebrow">{c.role}</p>
                      <p className="click-card__title" style={{ fontSize: "1.3rem" }}>{c.name}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {showCreate && (
              <form onSubmit={handleCreate} style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "end", marginTop: "0.75rem" }}>
                <label style={{ flex: "1 1 12rem" }}>
                  Name
                  <input value={newName} onChange={(e) => setNewName(e.target.value)} required />
                </label>
                <label style={{ flex: "2 1 16rem" }}>
                  Description
                  <input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
                </label>
                <button type="submit">Create</button>
              </form>
            )}

            {showJoin && (
              <form onSubmit={handleJoin} style={{ display: "flex", gap: "0.5rem", alignItems: "end", marginTop: "0.75rem" }}>
                <label style={{ flex: "1 1 12rem" }}>
                  Invite code
                  <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required />
                </label>
                <button type="submit">Join</button>
              </form>
            )}
          </div>

          <DiceRoller campaignId={null} />
          {user && <NotesSection campaignId={null} currentUserId={user.id} role={null} />}
          <InitiativeTracker campaignId={null} role={null} />

          <div style={{ gridColumn: "1 / -1" }}>
            <HallOfHeroesSection onOpenCharacter={onOpenCharacter} />
          </div>
        </div>
      )}

      {tab === "settings" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
          <ThemePicker />
          <DiceModelPicker />
          <PasswordChangePanel />

          {/* DM/admin only -- tokens exist for scripted custom-content upload, which is already
              gated to those roles, so a player has nothing to point one at. */}
          {isDM && <ApiTokensPanel />}
        </div>
      )}
    </div>
  );
}
