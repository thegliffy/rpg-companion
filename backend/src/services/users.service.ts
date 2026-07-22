import bcrypt from "bcrypt";
import { eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import type { PublicUser, GlobalRole } from "shared";

const SALT_ROUNDS = 12;

export class UsernameTakenError extends Error {}

export function toPublicUser(user: typeof users.$inferSelect): PublicUser {
  return { id: user.id, username: user.username, role: user.role as GlobalRole, createdAt: user.createdAt };
}

export async function createUser(username: string, password: string) {
  const existing = db.select().from(users).where(eq(users.username, username)).get();
  if (existing) {
    throw new UsernameTakenError(`Username "${username}" is already taken`);
  }

  // Bootstrap: the very first account ever registered on this server becomes admin.
  const { count } = db.select({ count: sql<number>`count(*)` }).from(users).get()!;
  const role: GlobalRole = count === 0 ? "admin" : "player";

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const [created] = await db
    .insert(users)
    .values({ username, passwordHash, role })
    .returning();

  return created;
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

export async function verifyPassword(user: typeof users.$inferSelect, password: string) {
  return bcrypt.compare(password, user.passwordHash);
}
