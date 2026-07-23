import type { Character } from "shared";

async function parseOrThrow(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

export interface CharacterInput {
  campaignId?: number | null;
  name: string;
  system?: Character["system"];
  hpCurrent?: number | null;
  hpMax?: number | null;
  notes?: string;
  sheetData?: unknown;
}

export async function getCharacter(id: number): Promise<Character> {
  const res = await fetch(`/api/characters/${id}`);
  const data = await parseOrThrow(res);
  return data.character;
}

export async function listMyCharacters(): Promise<Character[]> {
  const res = await fetch("/api/characters");
  const data = await parseOrThrow(res);
  return data.characters;
}

export async function listCampaignCharacters(campaignId: number): Promise<Character[]> {
  const res = await fetch(`/api/campaigns/${campaignId}/characters`);
  const data = await parseOrThrow(res);
  return data.characters;
}

export async function createCharacter(input: CharacterInput): Promise<Character> {
  const res = await fetch("/api/characters", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseOrThrow(res);
  return data.character;
}

export async function updateCharacter(id: number, input: Partial<CharacterInput>): Promise<Character> {
  const res = await fetch(`/api/characters/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await parseOrThrow(res);
  return data.character;
}

export async function deleteCharacter(id: number): Promise<void> {
  const res = await fetch(`/api/characters/${id}`, { method: "DELETE" });
  await parseOrThrow(res);
}

export async function attachCharacter(id: number, campaignId: number): Promise<Character> {
  const res = await fetch(`/api/characters/${id}/attach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ campaignId }),
  });
  const data = await parseOrThrow(res);
  return data.character;
}

export async function detachCharacter(id: number): Promise<Character> {
  const res = await fetch(`/api/characters/${id}/detach`, { method: "POST" });
  const data = await parseOrThrow(res);
  return data.character;
}

export function portraitUrl(id: number, version: number): string {
  return `/api/characters/${id}/portrait?v=${version}`;
}

export async function uploadPortrait(id: number, file: File): Promise<void> {
  const formData = new FormData();
  formData.append("portrait", file);
  const res = await fetch(`/api/characters/${id}/portrait`, { method: "POST", body: formData });
  await parseOrThrow(res);
}

export async function getShareToken(id: number): Promise<string | null> {
  const res = await fetch(`/api/characters/${id}/share`);
  const data = await parseOrThrow(res);
  return data.shareToken;
}

export async function mintShareToken(id: number): Promise<string> {
  const res = await fetch(`/api/characters/${id}/share`, { method: "POST" });
  const data = await parseOrThrow(res);
  return data.shareToken;
}

export async function revokeShareToken(id: number): Promise<void> {
  const res = await fetch(`/api/characters/${id}/share`, { method: "DELETE" });
  await parseOrThrow(res);
}

// Public, unauthenticated fetch of a shared character -- no credentials/session involved, matches
// the backend's public read-only router (sharedCharacters.routes.ts).
export async function getSharedCharacter(token: string): Promise<Character> {
  const res = await fetch(`/api/shared/characters/${token}`);
  const data = await parseOrThrow(res);
  return data.character;
}

export function sharedPortraitUrl(token: string): string {
  return `/api/shared/characters/${token}/portrait`;
}
