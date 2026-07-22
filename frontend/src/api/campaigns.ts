import type { CampaignSummary, CampaignDetail } from "shared";

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
