import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { characters, users, campaigns } from "../db/schema.js";
import type { Character, Dnd5eSheetData, AdminCharacterSummary } from "shared";
import { removePortraitFile } from "../lib/portraits.js";
import { isGlobalAdmin } from "./users.service.js";
import { getMembership } from "./campaigns.service.js";

export class CharacterConflictError extends Error {
  constructor(message = "Character was modified elsewhere — reload and try again") {
    super(message);
    this.name = "CharacterConflictError";
  }
}

// The DM (not the owner) never sees the owner's private notes — a global admin is a deliberate
// exception ("admin sees everything"). Used on any single-character read (GET/PATCH /:id).
export function redactPrivateNotesIfNotOwner<T extends { system: string; ownerUserId: number; sheetData: unknown }>(
  character: T,
  requesterId: number,
): T {
  if (character.system === "dnd5e" && character.ownerUserId !== requesterId && !isGlobalAdmin(requesterId)) {
    return { ...character, sheetData: { ...(character.sheetData as Dnd5eSheetData), privateNotes: "" } };
  }
  return character;
}

// The campaign character list is read by every member (not just owner-or-DM the way GET /:id is),
// so it needs a stricter redaction than a single-character read: privateNotes stays owner/admin-
// only as always, and the general `notes` field (meant to be visible to the DM running the
// character, same as the sheet itself) is now also hidden from plain co-players who are neither
// the owner nor the campaign's DM.
export function redactForCampaignMember<
  T extends { system: string; ownerUserId: number; sheetData: unknown; notes: string | null },
>(character: T, requesterId: number, requesterRole: "dm" | "player"): T {
  const result = redactPrivateNotesIfNotOwner(character, requesterId);
  if (result.ownerUserId !== requesterId && requesterRole !== "dm" && !isGlobalAdmin(requesterId)) {
    return { ...result, notes: null };
  }
  return result;
}

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

// Admin-only, site-wide (#128) -- every character regardless of owner. Lean summary (no
// sheetData): a full sheet payload per row (which also carries the owner-only privateNotes field)
// has no place in a list view; single-character fetches still return the full shape. `level` and
// `status` are pulled out of the stored sheetData server-side without shipping the rest of it --
// null for a system that doesn't model the concept (pf2e/generic have no status) or a
// malformed/legacy row.
export function listAllCharacters(): AdminCharacterSummary[] {
  const rows = db
    .select({
      id: characters.id,
      name: characters.name,
      ownerUserId: characters.ownerUserId,
      ownerUsername: users.username,
      campaignId: characters.campaignId,
      campaignName: campaigns.name,
      system: characters.system,
      sheetData: characters.sheetData,
      updatedAt: characters.updatedAt,
    })
    .from(characters)
    .innerJoin(users, eq(characters.ownerUserId, users.id))
    .leftJoin(campaigns, eq(characters.campaignId, campaigns.id))
    .all();

  return rows.map((r) => {
    let level: number | null = null;
    let status: AdminCharacterSummary["status"] = null;
    try {
      const parsed = JSON.parse(r.sheetData) as Record<string, unknown>;
      if (typeof parsed.level === "number") level = parsed.level;
      if (parsed.status === "active" || parsed.status === "dead" || parsed.status === "retired") status = parsed.status;
    } catch {
      // Malformed/legacy sheetData -- summary just omits level/status rather than failing the list.
    }
    return {
      id: r.id,
      name: r.name,
      ownerUserId: r.ownerUserId,
      ownerUsername: r.ownerUsername,
      campaignId: r.campaignId,
      campaignName: r.campaignName,
      system: r.system as Character["system"],
      level,
      status,
      updatedAt: r.updatedAt,
    };
  });
}

export function getCharacterRow(id: number) {
  return db.select().from(characters).where(eq(characters.id, id)).get();
}

/** Raw row lookup by share token -- used by the public portrait endpoint, which needs
 * portraitFilename (not part of the public Character shape). */
export function getCharacterRowByShareToken(token: string) {
  return db.select().from(characters).where(eq(characters.shareToken, token)).get();
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
  options?: { expectedUpdatedAt?: string },
) {
  const dbUpdates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.hpCurrent !== undefined) dbUpdates.hpCurrent = updates.hpCurrent;
  if (updates.hpMax !== undefined) dbUpdates.hpMax = updates.hpMax;
  if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
  if (updates.sheetData !== undefined) dbUpdates.sheetData = JSON.stringify(updates.sheetData);

  const conditions = [eq(characters.id, id)];
  if (options?.expectedUpdatedAt !== undefined) {
    conditions.push(eq(characters.updatedAt, options.expectedUpdatedAt));
  }

  const updated = db
    .update(characters)
    .set(dbUpdates)
    .where(and(...conditions))
    .returning({ id: characters.id })
    .get();

  if (!updated) {
    if (options?.expectedUpdatedAt !== undefined && getCharacter(id)) {
      throw new CharacterConflictError();
    }
    throw new Error("Character not found");
  }

  return getCharacter(id)!;
}

// Admin-only (#133) -- genuinely new: nothing else in the app writes ownerUserId after creation.
// If the character is attached to a campaign the new owner isn't a member of, it's detached rather
// than left owned-by-a-non-member or silently auto-joining the new owner to a campaign they never
// asked to join (same refusal-to-act-without-authorization #123's importer applies).
export async function reassignCharacterOwner(id: number, newOwnerUserId: number) {
  const row = getCharacterRow(id);
  if (!row) return null;

  const updates: { ownerUserId: number; updatedAt: string; campaignId?: null } = {
    ownerUserId: newOwnerUserId,
    updatedAt: new Date().toISOString(),
  };
  if (row.campaignId !== null && !getMembership(row.campaignId, newOwnerUserId)) {
    updates.campaignId = null;
  }

  await db.update(characters).set(updates).where(eq(characters.id, id));
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

/** Mints a share token if the character doesn't already have one (idempotent -- re-minting
 * returns the existing token rather than rotating it, so an already-distributed link stays valid). */
export async function mintShareToken(id: number): Promise<string> {
  const row = db.select({ shareToken: characters.shareToken }).from(characters).where(eq(characters.id, id)).get();
  if (row?.shareToken) return row.shareToken;

  const token = randomBytes(24).toString("base64url");
  await db.update(characters).set({ shareToken: token }).where(eq(characters.id, id));
  return token;
}

/** Revoking sets share_token back to null -- any outstanding link 404s on its next request. */
export async function revokeShareToken(id: number): Promise<void> {
  await db.update(characters).set({ shareToken: null }).where(eq(characters.id, id));
}

export function getShareToken(id: number): string | null {
  const row = db.select({ shareToken: characters.shareToken }).from(characters).where(eq(characters.id, id)).get();
  return row?.shareToken ?? null;
}

/** Public lookup by share token -- the only way an anonymous request can resolve a character.
 * Deliberately a read (Character), never anything with a write path. */
export function getCharacterByShareToken(token: string): Character | null {
  const row = db
    .select(characterSelect)
    .from(characters)
    .innerJoin(users, eq(characters.ownerUserId, users.id))
    .leftJoin(campaigns, eq(characters.campaignId, campaigns.id))
    .where(eq(characters.shareToken, token))
    .get();

  return row ? toCharacter(row.character, row.ownerUsername, row.campaignName) : null;
}
