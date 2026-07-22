import type { Request, Response, NextFunction } from "express";
import { getCombatantRow, getEncounterRow } from "../services/encounters.service.js";
import { getMembership } from "../services/campaigns.service.js";

declare global {
  namespace Express {
    interface Request {
      combatantCampaignId?: number | null;
    }
  }
}

// Campaign encounters: only the DM may modify combatants.
// Personal encounters (no campaign): only the encounter's owner may.
export function requireCombatantController(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid combatant id" });
    return;
  }

  const combatant = getCombatantRow(id);
  if (!combatant) {
    res.status(404).json({ error: "Combatant not found" });
    return;
  }

  const encounter = getEncounterRow(combatant.encounterId);
  if (!encounter) {
    res.status(404).json({ error: "Encounter not found" });
    return;
  }

  const userId = req.session.userId!;

  if (encounter.campaignId === null) {
    if (encounter.ownerUserId !== userId) {
      res.status(403).json({ error: "Only the encounter's owner can do this" });
      return;
    }
  } else {
    const membership = getMembership(encounter.campaignId, userId);
    if (membership?.role !== "dm") {
      res.status(403).json({ error: "Only the DM can do this" });
      return;
    }
  }

  req.combatantCampaignId = encounter.campaignId;
  next();
}
