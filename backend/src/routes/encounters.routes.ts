import { Router } from "express";
import { updateCombatantSchema, startEncounterSchema, createCombatantSchema } from "shared";
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
} from "../services/encounters.service.js";
import { emitToCampaign } from "../sockets/index.js";

export const encountersRouter = Router();

encountersRouter.use(requireAuth);

encountersRouter.get("/personal", (req, res) => {
  const encounter = getActiveEncounterForOwner(req.session.userId!);
  res.json({ encounter });
});

encountersRouter.post("/personal/start", async (req, res) => {
  const parsed = startEncounterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const encounter = await startPersonalEncounter(req.session.userId!, parsed.data.name);
  res.status(201).json({ encounter });
});

encountersRouter.post("/personal/end", async (req, res) => {
  const active = getActiveEncounterForOwner(req.session.userId!);
  if (!active) {
    res.status(404).json({ error: "No active personal encounter" });
    return;
  }
  const encounter = await endEncounter(active.id);
  res.json({ encounter });
});

encountersRouter.post("/personal/advance-turn", async (req, res) => {
  const active = getActiveEncounterForOwner(req.session.userId!);
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

  const active = getActiveEncounterForOwner(req.session.userId!);
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

encountersRouter.delete("/combatants/:id", requireCombatantController, async (req, res) => {
  const encounter = await removeCombatant(Number(req.params.id));
  if (req.combatantCampaignId != null) {
    emitToCampaign(req.combatantCampaignId, "initiative:updated", encounter);
  }
  res.json({ encounter });
});
