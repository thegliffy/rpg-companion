import { eq, desc, and, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { diceRolls, users } from "../db/schema.js";
import type { DiceRoll } from "shared";
import { rollDice } from "../lib/dice.js";

function toDiceRoll(row: typeof diceRolls.$inferSelect, username: string): DiceRoll {
  return {
    id: row.id,
    campaignId: row.campaignId,
    userId: row.userId,
    username,
    formula: row.formula,
    label: row.label,
    total: row.total,
    breakdown: row.breakdown,
    createdAt: row.createdAt,
  };
}

export async function createRoll(campaignId: number | null, userId: number, formula: string, label?: string) {
  const { total, breakdown } = rollDice(formula);

  const [created] = await db
    .insert(diceRolls)
    .values({ campaignId, userId, formula, label: label ?? null, total, breakdown })
    .returning();

  const user = db.select().from(users).where(eq(users.id, userId)).get()!;
  return toDiceRoll(created, user.username);
}

export function listPersonalRolls(userId: number, limit: number): DiceRoll[] {
  const rows = db
    .select({ roll: diceRolls, username: users.username })
    .from(diceRolls)
    .innerJoin(users, eq(diceRolls.userId, users.id))
    .where(and(eq(diceRolls.userId, userId), isNull(diceRolls.campaignId)))
    .orderBy(desc(diceRolls.createdAt))
    .limit(limit)
    .all();

  return rows.map((r) => toDiceRoll(r.roll, r.username));
}

export function listRecentRolls(campaignId: number, limit: number): DiceRoll[] {
  const rows = db
    .select({ roll: diceRolls, username: users.username })
    .from(diceRolls)
    .innerJoin(users, eq(diceRolls.userId, users.id))
    .where(eq(diceRolls.campaignId, campaignId))
    .orderBy(desc(diceRolls.createdAt))
    .limit(limit)
    .all();

  return rows.map((r) => toDiceRoll(r.roll, r.username));
}
