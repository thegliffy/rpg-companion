import { useEffect, useState, type FormEvent } from "react";
import type { CampaignSummary } from "shared";
import * as campaignsApi from "../api/campaigns";
import { useAuth } from "../context/AuthContext";
import { MyCharactersSection } from "../components/MyCharactersSection";
import { HallOfHeroesSection } from "../components/HallOfHeroesSection";
import { DiceRoller } from "../components/DiceRoller";
import { NotesSection } from "../components/NotesSection";
import { InitiativeTracker } from "../components/InitiativeTracker";

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
    <div style={{ maxWidth: 640, margin: "2rem auto" }}>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <MyCharactersSection
        campaigns={campaigns}
        onOpenCharacter={onOpenCharacter}
        onCreateCharacter={onCreateCharacter}
      />

      <hr />
      <HallOfHeroesSection onOpenCharacter={onOpenCharacter} />

      <hr />
      <DiceRoller campaignId={null} />

      <hr />
      {user && <NotesSection campaignId={null} currentUserId={user.id} role={null} />}

      <hr />
      <InitiativeTracker campaignId={null} role={null} />

      <hr />
      <h2>Campaigns</h2>
      {loading ? (
        <p>Loading…</p>
      ) : campaigns.length === 0 ? (
        <p>Not in any campaigns. Playing with a group? Create one or join with an invite code.</p>
      ) : (
        <ul>
          {campaigns.map((c) => (
            <li key={c.id}>
              <button onClick={() => onOpenCampaign(c.id)}>
                {c.name} <em>({c.role})</em>
              </button>
            </li>
          ))}
        </ul>
      )}

      {(user?.role === "dm" || user?.role === "admin") && (
        <>
          <h3>Create a campaign</h3>
          <form onSubmit={handleCreate}>
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

      <h3>Join a campaign</h3>
      <form onSubmit={handleJoin}>
        <label>
          Invite code
          <input value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} required />
        </label>
        <button type="submit">Join</button>
      </form>
    </div>
  );
}
