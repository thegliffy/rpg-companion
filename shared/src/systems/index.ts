import { genericSystem } from "./generic.js";
import { dnd5eSystem } from "./dnd5e.js";
import { pf2eSystem } from "./pf2e.js";
export * from "./srd-spells.js";
export * from "./class-progression.js";
export * from "./srd-class-proficiencies.js";
export * from "./srd-races.js";
export * from "./srd-magic-items.js";
export * from "./srd-equipment.js";
export * from "./srd-backgrounds.js";
export * from "./srd-subraces.js";
export * from "./srd-subclasses.js";
export * from "./srd-feats.js";
export * from "./srd-monsters.js";
export * from "./srd-beasts.js";
export * from "./srd-familiars.js";
export * from "./srd-invocations.js";
export * from "./custom-content.js";

export const SYSTEMS = {
  generic: genericSystem,
  dnd5e: dnd5eSystem,
  pf2e: pf2eSystem,
} as const;

export type SystemId = keyof typeof SYSTEMS;
export const SYSTEM_IDS = Object.keys(SYSTEMS) as SystemId[];

export * from "./generic.js";
export * from "./dnd5e.js";
export * from "./pf2e.js";
