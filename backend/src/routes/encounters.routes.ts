import { Router } from "express";
import { updateCombatantSchema, startEncounterSchema, createCombatantSchema, dnd5eSheetSchema, initiativeBonus } from "shared";
import { requireAuth } from "../middleware/auth.js";
import { requireCombatantController } from "../middleware/combatant.js";
import {
  updateCombatant,
  removeCombatant,
  getActiveEncounterForOwner,
  startPersonalEncounter,
  endEncounter,
  advanceTurn,
  addCombatant,
  getCombatantRow,
  getEncounterRow,
} from "../services/encounters.service.js";
import { getCharacterRow } from "../services/characters.service.js";
import { createRoll } from "../services/dice.service.js";
import { emitToCampaign } from "../sockets/index.js";

export const encountersRouter = Router();

encountersRouter.use(requireAuth);

encountersRouter.get("/personal", (req, res) => {
  const encounter = getActiveEncounterForOwner(req.authUserId!);
  res.json({ encounter });
});

encountersRouter.post("/personal/start", async (req, res) => {
  const parsed = startEncounterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const encounter = await startPersonalEncounter(req.authUserId!, parsed.data.name);
  res.status(201).json({ encounter });
});

encountersRouter.post("/personal/end", async (req, res) => {
  const active = getActiveEncounterForOwner(req.authUserId!);
  if (!active) {
    res.status(404).json({ error: "No active personal encounter" });
    return;
  }
  const encounter = await endEncounter(active.id);
  res.json({ encounter });
});

encountersRouter.post("/personal/advance-turn", async (req, res) => {
  const active = getActiveEncounterForOwner(req.authUserId!);
  if (!active) {
    res.status(404).json({ error: "No active personal encounter" });
    return;
  }
  const encounter = await advanceTurn(active.id);
  res.json({ encounter });
});

encountersRouter.post("/personal/combatants", async (req, res) => {
  const parsed = createCombatantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const active = getActiveEncounterForOwner(req.authUserId!);
  if (!active) {
    res.status(404).json({ error: "No active personal encounter" });
    return;
  }
  const encounter = await addCombatant(active.id, parsed.data);
  res.status(201).json({ encounter });
});

encountersRouter.patch("/combatants/:id", requireCombatantController, async (req, res) => {
  const parsed = updateCombatantSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const encounter = await updateCombatant(Number(req.params.id), parsed.data);
  if (req.combatantCampaignId != null) {
    emitToCampaign(req.combatantCampaignId, "initiative:updated", encounter);
  }
  res.json({ encounter });
});

encountersRouter.post("/combatants/:id/roll-initiative", requireCombatantController, async (req, res) => {
  const combatant = getCombatantRow(Number(req.params.id));
  if (!combatant) {
    res.status(404).json({ error: "Combatant not found" });
    return;
  }

  // Initiative = d20 + the character's modifier (Dex, plus flat bonuses like Alert) when the
  // combatant is linked to a dnd5e character sheet; a plain d20 otherwise (monsters and
  // hand-added combatants have no sheet to read a bonus from).
  let bonus = 0;
  if (combatant.characterId !== null) {
    const character = getCharacterRow(combatant.characterId);
    if (character?.system === "dnd5e") {
      const parsed = dnd5eSheetSchema.safeParse(JSON.parse(character.sheetData));
      if (parsed.success) bonus = initiativeBonus(parsed.data);
    }
  }
  const formula = bonus === 0 ? "1d20" : `1d20${bonus >= 0 ? "+" : "-"}${Math.abs(bonus)}`;

  const encounter = getEncounterRow(combatant.encounterId);
  if (!encounter) {
    res.status(404).json({ error: "Encounter not found" });
    return;
  }

  const roll = await createRoll(encounter.campaignId, req.authUserId!, formula, `Initiative — ${combatant.name}`);
  if (encounter.campaignId !== null) {
    emitToCampaign(encounter.campaignId, "roll:created", roll);
  }

  // Re-sort happens automatically: snapshots order combatants by initiative desc.
  const updated = await updateCombatant(combatant.id, { initiative: roll.total });
  if (req.combatantCampaignId != null) {
    emitToCampaign(req.combatantCampaignId, "initiative:updated", updated);
  }
  res.json({ roll, encounter: updated });
});

encountersRouter.delete("/combatants/:id", requireCombatantController, async (req, res) => {
  const encounter = await removeCombatant(Number(req.params.id));
  if (req.combatantCampaignId != null) {
    emitToCampaign(req.combatantCampaignId, "initiative:updated", encounter);
  }
  res.json({ encounter });
});
