import type { CustomContent, CustomContentType, CustomContentSystem, ImportCustomContentResult, DuplicateContentPair } from "shared";

async function parseOrThrow(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    // describeSchemaIssues() (backend/src/lib/schemaErrors.ts, #177) already computes a
    // field-naming message ("Unknown field: X -- did you mean Y?") into body.messages; without
    // this, every validation failure surfaced as the generic body.error string with no way to
    // tell which field was wrong.
    const detail = Array.isArray(body.messages) && body.messages.length > 0 ? `: ${body.messages.join("; ")}` : "";
    throw new Error(`${body.error ?? "Request failed"}${detail}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function listCustomContent(): Promise<CustomContent[]> {
  const res = await fetch("/api/custom-content");
  const data = await parseOrThrow(res);
  return data.items;
}

export async function listPendingCustomContent(): Promise<CustomContent[]> {
  const res = await fetch("/api/custom-content/pending");
  const data = await parseOrThrow(res);
  return data.items;
}

export async function listDuplicateContent(): Promise<DuplicateContentPair[]> {
  const res = await fetch("/api/custom-content/duplicates");
  const data = await parseOrThrow(res);
  return data.pairs;
}

// Full single item, `data` included -- for opening the editor on an item that only appears in the
// admin's site-wide summary list (#134), which doesn't carry `data`.
export async function getCustomContent(id: number): Promise<CustomContent> {
  const res = await fetch(`/api/custom-content/${id}`);
  const data = await parseOrThrow(res);
  return data.item;
}

export async function createCustomContent(
  type: CustomContentType,
  system: CustomContentSystem,
  name: string,
  data: unknown,
): Promise<CustomContent> {
  const res = await fetch("/api/custom-content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, system, name, data }),
  });
  const body = await parseOrThrow(res);
  return body.item;
}

export async function importCustomContent(
  system: CustomContentSystem,
  items: { type: CustomContentType; name: string; data: unknown }[],
): Promise<ImportCustomContentResult[]> {
  const res = await fetch("/api/custom-content/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ system, items }),
  });
  const body = await parseOrThrow(res);
  return body.results;
}

export async function updateCustomContent(id: number, updates: { name?: string; data?: unknown }): Promise<CustomContent> {
  const res = await fetch(`/api/custom-content/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const body = await parseOrThrow(res);
  return body.item;
}

export async function deleteCustomContent(id: number): Promise<void> {
  const res = await fetch(`/api/custom-content/${id}`, { method: "DELETE" });
  await parseOrThrow(res);
}

export async function approveCustomContent(id: number): Promise<CustomContent> {
  const res = await fetch(`/api/custom-content/${id}/approve`, { method: "POST" });
  const body = await parseOrThrow(res);
  return body.item;
}

export async function unapproveCustomContent(id: number): Promise<CustomContent> {
  const res = await fetch(`/api/custom-content/${id}/unapprove`, { method: "POST" });
  const body = await parseOrThrow(res);
  return body.item;
}
