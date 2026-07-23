import type { Dnd5eAbility, Dnd5eSheetData } from "./dnd5e.js";
import { abilityModifier, effectiveAbilityScore } from "./dnd5e.js";
import { eldritchBlastBeams } from "./class-progression.js";

// SRD 5.1 Eldritch Invocations (CC-BY-4.0), sourced from the open 5e-bits/5e-database project.
// Warlock-only. prereqLevel/prereqPact/prereqSpell mirror the SRD's own prerequisites -- shown as
// a hint in the picker, not hard-enforced (a DM may waive prerequisites at the table).

// A picked invocation becomes a features[] entry named `${INVOCATION_PREFIX}${name}` -- the prefix
// lets the sheet find its known invocations again (e.g. to resolve Eldritch Blast modifiers).
export const INVOCATION_PREFIX = "Invocation: ";

// The mechanical payload an invocation applies on pick, beyond description text. Numeric fields
// mirror effectEntrySchema (dnd5e.ts) since a picked invocation becomes a features[] entry;
// skillProficiencies/grantedSpells are the two grant kinds effectEntrySchema/spellSchema now
// support. The eb* fields are read by eldritchBlastProfile() below.
export interface InvocationGrants {
  skillProficiencies?: string[];
  grantedSpells?: { name: string; srdId?: string; level: number; atWill?: boolean }[];
  sensesText?: string;
  abilityBonuses?: Partial<Record<Dnd5eAbility, number>>;
  acBonus?: number;
  attackBonus?: number;
  damageBonus?: number;
  spellDCBonus?: number;
  spellAttackBonus?: number;
  /** Agonizing Blast: add this ability's modifier to each Eldritch Blast beam's damage. */
  ebDamagePerBeamAbility?: Dnd5eAbility;
  /** Eldritch Spear: Eldritch Blast's range becomes this many feet. */
  ebRangeFeet?: number;
  /** Repelling Blast: a hit can push the target up to 10 feet. */
  ebPush?: boolean;
}

export interface SrdInvocation {
  id: string;
  name: string;
  description: string;
  prereqLevel: number;
  prereqPact?: "blade" | "chain" | "tome";
  prereqSpell?: string;
  grants?: InvocationGrants;
}

