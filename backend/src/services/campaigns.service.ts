import crypto from "node:crypto";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  campaigns,
  campaignMemberships,
  users,
  encounters,
  combatants,
  shops,
  shopItems,
  diceRolls,
  notes,
  characters,
} from "../db/schema.js";
import type { CampaignDetail, CampaignMember, CampaignRole, CampaignSummary } from "shared";

export class InviteCodeNotFoundError extends Error {}
export class AlreadyMemberError extends Error {}

function generateInviteCode() {
  return crypto.randomBytes(5).toString("hex");
}

export async function createCampaign(ownerUserId: number, name: string, description?: string) {
  const inviteCode = generateInviteCode();

  const [campaign] = await db
    .insert(campaigns)
    .values({ name, description: description ?? null, ownerUserId, inviteCode })
    .returning();

  await db.insert(campaignMemberships).values({
    campaignId: campaign.id,
    userId: ownerUserId,
    role: "dm",
  });

  return campaign;
}

export function listCampaignsForUser(userId: number): CampaignSummary[] {
  const rows = db
    .select({
      id: campaigns.id,
      name: campaigns.name,
      description: campaigns.description,
      createdAt: campaigns.createdAt,
      role: campaignMemberships.role,
    })
    .from(campaignMemberships)
    .innerJoin(campaigns, eq(campaignMemberships.campaignId, campaigns.id))
    .where(eq(campaignMemberships.userId, userId))
    .all();

  return rows.map((r) => ({ ...r, role: r.role as CampaignRole }));
}

// For a global admin: every campaign site-wide, not just ones they belong to.
export function listAllCampaigns(): CampaignSummary[] {
  const rows = db
    .select({ id: campaigns.id, name: campaigns.name, description: campaigns.description, createdAt: campaigns.createdAt })
    .from(campaigns)
    .all();

  return rows.map((r) => ({ ...r, role: "dm" as CampaignRole }));
}

export function getCampaignOwnerId(campaignId: number): number | null {
  const row = db.select({ ownerUserId: campaigns.ownerUserId }).from(campaigns).where(eq(campaigns.id, campaignId)).get();
  return row?.ownerUserId ?? null;
}

export function getMembership(campaignId: number, userId: number) {
  return db
    .select()
    .from(campaignMemberships)
    .where(and(eq(campaignMemberships.campaignId, campaignId), eq(campaignMemberships.userId, userId)))
    .get();
}

export function getCampaignDetail(
  campaignId: number,
  requestingUserId: number,
  options?: { bypassMembership?: boolean },
): CampaignDetail | null {
  const campaign = db.select().from(campaigns).where(eq(campaigns.id, campaignId)).get();
  if (!campaign) return null;

  const membership = getMembership(campaignId, requestingUserId);
  if (!membership && !options?.bypassMembership) return null;

  const memberRows = db
    .select({
      userId: campaignMemberships.userId,
      username: users.username,
      role: campaignMemberships.role,
      joinedAt: campaignMemberships.joinedAt,
    })
    .from(campaignMemberships)
    .innerJoin(users, eq(campaignMemberships.userId, users.id))
    .where(eq(campaignMemberships.campaignId, campaignId))
    .all();

  const members: CampaignMember[] = memberRows.map((m) => ({ ...m, role: m.role as CampaignRole }));
  // An admin viewing a campaign they're not actually a member of is treated
  // as a DM for display/access purposes (full access, sees the invite code).
  const role: CampaignRole = (membership?.role as CampaignRole) ?? "dm";

  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    createdAt: campaign.createdAt,
    role,
    inviteCode: role === "dm" ? campaign.inviteCode : null,
    members,
    ownerUserId: campaign.ownerUserId,
  };
}

export async function updateCampaign(campaignId: number, updates: { name?: string; description?: string }) {
  const [updated] = await db
    .update(campaigns)
    .set(updates)
    .where(eq(campaigns.id, campaignId))
    .returning();
  return updated;
}

export async function regenerateInviteCode(campaignId: number) {
  const inviteCode = generateInviteCode();
  const [updated] = await db
    .update(campaigns)
    .set({ inviteCode })
    .where(eq(campaigns.id, campaignId))
    .returning();
  return updated;
}

/**
 * Tears down a campaign and everything scoped to it, in FK-safe child-first order (foreign_keys
 * pragma is ON, see db/client.ts). Characters are user-owned and decoupled from campaigns (#1/#10)
 * so they're detached (campaignId -> null), never deleted -- a shared PC survives its campaign
 * going away.
 */
export async function deleteCampaign(campaignId: number): Promise<void> {
  db.transaction((tx) => {
    const encounterRows = tx.select({ id: encounters.id }).from(encounters).where(eq(encounters.campaignId, campaignId)).all();
    const encounterIds = encounterRows.map((e) => e.id);
    if (encounterIds.length > 0) {
      tx.delete(combatants).where(inArray(combatants.encounterId, encounterIds)).run();
    }
    tx.delete(encounters).where(eq(encounters.campaignId, campaignId)).run();

    const shopRow = tx.select({ id: shops.id }).from(shops).where(eq(shops.campaignId, campaignId)).get();
    if (shopRow) {
      tx.delete(shopItems).where(eq(shopItems.shopId, shopRow.id)).run();
    }
    tx.delete(shops).where(eq(shops.campaignId, campaignId)).run();

    tx.delete(diceRolls).where(eq(diceRolls.campaignId, campaignId)).run();
    tx.delete(notes).where(eq(notes.campaignId, campaignId)).run();

    tx.update(characters).set({ campaignId: null }).where(eq(characters.campaignId, campaignId)).run();

    tx.delete(campaignMemberships).where(eq(campaignMemberships.campaignId, campaignId)).run();
    tx.delete(campaigns).where(eq(campaigns.id, campaignId)).run();
  });
}

export async function joinCampaignByInviteCode(userId: number, inviteCode: string) {
  const campaign = db.select().from(campaigns).where(eq(campaigns.inviteCode, inviteCode)).get();
  if (!campaign) {
    throw new InviteCodeNotFoundError("Invalid invite code");
  }

  const existing = getMembership(campaign.id, userId);
  if (existing) {
    throw new AlreadyMemberError("Already a member of this campaign");
  }

  await db.insert(campaignMemberships).values({
    campaignId: campaign.id,
    userId,
    role: "player",
  });

  return campaign;
}
