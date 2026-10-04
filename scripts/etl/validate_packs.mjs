// Validates every generated import pack against the app's own zod schemas —
// the exact same lookup the /api/custom-content/import route uses.
// Usage: node scripts/etl/validate_packs.mjs [packsdir]
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { customContentDataSchemaFor } from "../../shared/dist/systems/custom-content.js";

const dir = path.resolve(process.argv[2] ?? new URL("../../import-packs/", import.meta.url).pathname);
let total = 0, failed = 0;
const byReason = new Map();
for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const pack = JSON.parse(readFileSync(path.join(dir, f), "utf8"));
  for (const row of pack.items) {
    total++;
    const schema = customContentDataSchemaFor(row.type);
    const r = schema.safeParse(row.data);
    if (!r.success) {
      failed++;
      for (const issue of r.error.issues) {
        const key = `${row.type}: ${issue.path.join(".")} — ${issue.code}`;
        if (!byReason.has(key)) byReason.set(key, []);
        if (byReason.get(key).length < 3) byReason.get(key).push(row.name);
      }
    }
  }
}
console.log(`validated ${total} rows, ${failed} failed`);
for (const [k, names] of [...byReason.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 40)) {
  console.log(`  ${k}  e.g. ${names.join(", ")}`);
}
process.exit(failed ? 1 : 0);
