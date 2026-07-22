import { Router } from "express";
import {
  createCampaignSchema,
  updateCampaignSchema,
  joinCampaignSchema,
  createNoteSchema,
  startEncounterSchema,
  createCombatantSchema,
  createRollSchema,
  updateShopSchema,
  createShopItemSchema,
  updateShopItemSchema,
  buyShopItemSchema,
  sellShopItemSchema,
} from "shared";
import { requireAuth, requireGlobalRole } from "../middleware/auth.js";
import { requireCampaignMember, requireDM } from "../middleware/campaign.js";
import {
  createCampaign,
  listCampaignsForUser,
  listAllCampaigns,
  getCampaignDetail,
  updateCampaign,
  regenerateInviteCode,
  joinCampaignByInviteCode,
  deleteCampaign,
  getCampaignOwnerId,
  InviteCodeNotFoundError,
  AlreadyMemberError,
} from "../services/campaigns.service.js";
import { listCharactersForCampaign, getCharacter } from "../services/characters.service.js";
import { createNote, listNotesForCampaign } from "../services/notes.service.js";
import { emitToCampaign } from "../sockets/index.js";
import {
  getActiveEncounterForCampaign,
  startEncounter,
  endEncounter,
  advanceTurn,
  addCombatant,
} from "../services/encounters.service.js";
import { createRoll, listRecentRolls } from "../services/dice.service.js";
import { InvalidDiceFormulaError } from "../lib/dice.js";
import { isGlobalAdmin } from "../services/users.service.js";
import {
  getShop,
  updateShop,
  addShopItem,
  updateShopItem,
  deleteShopItem,
  buyItem,
  sellItem,
  ShopClosedError,
  ShopItemNotFoundError,
  OutOfStockError,
  InsufficientFundsError,
  InventoryItemNotFoundError,
  CharacterNotEligibleError,
} from "../services/shops.service.js";

export const campaignsRouter = Router();

campaignsRouter.use(requireAuth);

campaignsRouter.post("/", requireGlobalRole("dm", "admin"), async (req, res) => {
  const parsed = createCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const campaign = await createCampaign(req.session.userId!, parsed.data.name, parsed.data.description);
  res.status(201).json({ campaign });
});

campaignsRouter.get("/", (req, res) => {
  const campaigns = isGlobalAdmin(req.session.userId!)
    ? listAllCampaigns()
    : listCampaignsForUser(req.session.userId!);
  res.json({ campaigns });
});

