import session from "express-session";
import type { Store } from "express-session";
import { rawDb } from "../db/client.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_MAX_AGE_MS = 7 * DAY_MS;

const PRUNE_INTERVAL_MS = 60 * 60 * 1000;
let lastPruneAt = 0;

function pruneExpiredSessions() {
  const now = Date.now();
  if (now - lastPruneAt < PRUNE_INTERVAL_MS) return;
  lastPruneAt = now;
  try {
    rawDb.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
  } catch {
    // Best-effort cleanup; ignore prune failures.
  }
}

class SqliteSessionStore extends session.Store {
  get(sid: string, callback: (err: unknown, session?: session.SessionData | null) => void) {
    try {
      pruneExpiredSessions();
      const row = rawDb
        .prepare("SELECT sess, expires_at FROM sessions WHERE sid = ?")
        .get(sid) as { sess: string; expires_at: number } | undefined;

      if (!row || row.expires_at < Date.now()) {
        if (row) {
          rawDb.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
        }
        callback(null, null);
        return;
      }
      callback(null, JSON.parse(row.sess));
    } catch (err) {
      callback(err);
    }
  }

  set(sid: string, sessionData: session.SessionData, callback?: (err?: unknown) => void) {
    try {
      const maxAge = sessionData.cookie?.maxAge ?? DEFAULT_MAX_AGE_MS;
      const expiresAt = Date.now() + maxAge;
      rawDb
        .prepare(
          `INSERT INTO sessions (sid, sess, expires_at) VALUES (?, ?, ?)
           ON CONFLICT(sid) DO UPDATE SET sess = excluded.sess, expires_at = excluded.expires_at`,
        )
        .run(sid, JSON.stringify(sessionData), expiresAt);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  destroy(sid: string, callback?: (err?: unknown) => void) {
    try {
      rawDb.prepare("DELETE FROM sessions WHERE sid = ?").run(sid);
      callback?.();
    } catch (err) {
      callback?.(err);
    }
  }

  touch(sid: string, sessionData: session.SessionData, callback?: (err?: unknown) => void) {
    this.set(sid, sessionData, callback);
  }
}

export function createSessionMiddleware() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is required");
  }

  return session({
    store: new SqliteSessionStore() as unknown as Store,
    secret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: DEFAULT_MAX_AGE_MS,
    },
  });
}

declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}
