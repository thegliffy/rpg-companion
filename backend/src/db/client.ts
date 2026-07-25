import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

type AppDb = BetterSQLite3Database<typeof schema>;

const dbPath = process.env.DATABASE_PATH ?? "../data/app.db";

function open(path: string): { db: AppDb; rawDb: Database.Database } {
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return { db: drizzle(sqlite, { schema }), rawDb: sqlite };
}

let current = open(dbPath);

/** Live binding — reassigned by `resetDbForTests` so service imports stay valid. */
export let db = current.db;
export let rawDb = current.rawDb;

/** Test helper: close the current SQLite handle and open a fresh database at `path`. */
export function resetDbForTests(path: string) {
  current.rawDb.close();
  current = open(path);
  db = current.db;
  rawDb = current.rawDb;
}