campaignsRouter.post("/join", async (req, res) => {
  const parsed = joinCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  try {
    const campaign = await joinCampaignByInviteCode(req.session.userId!, parsed.data.inviteCode);
    res.status(200).json({ campaign });
  } catch (err) {
    if (err instanceof InviteCodeNotFoundError) {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err instanceof AlreadyMemberError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

campaignsRouter.get("/:id", requireCampaignMember, (req, res) => {
  const detail = getCampaignDetail(req.campaignMembership!.campaignId, req.session.userId!, {
    bypassMembership: isGlobalAdmin(req.session.userId!),
  });
  if (!detail) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  res.json({ campaign: detail });
});

campaignsRouter.patch("/:id", requireDM, async (req, res) => {
  const parsed = updateCampaignSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const campaign = await updateCampaign(req.campaignMembership!.campaignId, parsed.data);
  res.json({ campaign });
});

campaignsRouter.delete("/:id", requireCampaignMember, async (req, res) => {
  const campaignId = req.campaignMembership!.campaignId;
  const ownerUserId = getCampaignOwnerId(campaignId);
  if (ownerUserId === null) {
    res.status(404).json({ error: "Campaign not found" });
    return;
  }
  if (ownerUserId !== req.session.userId! && !isGlobalAdmin(req.session.userId!)) {
    res.status(403).json({ error: "Only the campaign owner or an admin can delete this campaign" });
    return;
  }

  await deleteCampaign(campaignId);
  res.status(204).end();
});

campaignsRouter.post("/:id/invite/regenerate", requireDM, async (req, res) => {
  const campaign = await regenerateInviteCode(req.campaignMembership!.campaignId);
  res.json({ inviteCode: campaign.inviteCode });
});

campaignsRouter.get("/:id/characters", requireCampaignMember, (req, res) => {
  const characters = listCharactersForCampaign(req.campaignMembership!.campaignId);
  res.json({ characters });
});

campaignsRouter.get("/:id/notes", requireCampaignMember, (req, res) => {
  const notes = listNotesForCampaign(req.campaignMembership!.campaignId);
  res.json({ notes });
});

campaignsRouter.post("/:id/notes", requireCampaignMember, async (req, res) => {
  const parsed = createNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const campaignId = req.campaignMembership!.campaignId;
  const note = await createNote(campaignId, req.session.userId!, parsed.data.title, parsed.data.contentMd);
  emitToCampaign(campaignId, "notes:changed", { noteId: note.id, action: "created" });
  res.status(201).json({ note });
});

campaignsRouter.get("/:id/encounter", requireCampaignMember, (req, res) => {
  const encounter = getActiveEncounterForCampaign(req.campaignMembership!.campaignId);
  res.json({ encounter });
});

campaignsRouter.post("/:id/encounter/start", requireDM, async (req, res) => {
  const parsed = startEncounterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const campaignId = req.campaignMembership!.campaignId;
  const encounter = await startEncounter(campaignId, parsed.data.name);
  emitToCampaign(campaignId, "initiative:updated", encounter);
  res.status(201).json({ encounter });
});

campaignsRouter.post("/:id/encounter/end", requireDM, async (req, res) => {
  const campaignId = req.campaignMembership!.campaignId;
  const active = getActiveEncounterForCampaign(campaignId);
  if (!active) {
    res.status(404).json({ error: "No active encounter" });
    return;
  }

  const encounter = await endEncounter(active.id);
  emitToCampaign(campaignId, "initiative:updated", encounter);
  res.json({ encounter });
});

campaignsRouter.post("/:id/encounter/advance-turn", requireDM, async (req, res) => {
  const campaignId = req.campaignMembership!.campaignId;
  const active = getActiveEncounterForCampaign(campaignId);
  if (!active) {
    res.status(404).json({ error: "No active encounter" });
    return;
  }

  const encounter = await advanceTurn(active.id);
  emitToCampaign(campaignId, "initiative:updated", encounter);
  res.json({ encounter });
});

campaignsRouter.post("/:id/encounter/combatants", requireDM, async (req, res) => {
  const parsed = createCombatantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const campaignId = req.campaignMembership!.campaignId;
  const active = getActiveEncounterForCampaign(campaignId);
  if (!active) {
    res.status(404).json({ error: "No active encounter" });
    return;
  }

  const encounter = await addCombatant(active.id, parsed.data);
  emitToCampaign(campaignId, "initiative:updated", encounter);
  res.status(201).json({ encounter });
});

campaignsRouter.get("/:id/rolls", requireCampaignMember, (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const rolls = listRecentRolls(req.campaignMembership!.campaignId, limit);
  res.json({ rolls });
});

campaignsRouter.post("/:id/rolls", requireCampaignMember, async (req, res) => {
  const parsed = createRollSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const campaignId = req.campaignMembership!.campaignId;
  try {
    const roll = await createRoll(campaignId, req.session.userId!, parsed.data.formula, parsed.data.label);
    emitToCampaign(campaignId, "roll:created", roll);
    res.status(201).json({ roll });
  } catch (err) {
    if (err instanceof InvalidDiceFormulaError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

campaignsRouter.get("/:id/shop", requireCampaignMember, async (req, res) => {
  const shop = await getShop(req.campaignMembership!.campaignId);
  res.json({ shop });
});

campaignsRouter.patch("/:id/shop", requireDM, async (req, res) => {
  const parsed = updateShopSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }
  const shop = await updateShop(req.campaignMembership!.campaignId, parsed.data);
  res.json({ shop });
});

campaignsRouter.post("/:id/shop/items", requireDM, async (req, res) => {
  const parsed = createShopItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }
  const shop = await addShopItem(req.campaignMembership!.campaignId, parsed.data);
  res.status(201).json({ shop });
});

campaignsRouter.patch("/:id/shop/items/:itemId", requireDM, async (req, res) => {
  const itemId = Number(req.params.itemId);
  if (!Number.isInteger(itemId)) {
    res.status(400).json({ error: "Invalid item id" });
    return;
  }
  const parsed = updateShopItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }
  const shop = await updateShopItem(req.campaignMembership!.campaignId, itemId, parsed.data);
  res.json({ shop });
});

campaignsRouter.delete("/:id/shop/items/:itemId", requireDM, async (req, res) => {
  const itemId = Number(req.params.itemId);
  if (!Number.isInteger(itemId)) {
    res.status(400).json({ error: "Invalid item id" });
    return;
  }
  const shop = await deleteShopItem(req.campaignMembership!.campaignId, itemId);
  res.json({ shop });
});

campaignsRouter.post("/:id/shop/buy", requireCampaignMember, async (req, res) => {
  const parsed = buyShopItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const character = getCharacter(parsed.data.characterId);
  const isDm = req.campaignMembership!.role === "dm";
  if (!character || (character.ownerUserId !== req.session.userId! && !isDm)) {
    res.status(403).json({ error: "Not authorized to transact for this character" });
    return;
  }

  try {
    const result = await buyItem(req.campaignMembership!.campaignId, parsed.data.characterId, parsed.data.shopItemId);
    res.json(result);
  } catch (err) {
    if (
      err instanceof ShopClosedError ||
      err instanceof ShopItemNotFoundError ||
      err instanceof OutOfStockError ||
      err instanceof InsufficientFundsError ||
      err instanceof CharacterNotEligibleError
    ) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

campaignsRouter.post("/:id/shop/sell", requireCampaignMember, async (req, res) => {
  const parsed = sellShopItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const character = getCharacter(parsed.data.characterId);
  const isDm = req.campaignMembership!.role === "dm";
  if (!character || (character.ownerUserId !== req.session.userId! && !isDm)) {
    res.status(403).json({ error: "Not authorized to transact for this character" });
    return;
  }

  try {
    const result = await sellItem(req.campaignMembership!.campaignId, parsed.data.characterId, parsed.data.itemId);
    res.json(result);
  } catch (err) {
    if (
      err instanceof ShopClosedError ||
      err instanceof InventoryItemNotFoundError ||
      err instanceof CharacterNotEligibleError
    ) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});
