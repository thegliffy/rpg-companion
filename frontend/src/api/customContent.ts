import type { CustomContent, CustomContentType, CustomContentSystem } from "shared";

async function parseOrThrow(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Request failed");
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
