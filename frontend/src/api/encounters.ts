import type { EncounterSnapshot } from "shared";

async function parseOrThrow(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Request failed");
  }
  return res.json();
}

function base(campaignId: number | null): string {
  return campaignId === null ? "/api/encounters/personal" : `/api/campaigns/${campaignId}/encounter`;
}

export async function getEncounter(campaignId: number | null): Promise<EncounterSnapshot | null> {
  const res = await fetch(base(campaignId));
  const data = await parseOrThrow(res);
  return data.encounter;
}

export async function startEncounter(campaignId: number | null, name?: string): Promise<EncounterSnapshot> {
  const res = await fetch(`${base(campaignId)}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await parseOrThrow(res);
  return data.encounter;
}

export async function endEncounter(campaignId: number | null): Promise<EncounterSnapshot> {
  const res = await fetch(`${base(campaignId)}/end`, { method: "POST" });
  const data = await parseOrThrow(res);
  return data.encounter;
}

export async function advanceTurn(campaignId: number | null): Promise<EncounterSnapshot> {
  const res = await fetch(`${base(campaignId)}/advance-turn`, { method: "POST" });
  const data = await parseOrThrow(res);
  return data.encounter;
}

export interface CombatantInput {
  characterId?: number | null;
  name: string;
  initiative: number;
  hpCurrent?: number | null;
  hpMax?: number | null;
  conditions?: string[];
}

export async function addCombatant(campaignId: number | null, input: CombatantInput): Promise<EncounterSnapshot> {
  const res = await fetch(`${base(campaignId)}/combatants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseOrThrow(res);
  return data.encounter;
}

export async function updateCombatant(id: number, updates: Partial<CombatantInput>): Promise<EncounterSnapshot> {
  const res = await fetch(`/api/encounters/combatants/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await parseOrThrow(res);
  return data.encounter;
}

export async function removeCombatant(id: number): Promise<EncounterSnapshot> {
  const res = await fetch(`/api/encounters/combatants/${id}`, { method: "DELETE" });
  const data = await parseOrThrow(res);
  return data.encounter;
}
