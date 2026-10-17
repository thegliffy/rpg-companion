// Generates bulk-import JSON packs from the built-in SRD data modules, in the
// { system, items: [{ type, name, data }] } shape the /api/custom-content/import
// endpoint expects. Every row is validated through the same per-type zod schema the
// import route uses before it is written. Packs are chunked to the route's 200-row cap.
//
// Usage: node scripts/generate-import-packs.mjs [outdir]
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  customContentDataSchemaFor,
} from "../shared/dist/systems/custom-content.js";
import { SRD_SPELLS } from "../shared/dist/systems/srd-spells.js";
import { SRD_MONSTERS } from "../shared/dist/systems/srd-monsters.js";
import { SRD_MAGIC_ITEMS } from "../shared/dist/systems/srd-magic-items.js";
import { SRD_WEAPONS, SRD_ARMOR, SRD_GEAR } from "../shared/dist/systems/srd-equipment.js";
import { SRD_RACES } from "../shared/dist/systems/srd-races.js";
import { SRD_SUBRACES } from "../shared/dist/systems/srd-subraces.js";
import { SRD_BACKGROUNDS } from "../shared/dist/systems/srd-backgrounds.js";
import { SRD_FEATS } from "../shared/dist/systems/srd-feats.js";
import { SRD_SUBCLASSES } from "../shared/dist/systems/srd-subclasses.js";

const outdir = path.resolve(process.argv[2] ?? new URL("../import-packs/", import.meta.url).pathname);
mkdirSync(outdir, { recursive: true });

const CAP = 200;
let failures = 0;

function gp(str) {
  // "10 gp" -> 10; "5 sp" -> 0.5; unparseable -> 0.
  const m = /^(\d+(?:\.\d+)?)\s*(cp|sp|ep|gp|pp)$/i.exec(String(str ?? "").trim());
  if (!m) return 0;
  const v = Number(m[1]);
  const unit = m[2].toLowerCase();
  return unit === "gp" ? v : unit === "pp" ? v * 10 : unit === "ep" ? v * 0.5 : unit === "sp" ? v / 10 : v / 100;
}

function rows(type, entries, mapData) {
  return entries.map((e) => {
    const data = mapData(e);
    const parsed = customContentDataSchemaFor(type).safeParse(data);
    if (!parsed.success) {
      failures += 1;
      console.error(`FAIL ${type} "${e.name}":`, JSON.stringify(parsed.error.issues).slice(0, 300));
      return null;
    }
    return { type, name: e.name, data: parsed.data };
  });
}

function writePack(label, items) {
  for (let i = 0; i < items.length; i += CAP) {
    const chunk = items.slice(i, i + CAP);
    const file = path.join(outdir, `${label}${i ? `-${Math.floor(i / CAP) + 1}` : ""}.json`);
    writeFileSync(file, JSON.stringify({ system: "dnd5e", items: chunk }, null, 2));
    console.log(`wrote ${path.basename(file)} (${chunk.length} rows)`);
  }
}

// --- spells -----------------------------------------------------------------
writePack("spells", rows("spell", SRD_SPELLS, (s) => {
  const { id, name, ...data } = s;
  return data;
}));

// --- monsters (senses object -> flat schema fields) --------------------------
writePack("monsters", rows("monster", SRD_MONSTERS, (m) => {
  const { id, name, senses, ...data } = m;
  return { ...data, ...senses };
}));

// --- items: magic items, weapons, armor, gear -------------------------------
writePack("items-magic", rows("item", SRD_MAGIC_ITEMS, (it) => {
  const { id, name, ...data } = it;
  return { kind: "magic", ...data };
}));
writePack("items-weapons", rows("item", SRD_WEAPONS, (w) => {
  const { id, name, category, range, cost, ...data } = w;
  return { kind: "weapon", value: gp(cost), ...data };
}));
writePack("items-armor", rows("item", SRD_ARMOR, (a) => {
  const { id, name, category, cost, ...data } = a;
  return { kind: "armor", armorCategory: String(category).toLowerCase(), value: gp(cost), ...data };
}));
writePack("items-gear", rows("item", SRD_GEAR, (g) => {
  const { id, name, cost, ...data } = g;
  return { kind: "gear", value: gp(cost), ...data };
}));

// --- races / subraces / backgrounds / feats / subclasses ---------------------
writePack("races", rows("race", SRD_RACES, (r) => {
  const { id, name, ...data } = r;
  return data;
}));
writePack("subraces", rows("subrace", SRD_SUBRACES, (r) => {
  const { id, name, ...data } = r;
  return data;
}));
writePack("backgrounds", rows("background", SRD_BACKGROUNDS, (b) => {
  const { id, name, ...data } = b;
  return data;
}));
writePack("feats", rows("feat", SRD_FEATS, (f) => {
  const { id, name, ...data } = f;
  return data;
}));
writePack("subclasses", rows("subclass", SRD_SUBCLASSES, (s) => {
  const { id, name, ...data } = s;
  return data;
}));

console.log(failures === 0 ? "\nAll rows validated." : `\n${failures} rows FAILED validation.`);
process.exit(failures === 0 ? 0 : 1);
