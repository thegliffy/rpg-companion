import { eq, desc, and, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { notes, users } from "../db/schema.js";
import type { Note } from "shared";

function toNote(row: typeof notes.$inferSelect, authorUsername: string): Note {
  return {
    id: row.id,
    campaignId: row.campaignId,
    authorUserId: row.authorUserId,
    authorUsername,
    title: row.title,
    contentMd: row.contentMd,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listNotesForCampaign(campaignId: number): Note[] {
  const rows = db
    .select({ note: notes, authorUsername: users.username })
    .from(notes)
    .innerJoin(users, eq(notes.authorUserId, users.id))
    .where(eq(notes.campaignId, campaignId))
    .orderBy(desc(notes.updatedAt))
    .all();

  return rows.map((r) => toNote(r.note, r.authorUsername));
}

export function getNoteRow(id: number) {
  return db.select().from(notes).where(eq(notes.id, id)).get();
}

export function getNote(id: number): Note | null {
  const row = db
    .select({ note: notes, authorUsername: users.username })
    .from(notes)
    .innerJoin(users, eq(notes.authorUserId, users.id))
    .where(eq(notes.id, id))
    .get();

  return row ? toNote(row.note, row.authorUsername) : null;
}

export function listPersonalNotes(userId: number): Note[] {
  const rows = db
    .select({ note: notes, authorUsername: users.username })
    .from(notes)
    .innerJoin(users, eq(notes.authorUserId, users.id))
    .where(and(eq(notes.authorUserId, userId), isNull(notes.campaignId)))
    .orderBy(desc(notes.updatedAt))
    .all();

  return rows.map((r) => toNote(r.note, r.authorUsername));
}

export async function createNote(campaignId: number | null, authorUserId: number, title: string, contentMd?: string) {
  const [created] = await db
    .insert(notes)
    .values({ campaignId, authorUserId, title, contentMd: contentMd ?? "" })
    .returning();

  return getNote(created.id)!;
}

export async function updateNote(id: number, updates: { title?: string; contentMd?: string }) {
  const dbUpdates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (updates.title !== undefined) dbUpdates.title = updates.title;
  if (updates.contentMd !== undefined) dbUpdates.contentMd = updates.contentMd;

  await db.update(notes).set(dbUpdates).where(eq(notes.id, id));
  return getNote(id)!;
}

export async function deleteNote(id: number) {
  await db.delete(notes).where(eq(notes.id, id));
}
