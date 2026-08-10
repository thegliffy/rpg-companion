import type { AdminContentSummary, CustomContent, DuplicateContentPair } from "shared";
import { listAllCustomContentWithData } from "./customContent.service.js";

const NAME_SIMILARITY_THRESHOLD = 0.82;
// A fingerprint shorter than this is a near-empty draft (blank name aside) -- two blank drafts
// matching each other isn't a meaningful "these are the same content" signal.
const MIN_FINGERPRINT_LENGTH = 20;

/** Levenshtein distance. Separate small copy from the one in lib/schemaErrors.ts (schema-error
 * field-name suggestions) -- same algorithm, different problem, not worth sharing. */
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

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/** 1 (identical) down to 0 (nothing in common), normalized by the longer of the two lengths so
 * short and long names are scored on a comparable scale. */
function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - editDistance(na, nb) / maxLen;
}

/** Canonical, order-independent, flavor-stripped JSON string for a content item's `data` --
 * "mechanically identical" means two items' fingerprints are byte-equal. Generic across every
 * content type (race/spell/item/monster/etc. all have different shapes) rather than nine bespoke
 * per-type extractors: recursively drops `id` and `description` (the two fields that are
 * consistently flavor, not mechanics, across every schema in custom-content.ts), and deep-sorts
 * arrays by their own JSON so element order (e.g. a reordered trait list) doesn't matter. */
function fingerprint(data: unknown): string {
  return JSON.stringify(canonicalize(data));
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize).sort((a, b) => {
      const sa = JSON.stringify(a);
      const sb = JSON.stringify(b);
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== "id" && key !== "description")
      .map(([key, v]) => [key, canonicalize(v)] as const)
      .sort(([ka], [kb]) => (ka < kb ? -1 : ka > kb ? 1 : 0));
    return Object.fromEntries(entries);
  }
  return value;
}

function toSummary(item: CustomContent): AdminContentSummary {
  return {
    id: item.id,
    type: item.type,
    system: item.system,
    createdByUserId: item.createdByUserId,
    createdByUsername: item.createdByUsername,
    name: item.name,
    status: item.status,
    approvedByUserId: item.approvedByUserId,
    approvedAt: item.approvedAt,
    createdAt: item.createdAt,
  };
}

/** Every candidate near-duplicate pair across all custom content, grouped by type+system (a
 * spell and an item sharing a name aren't a collision). Compares regardless of status or owner --
 * pending-vs-pending, pending-vs-approved, and already-approved-vs-approved all surface, not just
 * new submissions -- so an admin reviewing the queue can catch overlap in either direction.
 * Sorted mechanically-identical-first, then by name similarity descending.
 *
 * Split from the DB fetch (computeDuplicatePairs does the actual comparison, findDuplicateContent
 * just supplies the rows) so the comparison logic can be unit-tested against fabricated content
 * without a database. */
export function computeDuplicatePairs(items: CustomContent[]): DuplicateContentPair[] {
  const buckets = new Map<string, CustomContent[]>();
  for (const item of items) {
    const key = `${item.type}:${item.system}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  const fingerprints = new Map<number, string>();
  for (const item of items) fingerprints.set(item.id, fingerprint(item.data));

  const pairs: DuplicateContentPair[] = [];
  for (const bucket of buckets.values()) {
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i];
        const b = bucket[j];
        const similarity = nameSimilarity(a.name, b.name);
        const identicalName = similarity === 1;
        const similarName = !identicalName && similarity >= NAME_SIMILARITY_THRESHOLD;
        const fpA = fingerprints.get(a.id)!;
        const fpB = fingerprints.get(b.id)!;
        const mechanicallyIdentical = fpA === fpB && fpA.length >= MIN_FINGERPRINT_LENGTH;

        if (!identicalName && !similarName && !mechanicallyIdentical) continue;

        const reasons: string[] = [];
        if (identicalName) reasons.push("Identical name");
        else if (similarName) reasons.push(`Similar name (${Math.round(similarity * 100)}% match)`);
        if (mechanicallyIdentical) reasons.push("Identical mechanical data");

        pairs.push({
          a: toSummary(a),
          b: toSummary(b),
          reason: reasons.join(", "),
          nameSimilarity: similarity,
          mechanicallyIdentical,
        });
      }
    }
  }

  return pairs.sort((x, y) => {
    if (x.mechanicallyIdentical !== y.mechanicallyIdentical) return x.mechanicallyIdentical ? -1 : 1;
    return y.nameSimilarity - x.nameSimilarity;
  });
}

export function findDuplicateContent(): DuplicateContentPair[] {
  return computeDuplicatePairs(listAllCustomContentWithData());
}
