/** Stable unique id for client/server-created sheet entities (items, spells, attacks, …). */
export function newEntityId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}
