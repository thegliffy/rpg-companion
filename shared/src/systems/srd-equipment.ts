// SRD 5.1 mundane equipment (weapons, armor, adventuring gear), CC-BY-4.0,
// sourced from the open 5e-bits/5e-database project. Mechanical facts only --
// no descriptive text. Complements srd-magic-items.ts (which has no structured
// numeric effects) for the inventory item autocomplete.

export interface SrdWeapon {
  id: string;
  name: string;
  category: "Simple" | "Martial";
  range: "Melee" | "Ranged";
  cost: string;
  weight: number;
  damageDice: string;
  damageType: string;
  properties: string[];
}

export interface SrdArmor {
  id: string;
  name: string;
  category: "Light" | "Medium" | "Heavy" | "Shield";
  cost: string;
  weight: number;
  baseAC: number;
  dexBonus: boolean;
  maxDexBonus?: number;
  stealthDisadvantage: boolean;
}

export interface SrdGear {
  id: string;
  name: string;
  cost: string;
  weight: number;
}

export const SRD_WEAPONS: SrdWeapon[] = [
  { id: "battleaxe", name: "Battleaxe", category: "Martial", range: "Melee", cost: "10 gp", weight: 4, damageDice: "1d8", damageType: "Slashing", properties: ["Versatile"] },
  { id: "blowgun", name: "Blowgun", category: "Martial", range: "Ranged", cost: "10 gp", weight: 1, damageDice: "1", damageType: "Piercing", properties: ["Ammunition", "Loading"] },
  { id: "club", name: "Club", category: "Simple", range: "Melee", cost: "1 sp", weight: 2, damageDice: "1d4", damageType: "Bludgeoning", properties: ["Light", "Monk"] },
  { id: "crossbow-hand", name: "Crossbow, hand", category: "Martial", range: "Ranged", cost: "75 gp", weight: 3, damageDice: "1d6", damageType: "Piercing", properties: ["Ammunition", "Light", "Loading"] },
  { id: "crossbow-heavy", name: "Crossbow, heavy", category: "Martial", range: "Ranged", cost: "50 gp", weight: 18, damageDice: "1d10", damageType: "Piercing", properties: ["Ammunition", "Heavy", "Loading", "Two-Handed"] },
  { id: "crossbow-light", name: "Crossbow, light", category: "Simple", range: "Ranged", cost: "25 gp", weight: 5, damageDice: "1d8", damageType: "Piercing", properties: ["Ammunition", "Loading", "Two-Handed"] },
  { id: "dagger", name: "Dagger", category: "Simple", range: "Melee", cost: "2 gp", weight: 1, damageDice: "1d4", damageType: "Piercing", properties: ["Finesse", "Light", "Thrown", "Monk"] },
  { id: "dart", name: "Dart", category: "Simple", range: "Ranged", cost: "5 cp", weight: 0.25, damageDice: "1d4", damageType: "Piercing", properties: ["Finesse", "Thrown"] },
  { id: "flail", name: "Flail", category: "Martial", range: "Melee", cost: "10 gp", weight: 2, damageDice: "1d8", damageType: "Bludgeoning", properties: [] },
  { id: "glaive", name: "Glaive", category: "Martial", range: "Melee", cost: "20 gp", weight: 6, damageDice: "1d10", damageType: "Slashing", properties: ["Heavy", "Reach", "Two-Handed"] },
  { id: "greataxe", name: "Greataxe", category: "Martial", range: "Melee", cost: "30 gp", weight: 7, damageDice: "1d12", damageType: "Slashing", properties: ["Heavy", "Two-Handed"] },
  { id: "greatclub", name: "Greatclub", category: "Simple", range: "Melee", cost: "2 sp", weight: 10, damageDice: "1d8", damageType: "Bludgeoning", properties: ["Two-Handed"] },
  { id: "greatsword", name: "Greatsword", category: "Martial", range: "Melee", cost: "50 gp", weight: 6, damageDice: "2d6", damageType: "Slashing", properties: ["Heavy", "Two-Handed"] },
  { id: "halberd", name: "Halberd", category: "Martial", range: "Melee", cost: "20 gp", weight: 6, damageDice: "1d10", damageType: "Slashing", properties: ["Heavy", "Reach", "Two-Handed"] },
  { id: "handaxe", name: "Handaxe", category: "Simple", range: "Melee", cost: "5 gp", weight: 2, damageDice: "1d6", damageType: "Slashing", properties: ["Light", "Thrown", "Monk"] },
  { id: "javelin", name: "Javelin", category: "Simple", range: "Melee", cost: "5 sp", weight: 2, damageDice: "1d6", damageType: "Piercing", properties: ["Thrown", "Monk"] },
  { id: "lance", name: "Lance", category: "Martial", range: "Melee", cost: "10 gp", weight: 6, damageDice: "1d12", damageType: "Piercing", properties: ["Reach", "Special"] },
  { id: "light-hammer", name: "Light hammer", category: "Simple", range: "Melee", cost: "2 gp", weight: 2, damageDice: "1d4", damageType: "Bludgeoning", properties: ["Light", "Thrown", "Monk"] },
  { id: "longbow", name: "Longbow", category: "Martial", range: "Ranged", cost: "50 gp", weight: 2, damageDice: "1d8", damageType: "Piercing", properties: ["Ammunition", "Heavy", "Two-Handed"] },
  { id: "longsword", name: "Longsword", category: "Martial", range: "Melee", cost: "15 gp", weight: 3, damageDice: "1d8", damageType: "Slashing", properties: ["Versatile"] },
  { id: "mace", name: "Mace", category: "Simple", range: "Melee", cost: "5 gp", weight: 4, damageDice: "1d6", damageType: "Bludgeoning", properties: ["Monk"] },
  { id: "maul", name: "Maul", category: "Martial", range: "Melee", cost: "10 gp", weight: 10, damageDice: "2d6", damageType: "Bludgeoning", properties: ["Heavy", "Two-Handed"] },
  { id: "morningstar", name: "Morningstar", category: "Martial", range: "Melee", cost: "15 gp", weight: 4, damageDice: "1d8", damageType: "Piercing", properties: [] },
  { id: "net", name: "Net", category: "Martial", range: "Ranged", cost: "1 gp", weight: 3, damageDice: "", damageType: "", properties: ["Thrown", "Special"] },
  { id: "pike", name: "Pike", category: "Martial", range: "Melee", cost: "5 gp", weight: 18, damageDice: "1d10", damageType: "Piercing", properties: ["Heavy", "Reach", "Two-Handed"] },
  { id: "quarterstaff", name: "Quarterstaff", category: "Simple", range: "Melee", cost: "2 sp", weight: 4, damageDice: "1d6", damageType: "Bludgeoning", properties: ["Versatile", "Monk"] },
  { id: "rapier", name: "Rapier", category: "Martial", range: "Melee", cost: "25 gp", weight: 2, damageDice: "1d8", damageType: "Piercing", properties: ["Finesse"] },
  { id: "scimitar", name: "Scimitar", category: "Martial", range: "Melee", cost: "25 gp", weight: 3, damageDice: "1d6", damageType: "Slashing", properties: ["Finesse", "Light"] },
  { id: "shortbow", name: "Shortbow", category: "Simple", range: "Ranged", cost: "25 gp", weight: 2, damageDice: "1d6", damageType: "Piercing", properties: ["Ammunition", "Two-Handed"] },
  { id: "shortsword", name: "Shortsword", category: "Martial", range: "Melee", cost: "10 gp", weight: 2, damageDice: "1d6", damageType: "Piercing", properties: ["Finesse", "Light", "Monk"] },
  { id: "sickle", name: "Sickle", category: "Simple", range: "Melee", cost: "1 gp", weight: 2, damageDice: "1d4", damageType: "Slashing", properties: ["Light", "Monk"] },
  { id: "sling", name: "Sling", category: "Simple", range: "Ranged", cost: "1 sp", weight: 0, damageDice: "1d4", damageType: "Bludgeoning", properties: ["Ammunition"] },
  { id: "spear", name: "Spear", category: "Simple", range: "Melee", cost: "1 gp", weight: 3, damageDice: "1d6", damageType: "Piercing", properties: ["Thrown", "Versatile", "Monk"] },
  { id: "trident", name: "Trident", category: "Martial", range: "Melee", cost: "5 gp", weight: 4, damageDice: "1d6", damageType: "Piercing", properties: ["Thrown", "Versatile"] },
  { id: "war-pick", name: "War pick", category: "Martial", range: "Melee", cost: "5 gp", weight: 2, damageDice: "1d8", damageType: "Piercing", properties: [] },
  { id: "warhammer", name: "Warhammer", category: "Martial", range: "Melee", cost: "15 gp", weight: 2, damageDice: "1d8", damageType: "Bludgeoning", properties: ["Versatile"] },
  { id: "whip", name: "Whip", category: "Martial", range: "Melee", cost: "2 gp", weight: 3, damageDice: "1d4", damageType: "Slashing", properties: ["Finesse", "Reach"] },
];

