import type { CampaignSummary, CampaignDetail, Npc } from "shared";

async function parseOrThrow(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Request failed");
  }
  return res.json();
}

export async function listCampaigns(): Promise<CampaignSummary[]> {
  const res = await fetch("/api/campaigns");
  const data = await parseOrThrow(res);
  return data.campaigns;
}

export async function createCampaign(name: string, description?: string) {
  const res = await fetch("/api/campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description }),
  });
  const data = await parseOrThrow(res);
  return data.campaign;
}

export async function joinCampaign(inviteCode: string) {
  const res = await fetch("/api/campaigns/join", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inviteCode }),
  });
  const data = await parseOrThrow(res);
  return data.campaign;
}

export async function getCampaign(id: number): Promise<CampaignDetail> {
  const res = await fetch(`/api/campaigns/${id}`);
  const data = await parseOrThrow(res);
  return data.campaign;
}

export async function updateCampaign(id: number, updates: { flavorRolls?: boolean }): Promise<void> {
  await parseOrThrow(
    await fetch(`/api/campaigns/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }),
  );
}

export async function regenerateInviteCode(id: number): Promise<string> {
  const res = await fetch(`/api/campaigns/${id}/invite/regenerate`, { method: "POST" });
  const data = await parseOrThrow(res);
  return data.inviteCode;
}

export async function deleteCampaign(id: number): Promise<void> {
  const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Request failed");
  }
}

// --- NPC roster (DM-only) ------------------------------------------------------------------

export async function listNpcs(campaignId: number): Promise<Npc[]> {
  const data = await parseOrThrow(await fetch(`/api/campaigns/${campaignId}/npcs`));
  return data.npcs;
}

export async function createNpc(campaignId: number, input: { name: string; role?: string }): Promise<Npc> {
  const data = await parseOrThrow(
    await fetch(`/api/campaigns/${campaignId}/npcs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return data.npc;
}

export async function updateNpc(id: number, updates: Partial<Npc>): Promise<Npc> {
  const data = await parseOrThrow(
    await fetch(`/api/campaigns/npcs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    }),
  );
  return data.npc;
}

export async function deleteNpc(id: number): Promise<void> {
  await parseOrThrow(await fetch(`/api/campaigns/npcs/${id}`, { method: "DELETE" }));
}

export async function generateNpc(id: number, instructions?: string): Promise<Npc> {
  const data = await parseOrThrow(
    await fetch(`/api/campaigns/npcs/${id}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructions: instructions ?? "" }),
    }),
  );
  return data.npc;
}

export async function generateNpcArt(id: number, instructions?: string): Promise<Npc> {
  const data = await parseOrThrow(
    await fetch(`/api/campaigns/npcs/${id}/generate-art`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instructions: instructions ?? "" }),
    }),
  );
  return data.npc;
}

export function npcImageUrl(id: number, version: number): string {
  return `/api/campaigns/npcs/${id}/image?v=${version}`;
}
