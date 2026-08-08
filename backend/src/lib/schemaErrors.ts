import type { z } from "zod";

/** Levenshtein distance, capped small -- only used to rank a handful of candidate field names. */
function editDistance(a: string, b: string): number {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = Math.min(
        prev[j] + 1, // deletion
        prev[j - 1] + 1, // insertion
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1), // substitution
      );
      diagonal = prev[j];
      prev[j] = next;
    }
  }
  return prev[b.length];
}

/** The closest known field to `key`, or null when nothing is close enough to be worth suggesting.
 * The threshold scales with the key's length so short names don't match everything. */
function nearestField(key: string, known: string[]): string | null {
  const limit = Math.max(2, Math.floor(key.length / 3));
  let best: { field: string; distance: number } | null = null;
  for (const field of known) {
    const distance = editDistance(key.toLowerCase(), field.toLowerCase());
    if (distance <= limit && (!best || distance < best.distance)) best = { field, distance };
  }
  return best?.field ?? null;
}

/** Field names a zod object schema accepts at a given path, for "did you mean" suggestions.
 * Walks the schema by the issue's path so a nested object suggests its *own* fields. Returns an
 * empty list for anything that isn't a plain object at that point (unions, arrays of scalars). */
function knownFieldsAt(schema: z.ZodTypeAny, path: (string | number)[]): string[] {
  let current: any = schema;
  for (const segment of path) {
    // Unwrap the containers a data schema can be built from before indexing into it.
    for (let i = 0; i < 10; i++) {
      if (current?._def?.schema) current = current._def.schema; // ZodEffects (z.preprocess)
      else if (current?._def?.innerType) current = current._def.innerType; // optional/default
      else if (current?._def?.type && typeof segment === "number") current = current._def.type; // array
      else break;
    }
    if (typeof segment === "string" && current?.shape) current = current.shape[segment];
    if (!current) return [];
  }
  for (let i = 0; i < 10; i++) {
    if (current?._def?.schema) current = current._def.schema;
    else if (current?._def?.innerType) current = current._def.innerType;
    else break;
  }
  return current?.shape ? Object.keys(current.shape) : [];
}

/** Turns zod issues into messages a content author can act on (#177).
 *
 * Unknown keys are the point: before schemas were strict they were silently dropped, so an author
 * could write `initiativeBonis: 5`, get a 200, and never learn the field went nowhere. Now the key
 * is named, located, and matched against the nearest real field. Every other issue keeps zod's own
 * message. */
export function describeSchemaIssues(schema: z.ZodTypeAny, issues: z.ZodIssue[]): string[] {
  return issues.map((issue) => {
    const where = issue.path.length > 0 ? ` at "${issue.path.join(".")}"` : "";
    if (issue.code === "unrecognized_keys") {
      const known = knownFieldsAt(schema, issue.path);
      const parts = issue.keys.map((key) => {
        const suggestion = nearestField(key, known);
        return suggestion ? `"${key}" (did you mean "${suggestion}"?)` : `"${key}"`;
      });
      return `Unknown field${issue.keys.length > 1 ? "s" : ""}${where}: ${parts.join(", ")}. This field is not part of this content type -- it would have been silently discarded, so it is rejected instead.`;
    }
    return `${issue.message}${where}`;
  });
}
