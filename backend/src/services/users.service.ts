import bcrypt from "bcrypt";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { users, characters, campaigns, campaignMemberships, customContent, diceRolls, notes, apiTokens } from "../db/schema.js";
import type { PublicUser, GlobalRole, AdminUserDependants, ThemeId } from "shared";

const SALT_ROUNDS = 12;

export class UsernameTakenError extends Error {}

export function toPublicUser(user: typeof users.$inferSelect): PublicUser {
  return {
    id: user.id,
    username: user.username,
    role: user.role as GlobalRole,
    createdAt: user.createdAt,
    theme: (user.theme as ThemeId | null) ?? null,
  };
}

export async function updateUserTheme(id: number, theme: ThemeId) {
  // "default" is stored as null rather than a literal, so there's exactly one representation of
  // "no preference" -- the same one every pre-#154 row already has.
  const [updated] = await db
    .update(users)
    .set({ theme: theme === "default" ? null : theme })
    .where(eq(users.id, id))
    .returning();
  return updated;
}

export async function createUser(username: string, password: string) {
  const existing = db.select().from(users).where(eq(users.username, username)).get();
  if (existing) {
    throw new UsernameTakenError(`Username "${username}" is already taken`);
  }

  // Hash outside the transaction — bcrypt is slow. Count+insert must be atomic so two
  // concurrent first registrations cannot both observe an empty table and both become admin.
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  try {
    return db.transaction((tx) => {
      const { count } = tx.select({ count: sql<number>`count(*)` }).from(users).get()!;
      const role: GlobalRole = count === 0 ? "admin" : "player";
      const created = tx.insert(users).values({ username, passwordHash, role }).returning().get();
      return created!;
    });
  } catch (err) {
    // Unique username race: another request inserted the same name between our check and insert.
    const again = db.select().from(users).where(eq(users.username, username)).get();
    if (again) {
      throw new UsernameTakenError(`Username "${username}" is already taken`);
    }
    throw err;
  }
}

export function listUsers() {
  return db.select().from(users).orderBy(users.id).all();
}

export async function updateUserRole(id: number, role: GlobalRole) {
  const [updated] = await db.update(users).set({ role }).where(eq(users.id, id)).returning();
  return updated;
}

export async function resetUserPassword(id: number, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const [updated] = await db.update(users).set({ passwordHash }).where(eq(users.id, id)).returning();
  return updated;
}

export function findUserByUsername(username: string) {
  return db.select().from(users).where(eq(users.username, username)).get();
}

export function findUserById(id: number) {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export function isGlobalAdmin(userId: number): boolean {
  return findUserById(userId)?.role === "admin";
}

// Six of the eight FKs to users.id are NOT NULL (only encounters.ownerUserId and
// customContent.approvedByUserId are nullable) and foreign_keys=ON is set in db/client.ts, so a
// bare user delete fails at the DB with an opaque constraint error. Counted up front (#135) so the
// route can return a 409 with a breakdown instead, and reassign/delete is a decision the admin
// makes deliberately rather than something that cascades silently.
export function countUserDependants(userId: number): AdminUserDependants {
  const characterCount = db.select({ count: sql<number>`count(*)` }).from(characters).where(eq(characters.ownerUserId, userId)).get()!.count;
  const campaignsOwnedCount = db.select({ count: sql<number>`count(*)` }).from(campaigns).where(eq(campaigns.ownerUserId, userId)).get()!.count;
  const campaignMembershipCount = db
    .select({ count: sql<number>`count(*)` })
    .from(campaignMemberships)
    .where(eq(campaignMemberships.userId, userId))
    .get()!.count;
  const customContentCount = db
    .select({ count: sql<number>`count(*)` })
    .from(customContent)
    .where(eq(customContent.createdByUserId, userId))
    .get()!.count;
  const diceRollCount = db.select({ count: sql<number>`count(*)` }).from(diceRolls).where(eq(diceRolls.userId, userId)).get()!.count;
  const noteCount = db.select({ count: sql<number>`count(*)` }).from(notes).where(eq(notes.authorUserId, userId)).get()!.count;
  const apiTokenCount = db.select({ count: sql<number>`count(*)` }).from(apiTokens).where(eq(apiTokens.userId, userId)).get()!.count;

  return {
    characters: characterCount,
    campaignsOwned: campaignsOwnedCount,
    campaignMemberships: campaignMembershipCount,
    customContent: customContentCount,
    diceRolls: diceRollCount,
    notes: noteCount,
    apiTokens: apiTokenCount,
  };
}

export function hasAnyDependants(d: AdminUserDependants): boolean {
  return Object.values(d).some((n) => n > 0);
}

export function countAdmins(): number {
  return db.select({ count: sql<number>`count(*)` }).from(users).where(eq(users.role, "admin")).get()!.count;
}

export async function deleteUser(id: number) {
  await db.delete(users).where(eq(users.id, id));
}

export async function verifyPassword(user: typeof users.$inferSelect, password: string) {
  return bcrypt.compare(password, user.passwordHash);
}
