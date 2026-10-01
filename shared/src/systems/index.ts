import type { z } from "zod";
import { genericSystem } from "./generic.js";
import { dnd5eSystem } from "./dnd5e.js";
import { pf2eSystem } from "./pf2e.js";
import type { GenericSheetData, genericSheetSchema } from "./generic.js";
import type { Dnd5eSheetData, dnd5eSheetSchema } from "./dnd5e.js";
import type { Pf2eSheetData, pf2eSheetSchema } from "./pf2e.js";
export * from "./srd-spells.js";
export * from "./srd-spell-effects.js";
export * from "./srd-spell-healing.js";
export * from "./srd-spell-scaling.js";
export * from "./class-progression.js";
export * from "./srd-class-proficiencies.js";
export * from "./srd-races.js";
export * from "./srd-magic-items.js";
export * from "./srd-equipment.js";
export * from "./srd-class-equipment.js";
export * from "./srd-backgrounds.js";
export * from "./srd-subraces.js";
export * from "./srd-subclasses.js";
export * from "./srd-feats.js";
export * from "./srd-monsters.js";
export * from "./srd-beasts.js";
export * from "./srd-familiars.js";
export * from "./srd-invocations.js";
export * from "./custom-content.js";
export * from "./crit.js";

// The plugin contract. Without an explicit type here, each system's Zod schema widens to its
// own concrete ZodType and `SYSTEMS[id].schema` collapses to `any` at every consumer (the
// backend routes index SYSTEMS by a runtime string), which silently disabled type-checking on
// sheet data across the whole stack. The union of the three schemas keeps `.safeParse()` typed
// per system via the discriminated `id` field.
export interface SystemDefinition<TSheet> {
  readonly id: string;
  readonly name: string;
  readonly schema: z.ZodType<TSheet>;
  readonly emptySheet: () => TSheet;
}

export const SYSTEMS = {
  generic: genericSystem as SystemDefinition<GenericSheetData> & { id: "generic" },
  dnd5e: dnd5eSystem as SystemDefinition<Dnd5eSheetData> & { id: "dnd5e" },
  pf2e: pf2eSystem as SystemDefinition<Pf2eSheetData> & { id: "pf2e" },
} as const;

export type SystemId = keyof typeof SYSTEMS;
export const SYSTEM_IDS = Object.keys(SYSTEMS) as SystemId[];

export * from "./generic.js";
export * from "./dnd5e.js";
export * from "./pf2e.js";