export const SRD_INVOCATIONS: SrdInvocation[] = [
  { id: "eldritch-invocation-agonizing-blast", name: "Agonizing Blast", description: "When you cast eldritch blast, add your Charisma modifier to the damage it deals on a hit.", prereqLevel: 2, prereqSpell: "Eldritch Blast", grants: { ebDamagePerBeamAbility: "cha" } },
  { id: "eldritch-invocation-armor-of-shadows", name: "Armor of Shadows", description: "You can cast mage armor on yourself at will, without expending a spell slot or material components.", prereqLevel: 2, grants: { grantedSpells: [{ name: "Mage Armor", srdId: "mage-armor", level: 1, atWill: true }] } },
  { id: "eldritch-invocation-beast-speech", name: "Beast Speech", description: "You can cast speak with animals at will, without expending a spell slot.", prereqLevel: 2, grants: { grantedSpells: [{ name: "Speak with Animals", srdId: "speak-with-animals", level: 1, atWill: true }] } },
  { id: "eldritch-invocation-beguiling-influence", name: "Beguiling Influence", description: "You gain proficiency in the Deception and Persuasion skills.", prereqLevel: 2, grants: { skillProficiencies: ["deception", "persuasion"] } },
  { id: "eldritch-invocation-book-of-ancient-secrets", name: "Book of Ancient Secrets", description: "You can now inscribe magical rituals in your Book of Shadows. Choose two 1st-level spells that have the ritual tag from any class's spell list (the two needn't be from the same list). The spells appear in the book and don't count against the number of spells you know. With your Book of Shadows in hand, you can cast the chosen spells as rituals. You can't cast the spells except as rituals, unless you've learned them by some other means. You can also cast a warlock spell you know as a ritual if it has the ritual tag. On your adventures, you can add other ritual spells to your Book of Shadows. When you find such a spell, you can add it to the book if the spell's level is equal to or less than half your warlock level (rounded up) and if you can spare the time to transcribe the spell. For each level of the spell, the transcription process takes 2 hours and costs 50 gp for the rare inks needed to inscribe it.", prereqLevel: 2, prereqPact: "tome" },
  { id: "eldritch-invocation-devils-sight", name: "Devil's Sight", description: "You can see normally in darkness, both magical and nonmagical, to a distance of 120 feet.", prereqLevel: 2, grants: { sensesText: "Darkvision 120 ft (sees through magical darkness)" } },
  { id: "eldritch-invocation-eldritch-sight", name: "Eldritch Sight", description: "You can cast detect magic at will, without expending a spell slot.", prereqLevel: 2, grants: { grantedSpells: [{ name: "Detect Magic", srdId: "detect-magic", level: 1, atWill: true }] } },
  { id: "eldritch-invocation-eldritch-spear", name: "Eldritch Spear", description: "When you cast eldritch blast, its range is 300 feet.", prereqLevel: 2, prereqSpell: "Eldritch Blast", grants: { ebRangeFeet: 300 } },
  { id: "eldritch-invocation-eyes-of-the-rune-keeper", name: "Eyes of the Rune Keeper", description: "You can read all writing.", prereqLevel: 2 },
  { id: "eldritch-invocation-fiendish-vigor", name: "Fiendish Vigor", description: "You can cast false life on yourself at will as a 1st-level spell, without expending a spell slot or material components.", prereqLevel: 2, grants: { grantedSpells: [{ name: "False Life", srdId: "false-life", level: 1, atWill: true }] } },
  { id: "eldritch-invocation-gaze-of-two-minds", name: "Gaze of Two Minds", description: "You can use your action to touch a willing humanoid and perceive through its senses until the end of your next turn. As long as the creature is on the same plane of existence as you, you can use your action on subsequent turns to maintain this connection, extending the duration until the end of your next turn. While perceiving through the other creature's senses, you benefit from any special senses possessed by that creature, and you are blinded and deafened to your own surroundings.", prereqLevel: 2 },
  { id: "eldritch-invocation-mask-of-many-faces", name: "Mask of Many Faces", description: "You can cast disguise self at will, without expending a spell slot.", prereqLevel: 2, grants: { grantedSpells: [{ name: "Disguise Self", srdId: "disguise-self", level: 1, atWill: true }] } },
  { id: "eldritch-invocation-misty-visions", name: "Misty Visions", description: "You can cast silent image at will, without expending a spell slot or material components.", prereqLevel: 2, grants: { grantedSpells: [{ name: "Silent Image", srdId: "silent-image", level: 1, atWill: true }] } },
  { id: "eldritch-invocation-repelling-blast", name: "Repelling Blast", description: "When you hit a creature with eldritch blast, you can push the creature up to 10 feet away from you in a straight line.", prereqLevel: 2, prereqSpell: "Eldritch Blast", grants: { ebPush: true } },
  { id: "eldritch-invocation-thief-of-five-fates", name: "Thief of Five Fates", description: "You can cast bane once using a warlock spell slot. You can't do so again until you finish a long rest.", prereqLevel: 2 },
  { id: "eldritch-invocation-voice-of-the-chain-master", name: "Voice of the Chain Master", description: "You can communicate telepathically with your familiar and perceive through your familiar's senses as long as you are on the same plane of existence. Additionally, while perceiving through your familiar's senses, you can also speak through your familiar in your own voice, even if your familiar is normally incapable of speech.", prereqLevel: 2, prereqPact: "chain" },
  { id: "eldritch-invocation-mire-the-mind", name: "Mire the Mind", description: "You can cast slow once using a warlock spell slot. You can't do so again until you finish a long rest.", prereqLevel: 5 },
  { id: "eldritch-invocation-one-with-shadows", name: "One with Shadows", description: "When you are in an area of dim light or darkness, you can use your action to become invisible until you move or take an action or a reaction.", prereqLevel: 5 },
  { id: "eldritch-invocation-sign-of-ill-omen", name: "Sign of Ill Omen", description: "You can cast bestow curse once using a warlock spell slot. You can't do so again until you finish a long rest.", prereqLevel: 5 },
  { id: "eldritch-invocation-thirsting-blade", name: "Thirsting Blade", description: "You can attack with your pact weapon twice, instead of once, whenever you take the Attack action on your turn.", prereqLevel: 5, prereqPact: "blade" },
  { id: "eldritch-invocation-bewitching-whispers", name: "Bewitching Whispers", description: "You can cast compulsion once using a warlock spell slot. You can't do so again until you finish a long rest.", prereqLevel: 7 },
  { id: "eldritch-invocation-dreadful-word", name: "Dreadful Word", description: "You can cast confusion once using a warlock spell slot. You can't do so again until you finish a long rest.", prereqLevel: 7 },
  { id: "eldritch-invocation-sculptor-of-flesh", name: "Sculptor of Flesh", description: "You can cast polymorph once using a warlock spell slot. You can't do so again until you finish a long rest.", prereqLevel: 7 },
  { id: "eldritch-invocation-ascendant-step", name: "Ascendant Step", description: "You can cast levitate on yourself at will, without expending a spell slot or material components.", prereqLevel: 9, grants: { grantedSpells: [{ name: "Levitate", srdId: "levitate", level: 2, atWill: true }] } },
  { id: "eldritch-invocation-minions-of-chaos", name: "Minions of Chaos", description: "You can cast conjure elemental once using a warlock spell slot. You can't do so again until you finish a long rest.", prereqLevel: 9 },
  { id: "eldritch-invocation-otherworldly-leap", name: "Otherworldly Leap", description: "You can cast jump on yourself at will, without expending a spell slot or material components.", prereqLevel: 9, grants: { grantedSpells: [{ name: "Jump", srdId: "jump", level: 1, atWill: true }] } },
  { id: "eldritch-invocation-whispers-of-the-grave", name: "Whispers of the Grave", description: "You can cast speak with dead at will, without expending a spell slot.", prereqLevel: 9, grants: { grantedSpells: [{ name: "Speak with Dead", srdId: "speak-with-dead", level: 3, atWill: true }] } },
  { id: "eldritch-invocation-lifedrinker", name: "Lifedrinker", description: "When you hit a creature with your pact weapon, the creature takes extra necrotic damage equal to your Charisma modifier (minimum 1).", prereqLevel: 12, prereqPact: "blade" },
  { id: "eldritch-invocation-chains-of-carceri", name: "Chains of Carceri", description: "You can cast hold monster at will--targeting a celestial, fiend, or elemental--without expending a spell slot or material components. You must finish a long rest before you can use this invocation on the same creature again.", prereqLevel: 15, prereqPact: "chain" },
  { id: "eldritch-invocation-master-of-myriad-forms", name: "Master of Myriad Forms", description: "You can cast alter self at will, without expending a spell slot.", prereqLevel: 15, grants: { grantedSpells: [{ name: "Alter Self", srdId: "alter-self", level: 2, atWill: true }] } },
  { id: "eldritch-invocation-visions-of-distant-realms", name: "Visions of Distant Realms", description: "You can cast arcane eye at will, without expending a spell slot.", prereqLevel: 15, grants: { grantedSpells: [{ name: "Arcane Eye", srdId: "arcane-eye", level: 4, atWill: true }] } },
  { id: "eldritch-invocation-witch-sight", name: "Witch Sight", description: "You can see the true form of any shapechanger or creature concealed by illusion or transmutation magic while the creature is within 30 feet of you and within line of sight.", prereqLevel: 15 },
];

