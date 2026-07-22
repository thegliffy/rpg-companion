import type { PublicUser, GlobalRole } from "shared";

async function parseOrThrow(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Request failed");
  }
  return res.json();
}

export async function listUsers(): Promise<PublicUser[]> {
  const res = await fetch("/api/admin/users");
  const data = await parseOrThrow(res);
  return data.users;
}

export async function updateUserRole(id: number, role: GlobalRole): Promise<PublicUser> {
  const res = await fetch(`/api/admin/users/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
  const data = await parseOrThrow(res);
  return data.user;
}

export async function resetUserPassword(id: number, password: string): Promise<PublicUser> {
  const res = await fetch(`/api/admin/users/${id}/password`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const data = await parseOrThrow(res);
  return data.user;
}
