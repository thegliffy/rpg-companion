import type { DiceRoll } from "shared";

async function parseOrThrow(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Request failed");
  }
  return res.json();
}

export async function listRolls(campaignId: number | null, limit = 50): Promise<DiceRoll[]> {
  const url = campaignId === null ? `/api/rolls?limit=${limit}` : `/api/campaigns/${campaignId}/rolls?limit=${limit}`;
  const res = await fetch(url);
  const data = await parseOrThrow(res);
  return data.rolls;
}

export async function createRoll(campaignId: number | null, formula: string, label?: string): Promise<DiceRoll> {
  const url = campaignId === null ? "/api/rolls" : `/api/campaigns/${campaignId}/rolls`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ formula, label }),
  });
  const data = await parseOrThrow(res);
  return data.roll;
}
