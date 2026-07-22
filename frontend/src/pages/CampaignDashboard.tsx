import { useEffect, useState } from "react";
import type { CampaignDetail } from "shared";
import * as campaignsApi from "../api/campaigns";
import { useAuth } from "../context/AuthContext";
import { CharactersSection } from "../components/CharactersSection";
import { NotesSection } from "../components/NotesSection";
import { InitiativeTracker } from "../components/InitiativeTracker";
import { DiceRoller } from "../components/DiceRoller";
import { ShopSection } from "../components/ShopSection";

export function CampaignDashboard({
  campaignId,
  onBack,
  onOpenCharacter,
  onCreateCharacter,
}: {
  campaignId: number;
  onBack: () => void;
  onOpenCharacter: (id: number) => void;
  onCreateCharacter: () => void;
}) {
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  function refresh() {
    campaignsApi
      .getCampaign(campaignId)
      .then(setCampaign)
      .catch((err) => setError(err.message));
  }

  useEffect(refresh, [campaignId]);

  async function handleRegenerate() {
    try {
      await campaignsApi.regenerateInviteCode(campaignId);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate invite code");
    }
  }

  async function handleDelete() {
    if (!campaign || deleteConfirmText !== campaign.name) return;
    setDeleting(true);
    setError(null);
    try {
      await campaignsApi.deleteCampaign(campaignId);
      onBack();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete campaign");
      setDeleting(false);
    }
  }

  if (error) return <p style={{ color: "crimson" }}>{error}</p>;
  if (!campaign) return <p>Loading…</p>;

  return (
    <div style={{ maxWidth: 640, margin: "2rem auto" }}>
      <button onClick={onBack}>&larr; Back to campaigns</button>
      <h1>{campaign.name}</h1>
      {campaign.description && <p>{campaign.description}</p>}
      <p>Your role: {campaign.role}</p>

      {campaign.inviteCode && (
        <p>
          Invite code: <code>{campaign.inviteCode}</code>{" "}
          <button onClick={handleRegenerate}>Regenerate</button>
        </p>
      )}

      <h2>Members</h2>
      <ul>
        {campaign.members.map((m) => (
          <li key={m.userId}>
            {m.username} ({m.role})
          </li>
        ))}
      </ul>

      {user && (
        <CharactersSection
          campaignId={campaignId}
          currentUserId={user.id}
          role={campaign.role}
          onOpenCharacter={onOpenCharacter}
          onCreateCharacter={onCreateCharacter}
        />
      )}
      {user && <InitiativeTracker campaignId={campaignId} role={campaign.role} />}
      {user && <DiceRoller campaignId={campaignId} />}
      {user && <ShopSection campaignId={campaignId} currentUserId={user.id} role={campaign.role} />}
      {user && <NotesSection campaignId={campaignId} currentUserId={user.id} role={campaign.role} />}

      {user && (user.id === campaign.ownerUserId || user.role === "admin") && (
        <div style={{ marginTop: "2rem", border: "1px solid crimson", borderRadius: 6, padding: "0.75rem" }}>
          <h3 style={{ color: "crimson", marginTop: 0 }}>Delete campaign</h3>
          <p>
            This permanently deletes the campaign, its members, notes, encounters, and shop. Attached characters are{" "}
            <strong>detached</strong>, not deleted, and remain in your character list.
          </p>
          <p>
            Type the campaign name (<code>{campaign.name}</code>) to confirm:
          </p>
          <input
            value={deleteConfirmText}
            onChange={(e) => setDeleteConfirmText(e.target.value)}
            placeholder={campaign.name}
          />{" "}
          <button
            onClick={handleDelete}
            disabled={deleteConfirmText !== campaign.name || deleting}
            style={{ color: "crimson" }}
          >
            {deleting ? "Deleting…" : "Delete campaign"}
          </button>
        </div>
      )}
    </div>
  );
}
