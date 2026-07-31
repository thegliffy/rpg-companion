import type { ApiTokenSummary, CreatedApiToken } from "shared";

async function parseOrThrow(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Request failed");
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function listTokens(): Promise<ApiTokenSummary[]> {
  const res = await fetch("/api/tokens");
  const data = await parseOrThrow(res);
  return data.tokens;
}

/** The returned `token` is the only copy that will ever exist -- nothing can retrieve it again. */
export async function createToken(name: string, expiresInDays?: number): Promise<CreatedApiToken> {
  const res = await fetch("/api/tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, expiresInDays }),
  });
  return parseOrThrow(res);
}

export async function deleteToken(id: number): Promise<void> {
  const res = await fetch(`/api/tokens/${id}`, { method: "DELETE" });
  await parseOrThrow(res);
}
