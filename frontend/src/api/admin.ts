import type { PublicUser, GlobalRole, AdminContentSummary, AdminCharacterSummary, AdminUserDependants, Character } from "shared";

// Thrown specifically for the 409 a blocked user-delete returns (#135), so the caller can render
// the dependant breakdown instead of just a generic error string.
export class UserHasDependantsError extends Error {
  dependants: AdminUserDependants;
  constructor(message: string, dependants: AdminUserDependants) {
    super(message);
    this.name = "UserHasDependantsError";
    this.dependants = dependants;
  }
}

async function parseOrThrow(res: Response) {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    if (res.status === 409 && body.dependants) {
      throw new UserHasDependantsError(body.error ?? "Request failed", body.dependants);
    }
    throw new Error(body.error ?? "Request failed");
  }
  if (res.status === 204) return null;
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

export async function deleteUser(id: number): Promise<void> {
  const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
  await parseOrThrow(res);
}

export async function listAllContent(): Promise<AdminContentSummary[]> {
  const res = await fetch("/api/admin/content");
  const data = await parseOrThrow(res);
  return data.items;
}

export async function listAllCharacters(): Promise<AdminCharacterSummary[]> {
  const res = await fetch("/api/admin/characters");
  const data = await parseOrThrow(res);
  return data.characters;
}

export async function reassignCharacterOwner(id: number, ownerUserId: number): Promise<Character> {
  const res = await fetch(`/api/admin/characters/${id}/owner`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ownerUserId }),
  });
  const data = await parseOrThrow(res);
  return data.character;
}
