import { eq, and, desc, asc, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { encounters, combatants } from "../db/schema.js";
import type { EncounterSnapshot, Combatant } from "shared";

function toCombatant(row: typeof combatants.$inferSelect): Combatant {
  return {
    id: row.id,
    characterId: row.characterId,
    name: row.name,
    initiative: row.initiative,
    hpCurrent: row.hpCurrent,
    hpMax: row.hpMax,
    conditions: JSON.parse(row.conditions) as string[],
    sortOrder: row.sortOrder,
  };
}

export function getEncounterSnapshot(encounterId: number): EncounterSnapshot | null {
  const encounter = db.select().from(encounters).where(eq(encounters.id, encounterId)).get();
  if (!encounter) return null;

  const combatantRows = db
    .select()
    .from(combatants)
    .where(eq(combatants.encounterId, encounterId))
    .orderBy(desc(combatants.initiative), asc(combatants.sortOrder))
    .all();

  return {
    id: encounter.id,
    campaignId: encounter.campaignId,
    ownerUserId: encounter.ownerUserId,
    name: encounter.name,
    isActive: encounter.isActive,
    round: encounter.round,
    currentTurnIndex: encounter.currentTurnIndex,
    combatants: combatantRows.map(toCombatant),
  };
}

export function getActiveEncounterForCampaign(campaignId: number): EncounterSnapshot | null {
  const encounter = db
    .select()
    .from(encounters)
    .where(and(eq(encounters.campaignId, campaignId), eq(encounters.isActive, true)))
    .get();

  return encounter ? getEncounterSnapshot(encounter.id) : null;
}

export function getEncounterRow(id: number) {
  return db.select().from(encounters).where(eq(encounters.id, id)).get();
}

export async function startEncounter(campaignId: number, name?: string) {
  await db
    .update(encounters)
    .set({ isActive: false })
    .where(and(eq(encounters.campaignId, campaignId), eq(encounters.isActive, true)));

  const [created] = await db
    .insert(encounters)
    .values({ campaignId, name: name ?? "Encounter" })
    .returning();

  return getEncounterSnapshot(created.id)!;
}

export function getActiveEncounterForOwner(ownerUserId: number): EncounterSnapshot | null {
  const encounter = db
    .select()
    .from(encounters)
    .where(
      and(
        eq(encounters.ownerUserId, ownerUserId),
        isNull(encounters.campaignId),
        eq(encounters.isActive, true),
      ),
    )
    .get();

  return encounter ? getEncounterSnapshot(encounter.id) : null;
}

export async function startPersonalEncounter(ownerUserId: number, name?: string) {
  await db
    .update(encounters)
    .set({ isActive: false })
    .where(
      and(
        eq(encounters.ownerUserId, ownerUserId),
        isNull(encounters.campaignId),
        eq(encounters.isActive, true),
      ),
    );

  const [created] = await db
    .insert(encounters)
    .values({ campaignId: null, ownerUserId, name: name ?? "Encounter" })
    .returning();

  return getEncounterSnapshot(created.id)!;
}

export async function endEncounter(encounterId: number) {
  await db.update(encounters).set({ isActive: false }).where(eq(encounters.id, encounterId));
  return getEncounterSnapshot(encounterId)!;
}

export async function addCombatant(
  encounterId: number,
  input: {
    characterId?: number | null;
    name: string;
    initiative: number;
    hpCurrent?: number | null;
    hpMax?: number | null;
    conditions?: string[];
  },
) {
  const existing = db
    .select()
    .from(combatants)
    .where(eq(combatants.encounterId, encounterId))
    .all();
  const nextSortOrder = existing.length > 0 ? Math.max(...existing.map((c) => c.sortOrder)) + 1 : 0;

  await db.insert(combatants).values({
    encounterId,
    characterId: input.characterId ?? null,
    name: input.name,
    initiative: input.initiative,
    hpCurrent: input.hpCurrent ?? null,
    hpMax: input.hpMax ?? null,
    conditions: JSON.stringify(input.conditions ?? []),
    sortOrder: nextSortOrder,
  });

  return getEncounterSnapshot(encounterId)!;
}

export function getCombatantRow(id: number) {
  return db.select().from(combatants).where(eq(combatants.id, id)).get();
}

/** Finds the combatant row for a character in their campaign's currently active encounter, if any. */
export function findActiveCombatantForCharacter(campaignId: number, characterId: number) {
  const encounter = db
    .select()
    .from(encounters)
    .where(and(eq(encounters.campaignId, campaignId), eq(encounters.isActive, true)))
    .get();
  if (!encounter) return null;

  return (
    db
      .select()
      .from(combatants)
      .where(and(eq(combatants.encounterId, encounter.id), eq(combatants.characterId, characterId)))
      .get() ?? null
  );
}

export async function syncCombatantConditions(combatantId: number, conditions: string[]) {
  await db.update(combatants).set({ conditions: JSON.stringify(conditions) }).where(eq(combatants.id, combatantId));
  const combatant = getCombatantRow(combatantId)!;
  return getEncounterSnapshot(combatant.encounterId)!;
}

export async function updateCombatant(
  id: number,
  updates: { name?: string; initiative?: number; hpCurrent?: number | null; hpMax?: number | null; conditions?: string[] },
) {
  const combatant = getCombatantRow(id);
  if (!combatant) throw new Error("Combatant not found");

  const dbUpdates: Record<string, unknown> = {};
  if (updates.name !== undefined) dbUpdates.name = updates.name;
  if (updates.initiative !== undefined) dbUpdates.initiative = updates.initiative;
  if (updates.hpCurrent !== undefined) dbUpdates.hpCurrent = updates.hpCurrent;
  if (updates.hpMax !== undefined) dbUpdates.hpMax = updates.hpMax;
  if (updates.conditions !== undefined) dbUpdates.conditions = JSON.stringify(updates.conditions);

  await db.update(combatants).set(dbUpdates).where(eq(combatants.id, id));
  return getEncounterSnapshot(combatant.encounterId)!;
}

export async function removeCombatant(id: number) {
  const combatant = getCombatantRow(id);
  if (!combatant) throw new Error("Combatant not found");

  await db.delete(combatants).where(eq(combatants.id, id));
  return getEncounterSnapshot(combatant.encounterId)!;
}

export async function advanceTurn(encounterId: number) {
  const encounter = getEncounterRow(encounterId);
  if (!encounter) throw new Error("Encounter not found");

  const count = db
    .select()
    .from(combatants)
    .where(eq(combatants.encounterId, encounterId))
    .all().length;

  if (count === 0) return getEncounterSnapshot(encounterId)!;

  let nextIndex = encounter.currentTurnIndex + 1;
  let nextRound = encounter.round;
  if (nextIndex >= count) {
    nextIndex = 0;
    nextRound += 1;
  }

  await db
    .update(encounters)
    .set({ currentTurnIndex: nextIndex, round: nextRound })
    .where(eq(encounters.id, encounterId));

  return getEncounterSnapshot(encounterId)!;
}
