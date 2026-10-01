import { useEffect, useState, type FormEvent } from "react";
import type { CampaignSummary } from "shared";
import * as campaignsApi from "../api/campaigns";
import { useAuth } from "../context/AuthContext";
import { MyCharactersSection } from "../components/MyCharactersSection";
import { HallOfHeroesSection } from "../components/HallOfHeroesSection";
import { DiceRoller } from "../components/DiceRoller";
import { ApiTokensPanel } from "../components/ApiTokensPanel";
import { PasswordChangePanel } from "../components/PasswordChangePanel";
import { ThemePicker } from "../components/ThemePicker";
import { NotesSection } from "../components/NotesSection";
import { InitiativeTracker } from "../components/InitiativeTracker";
import { cardRaised } from "../styles";

export function CampaignList({
  onOpenCampaign,
  onOpenCharacter,
  onCreateCharacter,
}: {
  onOpenCampaign: (id: number) => void;
  onOpenCharacter: (id: number) => void;
  onCreateCharacter: () => void;
}) {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  function refresh() {
    setLoading(true);
    campaignsApi
      .listCampaigns()
      .then(setCampaigns)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await campaignsApi.createCampaign(newName, newDescription || undefined);
      setNewName("");
      setNewDescription("");
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
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join campaign");
    }
  }

  return (
    <div style={{ maxWidth: 1080, margin: "2rem auto", padding: "0 1rem" }}>
      <div style={{ marginBottom: "1.25rem" }}>
        <p
          style={{
            margin: 0,
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Welcome back
        </p>
        <h1 style={{ margin: 0, fontFamily: "var(--font-display)" }}>{user?.username}</h1>
      </div>

      {error && <p style={{ color: "var(--danger)" }}>{error}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <MyCharactersSection
            campaigns={campaigns}
            onOpenCharacter={onOpenCharacter}
            onCreateCharacter={onCreateCharacter}
          />
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <HallOfHeroesSection onOpenCharacter={onOpenCharacter} />
        </div>

        <DiceRoller campaignId={null} />
        {user && <NotesSection campaignId={null} currentUserId={user.id} role={null} />}
        <InitiativeTracker campaignId={null} role={null} />
        <ThemePicker />
        <PasswordChangePanel />

        {/* DM/admin only -- tokens exist for scripted custom-content upload, which is already
            gated to those roles, so a player has nothing to point one at. */}
        {(user?.role === "dm" || user?.role === "admin") && <ApiTokensPanel />}

        <div style={cardRaised}>
          <h2 style={{ marginTop: 0 }}>Campaigns</h2>
          {loading ? (
            <p>Loading…</p>
          ) : campaigns.length === 0 ? (
            <p>Not in any campaigns. Playing with a group? Create one or join with an invite code.</p>
          ) : (
            <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
              {campaigns.map((c) => (
                <li key={c.id}>
                  <button onClick={() => onOpenCampaign(c.id)}>
                    {c.name} <em>({c.role})</em>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={cardRaised}>
          {(user?.role === "dm" || user?.role === "admin") && (
            <>
              <h3 style={{ marginTop: 0 }}>Create a campaign</h3>
              <form onSubmit={handleCreate} style={{ marginBottom: "1rem" }}>
                <div>
                  <label>
                    Name
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} required />
                  </label>
                </div>
                <div>
                  <label>
                    Description
                    <input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
                  </label>
                </div>
                <button type="submit">Create</button>
              </form>
            </>
          )}

          <h3 style={{ marginTop: 0 }}>Join a campaign</h3>
          <form onSubmit={handleJoin}>
            <label>
              Invite code
              <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required />
            </label>
            <button type="submit">Join</button>
          </form>
        </div>
      </div>
    </div>
  );
}
