import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { npcs, campaigns } from "../db/schema.js";
import type { Npc, CreateNpcInput, UpdateNpcInput } from "shared";
import { generateNpc, generateImage, type NpcProse } from "./ai.service.js";
import { saveGeneratedImage, removeGeneratedImage } from "../lib/portraits.js";

function toNpc(row: typeof npcs.$inferSelect): Npc {
  return { ...row };
}

export function listNpcs(campaignId: number): Npc[] {
  return db
    .select()
    .from(npcs)
    .where(eq(npcs.campaignId, campaignId))
    .orderBy(npcs.name)
    .all()
    .map(toNpc);
}

export function getNpcRow(id: number) {
  return db.select().from(npcs).where(eq(npcs.id, id)).get();
}

export async function createNpc(campaignId: number, input: CreateNpcInput): Promise<Npc> {
  const [created] = await db
    .insert(npcs)
    .values({
      campaignId,
      name: input.name,
      role: input.role ?? "",
      appearance: input.appearance ?? "",
      personality: input.personality ?? "",
      motivation: input.motivation ?? "",
      secret: input.secret ?? "",
      notes: input.notes ?? "",
    })
    .returning();
  return toNpc(created);
}

export async function updateNpc(id: number, updates: UpdateNpcInput & { imageFilename?: string | null }): Promise<Npc | null> {
  const [updated] = await db
    .update(npcs)
    .set({ ...updates, updatedAt: new Date().toISOString() })
    .where(eq(npcs.id, id))
    .returning();
  return updated ? toNpc(updated) : null;
}

export async function deleteNpc(id: number): Promise<boolean> {
  const row = getNpcRow(id);
  if (!row) return false;
  removeGeneratedImage(row.imageFilename);
  await db.delete(npcs).where(eq(npcs.id, id));
  return true;
}

/** Fills the NPC's prose fields via the LLM (existing fields act as canon hints) and returns
 * the updated NPC. Art is a separate explicit action (generateNpcArt) — generation is billed
 * per feature so the UI can offer them independently. */
export async function generateNpcProse(id: number, instructions?: string): Promise<Npc | null> {
  const row = getNpcRow(id);
  if (!row) return null;
  const campaign = db.select().from(campaigns).where(eq(campaigns.id, row.campaignId)).get();
  const hints: Partial<NpcProse> & { notes?: string } = {
    name: row.name,
    role: row.role,
    appearance: row.appearance,
    personality: row.personality,
    motivation: row.motivation,
    secret: row.secret,
  };
  if (instructions) hints.notes = instructions;
  const prose = await generateNpc(campaign?.name ?? "a campaign", hints);
  return updateNpc(id, prose);
}

/** Builds an art prompt from the NPC's own fields (appearance leads when present). */
export function buildNpcArtPrompt(npc: Npc, instructions?: string): string {
  const parts = [
    npc.appearance || "fantasy character",
    npc.role ? `${npc.role} NPC` : "NPC",
    npc.personality ? `expression reflecting: ${npc.personality.split(/[.;]/)[0]}` : "",
    instructions ?? "",
    "detailed fantasy character art, head and shoulders, dramatic lighting, painted, high detail",
  ]
    .filter(Boolean)
    .join(", ");
  return parts;
}

export async function generateNpcArt(id: number, instructions?: string): Promise<Npc | null> {
  const npc = getNpcRow(id);
  if (!npc) return null;
  const buffer = await generateImage(buildNpcArtPrompt(toNpc(npc), instructions));
  const filename = saveGeneratedImage(`npc-${id}`, buffer);
  return updateNpc(id, { imageFilename: filename });
}
