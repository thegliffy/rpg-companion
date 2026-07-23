import { SRD_MONSTERS, type SrdMonster } from "./srd-monsters.js";

// The find familiar spell (SRD) lets you summon a spirit that takes one of these fixed forms.
// Ids reference SRD_MONSTERS -- all present as CR-0 beasts (plus quipper/sea-horse for aquatic).
export const FIND_FAMILIAR_FORM_IDS = [
  "bat",
  "cat",
  "crab",
  "frog",
  "hawk",
  "lizard",
  "octopus",
  "owl",
  "poisonous-snake",
  "quipper",
  "rat",
  "raven",
  "sea-horse",
  "spider",
  "weasel",
] as const;

// Pact of the Chain (Warlock) expands the find familiar form list with these four special forms,
// which are not beasts (imp/quasit are fiends, pseudodragon a dragon, sprite a fey).
export const PACT_CHAIN_FAMILIAR_FORM_IDS = ["imp", "pseudodragon", "quasit", "sprite"] as const;

/** The SRD monsters selectable as a familiar. Standard find familiar forms always; the four Pact
 * of the Chain special forms are appended when `includeChain` is true. Order follows the id lists,
 * standard forms first. */
export function familiarFormMonsters(includeChain: boolean): SrdMonster[] {
  const ids: string[] = [...FIND_FAMILIAR_FORM_IDS, ...(includeChain ? PACT_CHAIN_FAMILIAR_FORM_IDS : [])];
  return ids
    .map((id) => SRD_MONSTERS.find((m) => m.id === id))
    .filter((m): m is SrdMonster => m !== undefined);
}
