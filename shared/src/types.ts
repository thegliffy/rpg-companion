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

export interface DiceRoll {
  id: number;
  campaignId: number | null;
  userId: number;
  username: string;
  formula: string;
  label: string | null;
  total: number;
  breakdown: string;
  createdAt: string;
}