export const SRD_ARMOR: SrdArmor[] = [
  { id: "breastplate", name: "Breastplate", category: "Medium", cost: "400 gp", weight: 20, baseAC: 14, dexBonus: true, maxDexBonus: 2, stealthDisadvantage: false },
  { id: "chain-mail", name: "Chain Mail", category: "Heavy", cost: "75 gp", weight: 55, baseAC: 16, dexBonus: false, stealthDisadvantage: true },
  { id: "chain-shirt", name: "Chain Shirt", category: "Medium", cost: "50 gp", weight: 20, baseAC: 13, dexBonus: true, maxDexBonus: 2, stealthDisadvantage: false },
  { id: "half-plate-armor", name: "Half Plate Armor", category: "Medium", cost: "750 gp", weight: 40, baseAC: 15, dexBonus: true, maxDexBonus: 2, stealthDisadvantage: true },
  { id: "hide-armor", name: "Hide Armor", category: "Medium", cost: "10 gp", weight: 12, baseAC: 12, dexBonus: true, maxDexBonus: 2, stealthDisadvantage: false },
  { id: "leather-armor", name: "Leather Armor", category: "Light", cost: "10 gp", weight: 10, baseAC: 11, dexBonus: true, stealthDisadvantage: false },
  { id: "padded-armor", name: "Padded Armor", category: "Light", cost: "5 gp", weight: 8, baseAC: 11, dexBonus: true, stealthDisadvantage: true },
  { id: "plate-armor", name: "Plate Armor", category: "Heavy", cost: "1500 gp", weight: 65, baseAC: 18, dexBonus: false, stealthDisadvantage: true },
  { id: "ring-mail", name: "Ring Mail", category: "Heavy", cost: "30 gp", weight: 40, baseAC: 14, dexBonus: false, stealthDisadvantage: true },
  { id: "scale-mail", name: "Scale Mail", category: "Medium", cost: "50 gp", weight: 45, baseAC: 14, dexBonus: true, maxDexBonus: 2, stealthDisadvantage: true },
  { id: "shield", name: "Shield", category: "Shield", cost: "10 gp", weight: 6, baseAC: 2, dexBonus: false, stealthDisadvantage: false },
  { id: "splint-armor", name: "Splint Armor", category: "Heavy", cost: "200 gp", weight: 60, baseAC: 17, dexBonus: false, stealthDisadvantage: true },
  { id: "studded-leather-armor", name: "Studded Leather Armor", category: "Light", cost: "45 gp", weight: 13, baseAC: 12, dexBonus: true, stealthDisadvantage: false },
];

