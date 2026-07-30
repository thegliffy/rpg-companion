import { eq, or } from "drizzle-orm";
import { db } from "../db/client.js";
import { customContent, users } from "../db/schema.js";
import type { CustomContent, CustomContentType, CustomContentSystem, CustomContentStatus, AdminContentSummary } from "shared";

function toCustomContent(row: typeof customContent.$inferSelect, creatorUsername: string): CustomContent {
  return {
    id: row.id,
    type: row.type as CustomContentType,
    system: row.system as CustomContentSystem,
    createdByUserId: row.createdByUserId,
    createdByUsername: creatorUsername,
    name: row.name,
    data: JSON.parse(row.data),
    status: row.status as CustomContent["status"],
    approvedByUserId: row.approvedByUserId,
    approvedAt: row.approvedAt,
    createdAt: row.createdAt,
  };
}

export function getCustomContentRow(id: number) {
  return db.select().from(customContent).where(eq(customContent.id, id)).get();
}

export function getCustomContent(id: number): CustomContent | null {
  const row = db
    .select({ content: customContent, username: users.username })
    .from(customContent)
    .innerJoin(users, eq(customContent.createdByUserId, users.id))
    .where(eq(customContent.id, id))
    .get();
  return row ? toCustomContent(row.content, row.username) : null;
}

// Visible to a given user: every approved item, plus their own pending items.
export function listVisibleCustomContent(userId: number): CustomContent[] {
  const rows = db
    .select({ content: customContent, username: users.username })
    .from(customContent)
    .innerJoin(users, eq(customContent.createdByUserId, users.id))
    .where(or(eq(customContent.status, "approved"), eq(customContent.createdByUserId, userId)))
    .all();
  return rows.map((r) => toCustomContent(r.content, r.username));
}

export function listPendingCustomContent(): CustomContent[] {
  const rows = db
    .select({ content: customContent, username: users.username })
    .from(customContent)
    .innerJoin(users, eq(customContent.createdByUserId, users.id))
    .where(eq(customContent.status, "pending"))
    .all();
  return rows.map((r) => toCustomContent(r.content, r.username));
}

// Admin-only, site-wide (#128) -- every item regardless of status or owner, unlike
// listVisibleCustomContent above which feeds the player-facing pickers and must stay
// approved-plus-own-pending. Lean summary (no `data`): an admin list view doesn't need a whole
// class/monster payload per row, only single-item fetches for editing do.
export function listAllCustomContent(): AdminContentSummary[] {
  const rows = db
    .select({
      id: customContent.id,
      type: customContent.type,
      system: customContent.system,
      createdByUserId: customContent.createdByUserId,
      createdByUsername: users.username,
      name: customContent.name,
      status: customContent.status,
      approvedByUserId: customContent.approvedByUserId,
      approvedAt: customContent.approvedAt,
      createdAt: customContent.createdAt,
    })
    .from(customContent)
    .innerJoin(users, eq(customContent.createdByUserId, users.id))
    .all();
  return rows.map((r) => ({
    ...r,
    type: r.type as CustomContentType,
    system: r.system as CustomContentSystem,
    status: r.status as CustomContentStatus,
  }));
}

export async function createCustomContent(
  userId: number,
  type: CustomContentType,
  system: CustomContentSystem,
  name: string,
  data: unknown,
) {
  const [created] = await db
    .insert(customContent)
    .values({ type, system, createdByUserId: userId, name, data: JSON.stringify(data) })
    .returning();
  return created;
}

export async function updateCustomContent(id: number, updates: { name?: string; data?: unknown }) {
  const values: { name?: string; data?: string } = {};
  if (updates.name !== undefined) values.name = updates.name;
  if (updates.data !== undefined) values.data = JSON.stringify(updates.data);
  const [updated] = await db.update(customContent).set(values).where(eq(customContent.id, id)).returning();
  return updated;
}

export async function approveCustomContent(id: number, approvedByUserId: number) {
  const [updated] = await db
    .update(customContent)
    .set({ status: "approved", approvedByUserId, approvedAt: new Date().toISOString() })
    .where(eq(customContent.id, id))
    .returning();
  return updated;
}

// Reverses approveCustomContent (#131) -- e.g. an admin discovers a published item shouldn't have
// been public yet. Note this is "not public yet", not "this is wrong": anything that already
// resolved a reference to this item as custom-${id} (a spell's srdId, a background's grantedFeats,
// a race trait's grantedSpells) stops resolving for everyone except the author the moment it
// leaves "approved", and renders as a bare unresolved name -- the caller should warn about that,
// not this function, since it has no way to know who references what.
export async function unapproveCustomContent(id: number) {
  const [updated] = await db
    .update(customContent)
    .set({ status: "pending", approvedByUserId: null, approvedAt: null })
    .where(eq(customContent.id, id))
    .returning();
  return updated;
}

export async function deleteCustomContent(id: number) {
  await db.delete(customContent).where(eq(customContent.id, id));
}