export function findInvocation(id: string): SrdInvocation | undefined {
  return SRD_INVOCATIONS.find((i) => i.id === id);
}

/** The grants of every invocation the sheet currently knows (matched by the features[] entries the
 * invocation picker adds, named `${INVOCATION_PREFIX}${name}`). */
export function knownInvocationGrants(sheet: Dnd5eSheetData): InvocationGrants[] {
  return sheet.features
    .filter((f) => f.name.startsWith(INVOCATION_PREFIX))
    .map((f) => SRD_INVOCATIONS.find((inv) => inv.name === f.name.slice(INVOCATION_PREFIX.length))?.grants)
    .filter((g): g is InvocationGrants => g !== undefined);
}

// Resolved Eldritch Blast profile for a sheet, folding in the beam count (by level) and the
// Agonizing Blast / Eldritch Spear / Repelling Blast invocation modifiers.
export interface EldritchBlastProfile {
  beams: number;
  damageDice: string; // per beam, e.g. "1d10" or "1d10+4" with Agonizing Blast
  damagePerBeamBonus: number;
  rangeFeet: number;
  push: boolean;
  agonizing: boolean;
  eldritchSpear: boolean;
}

/** Resolves Eldritch Blast's beams/damage/range from level + known invocations, so the sheet's
 * dedicated EB cast control can roll each beam correctly (Agonizing Blast adds the caster's
 * Charisma modifier to every beam's damage; Eldritch Spear extends the range to 300 ft). */
export function eldritchBlastProfile(sheet: Dnd5eSheetData): EldritchBlastProfile {
  const grants = knownInvocationGrants(sheet);
  const agonizingAbility = grants.find((g) => g.ebDamagePerBeamAbility)?.ebDamagePerBeamAbility;
  const spearRange = grants.find((g) => g.ebRangeFeet)?.ebRangeFeet;
  const push = grants.some((g) => g.ebPush);
  const bonus = agonizingAbility ? Math.max(0, abilityModifier(effectiveAbilityScore(sheet, agonizingAbility))) : 0;
  return {
    beams: eldritchBlastBeams(sheet.level),
    damageDice: bonus > 0 ? `1d10+${bonus}` : "1d10",
    damagePerBeamBonus: bonus,
    rangeFeet: spearRange ?? 120,
    push,
    agonizing: agonizingAbility !== undefined,
    eldritchSpear: spearRange !== undefined,
  };
}
