export type GlobalRole = "player" | "dm" | "admin";

export interface PublicUser {
  id: number;
  username: string;
  role: GlobalRole;
  createdAt: string;
}

export type CustomContentType = "race" | "class" | "background" | "subrace" | "subclass" | "feat" | "spell" | "item" | "monster";
export type CustomContentStatus = "pending" | "approved";
export type CustomContentSystem = "generic" | "dnd5e" | "pf2e";

export interface CustomContent {
  id: number;
  type: CustomContentType;
  system: CustomContentSystem;
  createdByUserId: number;
  createdByUsername: string;
  name: string;
  data: unknown;
  status: CustomContentStatus;
  approvedByUserId: number | null;
  approvedAt: string | null;
  createdAt: string;
}

export type CampaignRole = "dm" | "player";

export interface CampaignSummary {
  id: number;
  name: string;
  description: string | null;
  role: CampaignRole;
  createdAt: string;
}

export interface CampaignMember {
  userId: number;
  username: string;
  role: CampaignRole;
  joinedAt: string;
}

export interface CampaignDetail extends CampaignSummary {
  inviteCode: string | null;
  members: CampaignMember[];
  ownerUserId: number;
}

export interface ShopItem {
  id: number;
  shopId: number;
  name: string;
  basePrice: number;
  quantity: number;
  createdAt: string;
}

export interface Shop {
  id: number;
  campaignId: number;
  isOpen: boolean;
  buyRatePercent: number;
  sellRatePercent: number;
  items: ShopItem[];
  createdAt: string;
  updatedAt: string;
}

export type SheetFieldType = "text" | "number" | "textarea";

export interface SheetField {
  id: string;
  label: string;
  type: SheetFieldType;
  value: string;
}

export interface Character {
  id: number;
  campaignId: number | null;
  campaignName: string | null;
  ownerUserId: number;
  ownerUsername: string;
  name: string;
  system: "generic" | "dnd5e" | "pf2e";
  hpCurrent: number | null;
  hpMax: number | null;
  notes: string | null;
  /** Per-system sheet payload; shape depends on `system` (SheetField[] for generic). */
  sheetData: unknown;
  createdAt: string;
  updatedAt: string;
}

// Admin-only listing shapes (#128) -- deliberately lean: CustomContent.data and Character.sheetData
// are whole content/sheet payloads (sheetData also carries the owner-only privateNotes field), so
// a site-wide admin list must not ship either. Single-item fetches (GET /:id) still return the
// full shape for editing; these are list-view summaries only.
export interface AdminContentSummary {
  id: number;
  type: CustomContentType;
  system: CustomContentSystem;
  createdByUserId: number;
  createdByUsername: string;
  name: string;
  status: CustomContentStatus;
  approvedByUserId: number | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface AdminCharacterSummary {
  id: number;
  name: string;
  ownerUserId: number;
  ownerUsername: string;
  campaignId: number | null;
  campaignName: string | null;
  system: "generic" | "dnd5e" | "pf2e";
  // Extracted server-side from sheetData without shipping the rest of it -- null when the system
  // doesn't model the concept (pf2e/generic have no status; a malformed/legacy sheet has neither).
  level: number | null;
  status: "active" | "dead" | "retired" | null;
  updatedAt: string;
}

// Dependant counts blocking a user delete (#135) -- returned on the 409 so the admin knows what
// to reassign or delete first, rather than guessing from an opaque FK constraint error.
export interface AdminUserDependants {
  characters: number;
  campaignsOwned: number;
  campaignMemberships: number;
  customContent: number;
  diceRolls: number;
  notes: number;
  // api_tokens.user_id is NOT NULL too (#146), so live tokens block a user delete exactly like the
  // six above -- counted here so the 409 breakdown stays complete rather than the delete failing
  // with an opaque FK constraint error.
  apiTokens: number;
}

// An API token as it can safely be listed (#146) -- deliberately no way to get the token itself
// back. Only the SHA-256 hash is stored, so `prefix` is all there is to identify one by after
// creation; the plaintext exists exactly once, in the POST /api/tokens response.
export interface ApiTokenSummary {
  id: number;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

/** The one and only time the plaintext token is ever returned. */
export interface CreatedApiToken {
  token: string;
  tokenInfo: ApiTokenSummary;
}

export interface Note {
  id: number;
  campaignId: number | null;
  authorUserId: number;
  authorUsername: string;
  title: string;
  contentMd: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotesChangedPayload {
  noteId: number;
  action: "created" | "updated" | "deleted";
}

export interface Combatant {
  id: number;
  characterId: number | null;
  name: string;
  initiative: number;
  hpCurrent: number | null;
  hpMax: number | null;
  conditions: string[];
  sortOrder: number;
}

export interface EncounterSnapshot {
  id: number;
  campaignId: number | null;
  ownerUserId: number | null;
  name: string;
  isActive: boolean;
  round: number;
  currentTurnIndex: number;
  combatants: Combatant[];
}

// Structured per-die roll data (#136) -- built server-side by zipping the parsed notation's die
// sizes (Parser.parse, which the rolled-result JSON doesn't carry) with the rolled values
// (DiceRoll#toJSON, which the parsed notation doesn't carry). Additive alongside `breakdown`
// below, not a replacement -- the text stays the source of truth for the dice log, the socket
// payload, and any future non-visual surface.
export interface RollDetailDie {
  value: number;
  // false for a die a modifier discarded (e.g. the dropped die in 4d6kh3) -- rendered
  // struck-through rather than hidden, since seeing what got dropped is the point.
  kept: boolean;
}

export interface RollDetailDiceTerm {
  kind: "dice";
  sides: number;
  dice: RollDetailDie[];
  subtotal: number;
}

export interface RollDetailConstantTerm {
  kind: "constant";
  value: number;
}

export interface RollDetailOperatorTerm {
  kind: "operator";
  op: "+" | "-";
}

export type RollDetailTerm = RollDetailDiceTerm | RollDetailConstantTerm | RollDetailOperatorTerm;

export interface RollDetail {
  terms: RollDetailTerm[];
  total: number;
}

export interface DiceRoll {
  id: number;
  campaignId: number | null;
  userId: number;
  username: string;
  formula: string;
  label: string | null;
  total: number;
  breakdown: string;
  // Null for rolls made before #136 (or anything the zip couldn't confidently structure) -- the
  // renderer falls back to `breakdown` text in that case rather than faking an empty roll.
  detail: RollDetail | null;
  createdAt: string;
}
