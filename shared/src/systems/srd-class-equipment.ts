// SRD 5.1 class starting equipment (CC-BY-4.0): what an SRD class grants at level 1, IN ADDITION
// to whatever the character's background grants (see backgroundGrants() in the wizard). Mirrors
// srd-class-proficiencies.ts's shape and lookup convention.
//
// PHB choices like "a martial weapon and a shield or two martial weapons" name a whole weapon
// *category*, not one item -- those are expanded here into one option per matching SRD_WEAPONS
// entry (via weaponChoiceOptions/bundleChoiceOptions) rather than hand-typed, so the option list
// can never drift from SRD_WEAPONS. Two-of-a-category choices ("two martial weapons") are modeled
// as two of the *same* weapon: RAW never forbids picking the same weapon twice, and the
// alternative -- every unordered pair of a 17-weapon category -- would blow the option count up
// combinatorially for no real player benefit.
import { SRD_WEAPONS, SRD_GEAR, type SrdWeapon } from "./srd-equipment.js";
import { normalizeClassId } from "./class-progression.js";

export interface EquipmentEntry {
  itemId: string;
  quantity: number;
}

export interface EquipmentOption {
  label: string;
  items: EquipmentEntry[];
}

export interface EquipmentChoice {
  options: EquipmentOption[];
}

export interface ClassStartingEquipment {
  choices: EquipmentChoice[];
  fixed: EquipmentEntry[];
}

const SIMPLE_WEAPONS = SRD_WEAPONS.filter((w) => w.category === "Simple");
const SIMPLE_MELEE_WEAPONS = SRD_WEAPONS.filter((w) => w.category === "Simple" && w.range === "Melee");
const MARTIAL_WEAPONS = SRD_WEAPONS.filter((w) => w.category === "Martial");
const MARTIAL_MELEE_WEAPONS = SRD_WEAPONS.filter((w) => w.category === "Martial" && w.range === "Melee");

const ARCANE_FOCUS_IDS = ["crystal", "orb", "rod", "staff", "wand"];
const MUSICAL_INSTRUMENT_IDS = ["bagpipes", "drum", "dulcimer", "flute", "horn", "lute", "lyre", "pan-flute", "shawm", "viol"];

function weaponChoiceOptions(weapons: SrdWeapon[], quantity = 1): EquipmentOption[] {
  return weapons.map((w) => ({
    label: quantity > 1 ? `${quantity}× ${w.name}` : w.name,
    items: [{ itemId: w.id, quantity }],
  }));
}

/** One option per weapon, each bundled with the same extra item(s) -- e.g. "a martial weapon
 * and a shield" expands to "Battleaxe and a Shield" / "Flail and a Shield" / etc. */
function weaponBundleOptions(weapons: SrdWeapon[], suffix: string, extra: EquipmentEntry[]): EquipmentOption[] {
  return weapons.map((w) => ({
    label: `${w.name} ${suffix}`,
    items: [{ itemId: w.id, quantity: 1 }, ...extra],
  }));
}

function gearOptions(ids: string[], quantity = 1): EquipmentOption[] {
  return ids.map((id) => {
    const gear = SRD_GEAR.find((g) => g.id === id);
    if (!gear) throw new Error(`srd-class-equipment: unknown gear id "${id}"`);
    return { label: quantity > 1 ? `${quantity}× ${gear.name}` : gear.name, items: [{ itemId: id, quantity }] };
  });
}

const MARTIAL_WEAPON_AND_SHIELD_OR_TWO: EquipmentChoice = {
  options: [...weaponBundleOptions(MARTIAL_WEAPONS, "and a Shield", [{ itemId: "shield", quantity: 1 }]), ...weaponChoiceOptions(MARTIAL_WEAPONS, 2)],
};

const ARCANE_FOCUS_CHOICE: EquipmentChoice = {
  options: [{ label: "Component Pouch", items: [{ itemId: "component-pouch", quantity: 1 }] }, ...gearOptions(ARCANE_FOCUS_IDS)],
};