export const SRD_GEAR: SrdGear[] = [
  { id: "abacus", name: "Abacus", cost: "2 gp", weight: 2 },
  { id: "acid-vial", name: "Acid (vial)", cost: "25 gp", weight: 1 },
  { id: "alchemists-fire-flask", name: "Alchemist's fire (flask)", cost: "50 gp", weight: 1 },
  { id: "alms-box", name: "Alms box", cost: "0 cp", weight: 0 },
  { id: "amulet", name: "Amulet", cost: "5 gp", weight: 1 },
  { id: "antitoxin-vial", name: "Antitoxin (vial)", cost: "50 gp", weight: 0 },
  { id: "arrow", name: "Arrow", cost: "1 gp", weight: 1 },
  { id: "backpack", name: "Backpack", cost: "2 gp", weight: 5 },
  { id: "ball-bearings-bag-of-1000", name: "Ball bearings (bag of 1,000)", cost: "1 gp", weight: 2 },
  { id: "barrel", name: "Barrel", cost: "2 gp", weight: 70 },
  { id: "basket", name: "Basket", cost: "4 sp", weight: 2 },
  { id: "bedroll", name: "Bedroll", cost: "1 gp", weight: 7 },
  { id: "bell", name: "Bell", cost: "1 gp", weight: 0 },
  { id: "blanket", name: "Blanket", cost: "5 sp", weight: 3 },
  { id: "block-and-tackle", name: "Block and tackle", cost: "1 gp", weight: 5 },
  { id: "block-of-incense", name: "Block of incense", cost: "0 cp", weight: 0 },
  { id: "blowgun-needle", name: "Blowgun needle", cost: "1 gp", weight: 1 },
  { id: "book", name: "Book", cost: "25 gp", weight: 5 },
  { id: "bottle-glass", name: "Bottle, glass", cost: "2 gp", weight: 2 },
  { id: "bucket", name: "Bucket", cost: "5 cp", weight: 2 },
  { id: "burglars-pack", name: "Burglar's Pack", cost: "16 gp", weight: 0 },
  { id: "caltrops", name: "Caltrops", cost: "5 cp", weight: 2 },
  { id: "candle", name: "Candle", cost: "1 cp", weight: 0 },
  { id: "case-crossbow-bolt", name: "Case, crossbow bolt", cost: "1 gp", weight: 1 },
  { id: "case-map-or-scroll", name: "Case, map or scroll", cost: "1 gp", weight: 1 },
  { id: "censer", name: "Censer", cost: "0 cp", weight: 0 },
  { id: "chain-10-feet", name: "Chain (10 feet)", cost: "5 gp", weight: 10 },
  { id: "chalk-1-piece", name: "Chalk (1 piece)", cost: "1 cp", weight: 0 },
  { id: "chest", name: "Chest", cost: "5 gp", weight: 25 },
  { id: "climbers-kit", name: "Climber's Kit", cost: "25 gp", weight: 12 },
  { id: "clothes-common", name: "Clothes, common", cost: "5 sp", weight: 3 },
  { id: "clothes-costume", name: "Clothes, costume", cost: "5 gp", weight: 4 },
  { id: "clothes-fine", name: "Clothes, fine", cost: "15 gp", weight: 6 },
  { id: "clothes-travelers", name: "Clothes, traveler's", cost: "2 gp", weight: 4 },
  { id: "component-pouch", name: "Component pouch", cost: "25 gp", weight: 2 },
  { id: "crossbow-bolt", name: "Crossbow bolt", cost: "1 gp", weight: 1.5 },
  { id: "crowbar", name: "Crowbar", cost: "2 gp", weight: 5 },
  { id: "crystal", name: "Crystal", cost: "10 gp", weight: 1 },
  { id: "diplomats-pack", name: "Diplomat's Pack", cost: "39 gp", weight: 0 },
  { id: "disguise-kit", name: "Disguise Kit", cost: "25 gp", weight: 3 },
  { id: "dungeoneers-pack", name: "Dungeoneer's Pack", cost: "12 gp", weight: 0 },
  { id: "emblem", name: "Emblem", cost: "5 gp", weight: 0 },
  { id: "entertainers-pack", name: "Entertainer's Pack", cost: "40 gp", weight: 0 },
  { id: "explorers-pack", name: "Explorer's Pack", cost: "10 gp", weight: 0 },
  { id: "fishing-tackle", name: "Fishing tackle", cost: "1 gp", weight: 4 },
  { id: "flask-or-tankard", name: "Flask or tankard", cost: "2 cp", weight: 1 },
  { id: "forgery-kit", name: "Forgery Kit", cost: "15 gp", weight: 5 },
  { id: "grappling-hook", name: "Grappling hook", cost: "2 gp", weight: 4 },
  { id: "hammer", name: "Hammer", cost: "1 gp", weight: 3 },
  { id: "hammer-sledge", name: "Hammer, sledge", cost: "2 gp", weight: 10 },
  { id: "healers-kit", name: "Healer's Kit", cost: "5 gp", weight: 3 },
  { id: "herbalism-kit", name: "Herbalism Kit", cost: "5 gp", weight: 3 },
  { id: "holy-water-flask", name: "Holy water (flask)", cost: "25 gp", weight: 1 },
  { id: "hourglass", name: "Hourglass", cost: "25 gp", weight: 1 },
  { id: "hunting-trap", name: "Hunting trap", cost: "5 gp", weight: 25 },
  { id: "ink-1-ounce-bottle", name: "Ink (1 ounce bottle)", cost: "10 gp", weight: 0 },
  { id: "ink-pen", name: "Ink pen", cost: "2 cp", weight: 0 },
  { id: "jug-or-pitcher", name: "Jug or pitcher", cost: "2 cp", weight: 4 },
  { id: "ladder-10-foot", name: "Ladder (10-foot)", cost: "1 sp", weight: 25 },
  { id: "lamp", name: "Lamp", cost: "5 sp", weight: 1 },
  { id: "lantern-bullseye", name: "Lantern, bullseye", cost: "10 gp", weight: 2 },
  { id: "lantern-hooded", name: "Lantern, hooded", cost: "5 gp", weight: 2 },
  { id: "little-bag-of-sand", name: "Little bag of sand", cost: "0 cp", weight: 0 },
  { id: "lock", name: "Lock", cost: "10 gp", weight: 1 },
  { id: "magnifying-glass", name: "Magnifying glass", cost: "100 gp", weight: 0 },
  { id: "manacles", name: "Manacles", cost: "2 gp", weight: 6 },
  { id: "mess-kit", name: "Mess Kit", cost: "2 sp", weight: 1 },
  { id: "mirror-steel", name: "Mirror, steel", cost: "5 gp", weight: 0.5 },
  { id: "oil-flask", name: "Oil (flask)", cost: "1 sp", weight: 1 },
  { id: "orb", name: "Orb", cost: "20 gp", weight: 3 },
  { id: "paper-one-sheet", name: "Paper (one sheet)", cost: "2 sp", weight: 0 },
  { id: "parchment-one-sheet", name: "Parchment (one sheet)", cost: "1 sp", weight: 0 },
  { id: "perfume-vial", name: "Perfume (vial)", cost: "5 gp", weight: 0 },
  { id: "pick-miners", name: "Pick, miner's", cost: "2 gp", weight: 10 },
  { id: "piton", name: "Piton", cost: "5 cp", weight: 0.25 },
  { id: "poison-basic-vial", name: "Poison, basic (vial)", cost: "100 gp", weight: 0 },
  { id: "poisoners-kit", name: "Poisoner's Kit", cost: "50 gp", weight: 2 },
  { id: "pole-10-foot", name: "Pole (10-foot)", cost: "5 cp", weight: 7 },
  { id: "pot-iron", name: "Pot, iron", cost: "2 gp", weight: 10 },
  { id: "pouch", name: "Pouch", cost: "5 sp", weight: 1 },
  { id: "priests-pack", name: "Priest's Pack", cost: "19 gp", weight: 0 },
  { id: "quiver", name: "Quiver", cost: "1 gp", weight: 1 },
  { id: "ram-portable", name: "Ram, portable", cost: "4 gp", weight: 35 },
  { id: "rations-1-day", name: "Rations (1 day)", cost: "5 sp", weight: 2 },
  { id: "reliquary", name: "Reliquary", cost: "5 gp", weight: 2 },
  { id: "robes", name: "Robes", cost: "1 gp", weight: 4 },
  { id: "rod", name: "Rod", cost: "10 gp", weight: 2 },
  { id: "rope-hempen-50-feet", name: "Rope, hempen (50 feet)", cost: "1 gp", weight: 10 },
  { id: "rope-silk-50-feet", name: "Rope, silk (50 feet)", cost: "10 gp", weight: 5 },
  { id: "sack", name: "Sack", cost: "1 cp", weight: 0.5 },
  { id: "scale-merchants", name: "Scale, merchant's", cost: "5 gp", weight: 3 },
  { id: "scholars-pack", name: "Scholar's Pack", cost: "40 gp", weight: 0 },
  { id: "sealing-wax", name: "Sealing wax", cost: "5 sp", weight: 0 },
  { id: "shovel", name: "Shovel", cost: "2 gp", weight: 5 },
  { id: "signal-whistle", name: "Signal whistle", cost: "5 cp", weight: 0 },
  { id: "signet-ring", name: "Signet ring", cost: "5 gp", weight: 0 },
  { id: "sling-bullet", name: "Sling bullet", cost: "4 cp", weight: 1.5 },
  { id: "small-knife", name: "Small knife", cost: "0 cp", weight: 0 },
  { id: "soap", name: "Soap", cost: "2 cp", weight: 0 },
  { id: "spellbook", name: "Spellbook", cost: "50 gp", weight: 3 },
  { id: "spike-iron", name: "Spike, iron", cost: "1 sp", weight: 5 },
  { id: "sprig-of-mistletoe", name: "Sprig of mistletoe", cost: "1 gp", weight: 0 },
  { id: "spyglass", name: "Spyglass", cost: "1000 gp", weight: 1 },
  { id: "staff", name: "Staff", cost: "5 gp", weight: 4 },
  { id: "string-10-feet", name: "String (10 feet)", cost: "0 cp", weight: 0 },
  { id: "tent-two-person", name: "Tent, two-person", cost: "2 gp", weight: 20 },
  { id: "tinderbox", name: "Tinderbox", cost: "5 sp", weight: 1 },
  { id: "torch", name: "Torch", cost: "1 cp", weight: 1 },
  { id: "totem", name: "Totem", cost: "1 gp", weight: 0 },
  { id: "vestments", name: "Vestments", cost: "0 cp", weight: 0 },
  { id: "vial", name: "Vial", cost: "1 gp", weight: 0 },
  { id: "wand", name: "Wand", cost: "10 gp", weight: 1 },
  { id: "waterskin", name: "Waterskin", cost: "2 sp", weight: 5 },
  { id: "whetstone", name: "Whetstone", cost: "1 cp", weight: 1 },
  { id: "wooden-staff", name: "Wooden staff", cost: "5 gp", weight: 4 },
  { id: "yew-wand", name: "Yew wand", cost: "10 gp", weight: 1 },
];

