import { randomBytes, createHash } from "node:crypto";
import { eq, and } from "drizzle-orm";
import { db } from "../db/client.js";
import { apiTokens } from "../db/schema.js";
import type { ApiTokenSummary, CreatedApiToken } from "shared";

// Identifies a leaked token in logs/repos at a glance, and lets secret scanners pattern-match it.
const TOKEN_PREFIX = "rpgc_";
const TOKEN_BYTES = 32;
// Enough of the plaintext to tell two tokens apart in the list, far too little to authenticate with.
const DISPLAY_PREFIX_LENGTH = TOKEN_PREFIX.length + 8;

/** SHA-256, not bcrypt (#146). A token is 256 bits of CSPRNG output, so there is no low-entropy
 * secret to brute-force and nothing for a slow KDF to buy -- it would only add ~100ms to every
 * authenticated request. More decisively, bcrypt salts per row, which would make verification a
 * full scan of every token in the table; a deterministic hash lets `token_hash`'s unique index
 * turn lookup into one indexed read. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toSummary(row: typeof apiTokens.$inferSelect): ApiTokenSummary {
  return {
    id: row.id,
    name: row.name,
    prefix: row.prefix,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

export async function createApiToken(
  userId: number,
  name: string,
  expiresInDays?: number,
): Promise<CreatedApiToken> {
  const token = `${TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString("base64url")}`;
  const expiresAt =
    expiresInDays === undefined ? null : new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const [created] = await db
    .insert(apiTokens)
    .values({
      userId,
      name,
      tokenHash: hashToken(token),
      prefix: token.slice(0, DISPLAY_PREFIX_LENGTH),
      expiresAt,
    })
    .returning();

  // The only time the plaintext leaves this function -- nothing stores it, so it is genuinely
  // unrecoverable once the response is gone.
  return { token, tokenInfo: toSummary(created) };
}

export function listApiTokens(userId: number): ApiTokenSummary[] {
  return db
    .select()
    .from(apiTokens)
    .where(eq(apiTokens.userId, userId))
    .all()
    .map(toSummary);
}

/** Deletes outright rather than soft-deleting: a revoked-but-still-present token is only a thing to
 * get wrong later, and this is a self-hosted server with no audit requirement. Scoped to the
 * caller's own tokens -- returns false if the id isn't theirs, so it can't be used to probe or
 * revoke someone else's. */
export async function deleteApiToken(userId: number, tokenId: number): Promise<boolean> {
  const deleted = await db
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, tokenId), eq(apiTokens.userId, userId)))
    .returning({ id: apiTokens.id });
  return deleted.length > 0;
}

/** Resolves a plaintext bearer token to its owner's user id, or null if it's unknown or expired.
 * An expired token is deleted on sight rather than left to linger. */
export function resolveApiToken(token: string): number | null {
  if (!token.startsWith(TOKEN_PREFIX)) return null;

  const row = db.select().from(apiTokens).where(eq(apiTokens.tokenHash, hashToken(token))).get();
  if (!row) return null;

  if (row.expiresAt !== null && new Date(row.expiresAt).getTime() <= Date.now()) {
    db.delete(apiTokens).where(eq(apiTokens.id, row.id)).run();
    return null;
  }

  // Best-effort: a failure to record usage must never fail the request it was authenticating.
  try {
    db.update(apiTokens).set({ lastUsedAt: new Date().toISOString() }).where(eq(apiTokens.id, row.id)).run();
  } catch {
    // ignore
  }

  return row.userId;
}

/** Every token belonging to a user -- used by the #135 delete-user dependant count so an account
 * with live tokens isn't silently removable out from under a running script. */
export function countApiTokensForUser(userId: number): number {
  return db.select().from(apiTokens).where(eq(apiTokens.userId, userId)).all().length;
}
