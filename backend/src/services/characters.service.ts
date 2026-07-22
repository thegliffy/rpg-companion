import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { characters, users, campaigns } from "../db/schema.js";
import type { Character } from "shared";
import { removePortraitFile } from "../lib/portraits.js";

function toCharacter(
  row: typeof characters.$inferSelect,
  ownerUsername: string,
  campaignName: string | null,
): Character {
  return {
    id: row.id,
    campaignId: row.campaignId,
    campaignName,
    ownerUserId: row.ownerUserId,
    ownerUsername,
    name: row.name,
    system: row.system as Character["system"],
    hpCurrent: row.hpCurrent,
    hpMax: row.hpMax,
    notes: row.notes,
    sheetData: JSON.parse(row.sheetData) as unknown,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const characterSelect = {
  character: characters,
  ownerUsername: users.username,
  campaignName: campaigns.name,
};

export function listCharactersForCampaign(campaignId: number): Character[] {
  const rows = db
    .select(characterSelect)
    .from(characters)
    .innerJoin(users, eq(characters.ownerUserId, users.id))
    .leftJoin(campaigns, eq(characters.campaignId, campaigns.id))
    .where(eq(characters.campaignId, campaignId))
    .all();

  return rows.map((r) => toCharacter(r.character, r.ownerUsername, r.campaignName));
}

export function listCharactersForOwner(ownerUserId: number): Character[] {
  const rows = db
    .select(characterSelect)
    .from(characters)
    .innerJoin(users, eq(characters.ownerUserId, users.id))
    .leftJoin(campaigns, eq(characters.campaignId, campaigns.id))
    .where(eq(characters.ownerUserId, ownerUserId))
    .all();

  return rows.map((r) => toCharacter(r.character, r.ownerUsername, r.campaignName));
}

export function getCharacterRow(id: number) {
  return db.select().from(characters).where(eq(characters.id, id)).get();
}

export function getCharacter(id: number): Character | null {
  const row = db
    .select(characterSelect)
    .from(characters)
    .innerJoin(users, eq(characters.ownerUserId, users.id))
    .leftJoin(campaigns, eq(characters.campaignId, campaigns.id))
    .where(eq(characters.id, id))
    .get();

  return row ? toCharacter(row.character, row.ownerUsername, row.campaignName) : null;
}

export async function createCharacter(
  ownerUserId: number,
  input: {
    campaignId?: number | null;
    name: string;
    system: Character["system"];
    hpCurrent?: number | null;
    hpMax?: number | null;
    notes?: string;
    sheetData: unknown;
  },
) {
  const [created] = await db
    .insert(characters)
    .values({
      campaignId: input.campaignId ?? null,
      ownerUserId,
      name: input.name,
      system: input.system,
      hpCurrent: input.hpCurrent ?? null,
      hpMax: input.hpMax ?? null,
      notes: input.notes ?? null,
      sheetData: JSON.stringify(input.sheetData),
    })
    .returning();

  return getCharacter(created.id)!;
}

export async function updateCharacter(
  id: number,
  updates: { name?: string; hpCurrent?: number | null; hpMax?: number | null; notes?: string; sheetData?: unknown },
) {
  const dbUpdates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.hpCurrent !== undefined) dbUpdates.hpCurrent = updates.hpCurrent;
  if (updates.hpMax !== undefined) dbUpdates.hpMax = updates.hpMax;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.sheetData !== undefined) dbUpdates.sheetData = JSON.stringify(updates.sheetData);

  await db.update(characters).set(dbUpdates).where(eq(characters.id, id));
  return getCharacter(id)!;
}

export async function setCharacterCampaign(id: number, campaignId: number | null) {
  await db
    .update(characters)
    .set({ campaignId, updatedAt: new Date().toISOString() })
    .where(eq(characters.id, id));
  return getCharacter(id)!;
}

export async function deleteCharacter(id: number) {
  await db.delete(characters).where(eq(characters.id, id));
  removePortraitFile(id);
}

export async function setCharacterPortrait(id: number, filename: string | null) {
  await db
    .update(characters)
    .set({ portraitFilename: filename, updatedAt: new Date().toISOString() })
    .where(eq(characters.id, id));
}
