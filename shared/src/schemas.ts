import { z } from "zod";

export const registerSchema = z.object({
  username: z.string().trim().min(3).max(32),
  password: z.string().min(8).max(200),
});

export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum(["player", "dm", "admin"]),
});

export const resetUserPasswordSchema = z.object({
  password: z.string().min(8).max(200),
});

export const reassignCharacterOwnerSchema = z.object({
  ownerUserId: z.number().int(),
});
export type ReassignCharacterOwnerInput = z.infer<typeof reassignCharacterOwnerSchema>;

export const createApiTokenSchema = z.object({
  name: z.string().trim().min(1).max(60),
  // Days until the token expires; omitted means it never does. Capped at ~2 years so "never" is a
  // deliberate choice rather than something you land on by typing a big number.
  expiresInDays: z.number().int().min(1).max(730).optional(),
});
export type CreateApiTokenInput = z.infer<typeof createApiTokenSchema>;

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(2000).optional(),
});

export const updateCampaignSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().trim().max(2000).optional(),
});

export const joinCampaignSchema = z.object({
  inviteCode: z.string().trim().min(1),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type JoinCampaignInput = z.infer<typeof joinCampaignSchema>;

export const sheetFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().trim().min(1).max(60),
  type: z.enum(["text", "number", "textarea"]),
  value: z.string().max(4000),
});

// sheetData is validated per-system in the route (see SYSTEMS registry) —
// here it's just an opaque JSON value.
export const createCharacterSchema = z.object({
  campaignId: z.number().int().nullable().optional(),
  name: z.string().trim().min(1).max(100),
  system: z.enum(["generic", "dnd5e", "pf2e"]).default("generic"),
  hpCurrent: z.number().int().nullable().optional(),
  hpMax: z.number().int().nullable().optional(),
  notes: z.string().max(4000).optional(),
  sheetData: z.unknown().optional(),
});

export const updateCharacterSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  hpCurrent: z.number().int().nullable().optional(),
  hpMax: z.number().int().nullable().optional(),
  notes: z.string().max(4000).optional(),
  sheetData: z.unknown().optional(),
  /** When set, the update fails with 409 if the stored `updatedAt` does not match (optimistic concurrency). */
  expectedUpdatedAt: z.string().min(1).optional(),
});

export type CreateCharacterInput = z.infer<typeof createCharacterSchema>;
export type UpdateCharacterInput = z.infer<typeof updateCharacterSchema>;

export const attachCharacterSchema = z.object({
  campaignId: z.number().int(),
});

export type AttachCharacterInput = z.infer<typeof attachCharacterSchema>;

export const createNoteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  contentMd: z.string().max(20000).optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  contentMd: z.string().max(20000).optional(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

export const startEncounterSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
});

export const createCombatantSchema = z.object({
  characterId: z.number().int().nullable().optional(),
  name: z.string().trim().min(1).max(100),
  initiative: z.number().int(),
  hpCurrent: z.number().int().nullable().optional(),
  hpMax: z.number().int().nullable().optional(),
  conditions: z.array(z.string().max(40)).max(20).optional(),
});

export const updateCombatantSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  initiative: z.number().int().optional(),
  hpCurrent: z.number().int().nullable().optional(),
  hpMax: z.number().int().nullable().optional(),
  conditions: z.array(z.string().max(40)).max(20).optional(),
});

export type StartEncounterInput = z.infer<typeof startEncounterSchema>;
export type CreateCombatantInput = z.infer<typeof createCombatantSchema>;
export type UpdateCombatantInput = z.infer<typeof updateCombatantSchema>;

// Restrict dice formulas to a narrow charset (defense-in-depth against the underlying
// expression evaluator, on top of it always running server-side).
export const updateShopSchema = z.object({
  isOpen: z.boolean().optional(),
  buyRatePercent: z.number().int().min(0).max(1000).optional(),
  sellRatePercent: z.number().int().min(0).max(1000).optional(),
});

export const createShopItemSchema = z.object({
  name: z.string().trim().min(1).max(100),
  basePrice: z.number().int().min(0).max(999999).default(0),
  quantity: z.number().int().min(0).max(999999).default(0),
});

export const updateShopItemSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    basePrice: z.number().int().min(0).max(999999).optional(),
    quantity: z.number().int().min(0).max(999999).optional(),
  })
  // Every field is individually optional (a partial patch), but an empty body would reach
  // drizzle's .set({}) and throw "No values to set" before any DB access -- reject it here with a
  // normal 400 instead, and stop it from masking the not-found check behind that unhandled throw.
  .refine((v) => Object.keys(v).length > 0, { message: "At least one field must be provided" });

export const buyShopItemSchema = z.object({
  characterId: z.number().int(),
  shopItemId: z.number().int(),
});

export const sellShopItemSchema = z.object({
  characterId: z.number().int(),
  itemId: z.string().min(1),
});

export type UpdateShopInput = z.infer<typeof updateShopSchema>;
export type CreateShopItemInput = z.infer<typeof createShopItemSchema>;
export type UpdateShopItemInput = z.infer<typeof updateShopItemSchema>;
export type BuyShopItemInput = z.infer<typeof buyShopItemSchema>;
export type SellShopItemInput = z.infer<typeof sellShopItemSchema>;

export const DICE_FORMULA_PATTERN = /^[0-9dD+\-*/().,! <>=khlrxKHLRX]+$/;

export const createRollSchema = z.object({
  formula: z.string().trim().min(1).max(100).regex(DICE_FORMULA_PATTERN, "Invalid dice formula"),
  label: z.string().trim().max(60).optional(),
});

export type CreateRollInput = z.infer<typeof createRollSchema>;