export const SRD_STARTING_EQUIPMENT: Record<string, ClassStartingEquipment> = {
  barbarian: {
    fixed: [{ itemId: "explorers-pack", quantity: 1 }, { itemId: "javelin", quantity: 4 }],
    choices: [
      { options: weaponChoiceOptions(MARTIAL_MELEE_WEAPONS) },
      { options: [{ label: "Two Handaxes", items: [{ itemId: "handaxe", quantity: 2 }] }, ...weaponChoiceOptions(SIMPLE_WEAPONS)] },
    ],
  },
  bard: {
    fixed: [{ itemId: "leather-armor", quantity: 1 }, { itemId: "dagger", quantity: 1 }],
    choices: [
      {
        options: [
          { label: "Rapier", items: [{ itemId: "rapier", quantity: 1 }] },
          { label: "Longsword", items: [{ itemId: "longsword", quantity: 1 }] },
          ...weaponChoiceOptions(SIMPLE_WEAPONS),
        ],
      },
      {
        options: [
          { label: "Diplomat's Pack", items: [{ itemId: "diplomats-pack", quantity: 1 }] },
          { label: "Entertainer's Pack", items: [{ itemId: "entertainers-pack", quantity: 1 }] },
        ],
      },
      { options: gearOptions(MUSICAL_INSTRUMENT_IDS) },
    ],
  },
  cleric: {
    fixed: [{ itemId: "shield", quantity: 1 }, { itemId: "amulet", quantity: 1 }],
    choices: [
      {
        options: [
          { label: "Mace", items: [{ itemId: "mace", quantity: 1 }] },
          { label: "Warhammer", items: [{ itemId: "warhammer", quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: "Scale Mail", items: [{ itemId: "scale-mail", quantity: 1 }] },
          { label: "Leather Armor", items: [{ itemId: "leather-armor", quantity: 1 }] },
          { label: "Chain Mail", items: [{ itemId: "chain-mail", quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: "Light Crossbow and 20 Bolts", items: [{ itemId: "crossbow-light", quantity: 1 }, { itemId: "crossbow-bolt", quantity: 20 }] },
          ...weaponChoiceOptions(SIMPLE_WEAPONS),
        ],
      },
      {
        options: [
          { label: "Priest's Pack", items: [{ itemId: "priests-pack", quantity: 1 }] },
          { label: "Explorer's Pack", items: [{ itemId: "explorers-pack", quantity: 1 }] },
        ],
      },
    ],
  },
  druid: {
    fixed: [{ itemId: "leather-armor", quantity: 1 }, { itemId: "explorers-pack", quantity: 1 }, { itemId: "sprig-of-mistletoe", quantity: 1 }],
    choices: [
      { options: [{ label: "Wooden Shield", items: [{ itemId: "shield", quantity: 1 }] }, ...weaponChoiceOptions(SIMPLE_WEAPONS)] },
      { options: [{ label: "Scimitar", items: [{ itemId: "scimitar", quantity: 1 }] }, ...weaponChoiceOptions(SIMPLE_MELEE_WEAPONS)] },
    ],
  },
  fighter: {
    fixed: [],
    choices: [
      {
        options: [
          { label: "Chain Mail", items: [{ itemId: "chain-mail", quantity: 1 }] },
          {
            label: "Leather Armor, Longbow, and 20 Arrows",
            items: [{ itemId: "leather-armor", quantity: 1 }, { itemId: "longbow", quantity: 1 }, { itemId: "arrow", quantity: 20 }],
          },
        ],
      },
      MARTIAL_WEAPON_AND_SHIELD_OR_TWO,
      {
        options: [
          { label: "Light Crossbow and 20 Bolts", items: [{ itemId: "crossbow-light", quantity: 1 }, { itemId: "crossbow-bolt", quantity: 20 }] },
          { label: "Two Handaxes", items: [{ itemId: "handaxe", quantity: 2 }] },
        ],
      },
      {
        options: [
          { label: "Dungeoneer's Pack", items: [{ itemId: "dungeoneers-pack", quantity: 1 }] },
          { label: "Explorer's Pack", items: [{ itemId: "explorers-pack", quantity: 1 }] },
        ],
      },
    ],
  },
  monk: {
    fixed: [{ itemId: "dart", quantity: 10 }],
    choices: [
      { options: [{ label: "Shortsword", items: [{ itemId: "shortsword", quantity: 1 }] }, ...weaponChoiceOptions(SIMPLE_WEAPONS)] },
      {
        options: [
          { label: "Dungeoneer's Pack", items: [{ itemId: "dungeoneers-pack", quantity: 1 }] },
          { label: "Explorer's Pack", items: [{ itemId: "explorers-pack", quantity: 1 }] },
        ],
      },
    ],
  },
  paladin: {
    fixed: [{ itemId: "chain-mail", quantity: 1 }, { itemId: "amulet", quantity: 1 }],
    choices: [
      MARTIAL_WEAPON_AND_SHIELD_OR_TWO,
      { options: [{ label: "Five Javelins", items: [{ itemId: "javelin", quantity: 5 }] }, ...weaponChoiceOptions(SIMPLE_MELEE_WEAPONS)] },
      {
        options: [
          { label: "Priest's Pack", items: [{ itemId: "priests-pack", quantity: 1 }] },
          { label: "Explorer's Pack", items: [{ itemId: "explorers-pack", quantity: 1 }] },
        ],
      },
    ],
  },
  ranger: {
    fixed: [{ itemId: "longbow", quantity: 1 }, { itemId: "arrow", quantity: 20 }, { itemId: "quiver", quantity: 1 }],
    choices: [
      {
        options: [
          { label: "Scale Mail", items: [{ itemId: "scale-mail", quantity: 1 }] },
          { label: "Leather Armor", items: [{ itemId: "leather-armor", quantity: 1 }] },
        ],
      },
      { options: [{ label: "Two Shortswords", items: [{ itemId: "shortsword", quantity: 2 }] }, ...weaponChoiceOptions(SIMPLE_MELEE_WEAPONS, 2)] },
      {
        options: [
          { label: "Dungeoneer's Pack", items: [{ itemId: "dungeoneers-pack", quantity: 1 }] },
          { label: "Explorer's Pack", items: [{ itemId: "explorers-pack", quantity: 1 }] },
        ],
      },
    ],
  },
  rogue: {
    fixed: [{ itemId: "leather-armor", quantity: 1 }, { itemId: "dagger", quantity: 2 }, { itemId: "thieves-tools", quantity: 1 }],
    choices: [
      {
        options: [
          { label: "Rapier", items: [{ itemId: "rapier", quantity: 1 }] },
          { label: "Shortsword", items: [{ itemId: "shortsword", quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: "Shortbow and Quiver of 20 Arrows", items: [{ itemId: "shortbow", quantity: 1 }, { itemId: "quiver", quantity: 1 }, { itemId: "arrow", quantity: 20 }] },
          { label: "Shortsword", items: [{ itemId: "shortsword", quantity: 1 }] },
        ],
      },
      {
        options: [
          { label: "Burglar's Pack", items: [{ itemId: "burglars-pack", quantity: 1 }] },
          { label: "Dungeoneer's Pack", items: [{ itemId: "dungeoneers-pack", quantity: 1 }] },
          { label: "Explorer's Pack", items: [{ itemId: "explorers-pack", quantity: 1 }] },
        ],
      },
    ],
  },
  sorcerer: {
    fixed: [{ itemId: "dagger", quantity: 2 }],
    choices: [
      {
        options: [
          { label: "Light Crossbow and 20 Bolts", items: [{ itemId: "crossbow-light", quantity: 1 }, { itemId: "crossbow-bolt", quantity: 20 }] },
          ...weaponChoiceOptions(SIMPLE_WEAPONS),
        ],
      },
      ARCANE_FOCUS_CHOICE,
      {
        options: [
          { label: "Scholar's Pack", items: [{ itemId: "scholars-pack", quantity: 1 }] },
          { label: "Dungeoneer's Pack", items: [{ itemId: "dungeoneers-pack", quantity: 1 }] },
        ],
      },
    ],
  },
  warlock: {
    fixed: [{ itemId: "leather-armor", quantity: 1 }, { itemId: "dagger", quantity: 2 }],
    choices: [
      {
        options: [
          { label: "Light Crossbow and 20 Bolts", items: [{ itemId: "crossbow-light", quantity: 1 }, { itemId: "crossbow-bolt", quantity: 20 }] },
          ...weaponChoiceOptions(SIMPLE_WEAPONS),
        ],
      },
      ARCANE_FOCUS_CHOICE,
      {
        options: [
          { label: "Scholar's Pack", items: [{ itemId: "scholars-pack", quantity: 1 }] },
          { label: "Dungeoneer's Pack", items: [{ itemId: "dungeoneers-pack", quantity: 1 }] },
        ],
      },
      { options: weaponChoiceOptions(SIMPLE_WEAPONS) },
    ],
  },
  wizard: {
    fixed: [{ itemId: "spellbook", quantity: 1 }],
    choices: [
      {
        options: [
          { label: "Quarterstaff", items: [{ itemId: "quarterstaff", quantity: 1 }] },
          { label: "Dagger", items: [{ itemId: "dagger", quantity: 1 }] },
        ],
      },
      ARCANE_FOCUS_CHOICE,
      {
        options: [
          { label: "Scholar's Pack", items: [{ itemId: "scholars-pack", quantity: 1 }] },
          { label: "Explorer's Pack", items: [{ itemId: "explorers-pack", quantity: 1 }] },
        ],
      },
    ],
  },
};

/** SRD starting equipment grant for a class, or null for custom/homebrew (no data -- see
 * customClassDataSchema.startingEquipment for the homebrew equivalent). */
export function classStartingEquipment(className: string): ClassStartingEquipment | null {
  return SRD_STARTING_EQUIPMENT[normalizeClassId(className)] ?? null;
}
