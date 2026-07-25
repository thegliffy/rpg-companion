/** Parses a query limit into a positive integer capped at `max` (default 200). Invalid/negative → `fallback`. */
export function parseLimit(raw: unknown, fallback = 50, max = 200): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(Math.floor(n), max);
}
