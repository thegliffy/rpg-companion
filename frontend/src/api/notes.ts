import type { Note } from "shared";

async function parseOrThrow(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function listNotes(campaignId: number | null): Promise<Note[]> {
  const url = campaignId === null ? "/api/notes" : `/api/campaigns/${campaignId}/notes`;
  const res = await fetch(url);
  const data = await parseOrThrow(res);
  return data.notes;
}

export async function createNote(campaignId: number | null, title: string, contentMd?: string): Promise<Note> {
  const url = campaignId === null ? "/api/notes" : `/api/campaigns/${campaignId}/notes`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, contentMd }),
  });
  const data = await parseOrThrow(res);
  return data.note;
}

export async function updateNote(id: number, updates: { title?: string; contentMd?: string }): Promise<Note> {
  const res = await fetch(`/api/notes/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const data = await parseOrThrow(res);
  return data.note;
}

export async function deleteNote(id: number): Promise<void> {
  const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
  await parseOrThrow(res);
}