export function findSrdWeapon(name: string): SrdWeapon | undefined {
  return SRD_WEAPONS.find((w) => w.name.toLowerCase() === name.trim().toLowerCase());
}

export function findSrdArmor(name: string): SrdArmor | undefined {
  return SRD_ARMOR.find((a) => a.name.toLowerCase() === name.trim().toLowerCase());
}

export function findSrdGear(name: string): SrdGear | undefined {
  return SRD_GEAR.find((g) => g.name.toLowerCase() === name.trim().toLowerCase());
}

export function weaponDamageText(weapon: SrdWeapon): string {
  return weapon.damageDice ? `${weapon.damageDice} ${weapon.damageType.toLowerCase()}` : "";
}

export function armorACFormulaText(armor: SrdArmor): string {
  if (!armor.dexBonus) return `Base AC ${armor.baseAC} (no Dex bonus)`;
  if (armor.maxDexBonus !== undefined) return `Base AC ${armor.baseAC} + Dex modifier (max ${armor.maxDexBonus})`;
  return `Base AC ${armor.baseAC} + Dex modifier`;
}

/** Converts an SrdArmor into the structured `armor` payload an inventory item stores, so
 * effectiveAC() (dnd5e.ts) can compute real AC instead of reading the formula out of notes text. */
export function srdArmorToInventoryArmor(armor: SrdArmor): {
  baseAC: number;
  addDex: boolean;
  maxDex?: number;
  category: "light" | "medium" | "heavy" | "shield";
  stealthDisadvantage: boolean;
} {
  return {
    baseAC: armor.baseAC,
    addDex: armor.dexBonus,
    maxDex: armor.maxDexBonus,
    category: armor.category.toLowerCase() as "light" | "medium" | "heavy" | "shield",
    stealthDisadvantage: armor.stealthDisadvantage,
  };
}
