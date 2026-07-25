import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import Database from "better-sqlite3";
import { resetDbForTests } from "../db/client.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.join(__dirname, "../db/migrations");

/** Creates a temp SQLite DB, runs migrations, and points the app singleton at it. */
export function setupTestDatabase(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "rpg-companion-test-"));
  const dbPath = path.join(dir, "test.db");

  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const migratorDb = drizzle(sqlite);
  migrate(migratorDb, { migrationsFolder });
  sqlite.close();

  resetDbForTests(dbPath);
  return dbPath;
}
