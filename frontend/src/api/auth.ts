import type { PublicUser } from "shared";

async function parseOrThrow(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Request failed");
  }
  return res.json();
}

export async function register(username: string, password: string): Promise<PublicUser> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await parseOrThrow(res);
  return data.user;
}

export async function login(username: string, password: string): Promise<PublicUser> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await parseOrThrow(res);
  return data.user;
}

export async function logout(): Promise<void> {
  const res = await fetch("/api/auth/logout", { method: "POST" });
  if (!res.ok) throw new Error("Failed to log out");
}

export async function fetchSession(): Promise<PublicUser | null> {
  const res = await fetch("/api/auth/session");
  if (res.status === 401) return null;
  const data = await parseOrThrow(res);
  return data.user;
}
