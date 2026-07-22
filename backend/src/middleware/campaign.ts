import type { Request, Response, NextFunction } from "express";
import { getMembership } from "../services/campaigns.service.js";
import { isGlobalAdmin } from "../services/users.service.js";

declare global {
  namespace Express {
    interface Request {
      campaignMembership?: { campaignId: number; role: "dm" | "player" };
    }
  }
}

function parseCampaignId(req: Request): number | null {
  const raw = req.params.id ?? req.params.campaignId;
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

export function requireCampaignMember(req: Request, res: Response, next: NextFunction) {
  const campaignId = parseCampaignId(req);
  if (campaignId === null) {
    res.status(400).json({ error: "Invalid campaign id" });
    return;
  }

  const membership = getMembership(campaignId, req.session.userId!);
  if (!membership) {
    // A global admin can act on any campaign as if they were its DM, even
    // without an actual membership row.
    if (isGlobalAdmin(req.session.userId!)) {
      req.campaignMembership = { campaignId, role: "dm" };
      next();
      return;
    }
    res.status(403).json({ error: "Not a member of this campaign" });
    return;
  }

  req.campaignMembership = { campaignId, role: membership.role as "dm" | "player" };
  next();
}

export function requireDM(req: Request, res: Response, next: NextFunction) {
  requireCampaignMember(req, res, () => {
    if (req.campaignMembership?.role !== "dm") {
      res.status(403).json({ error: "Only the DM can do this" });
      return;
    }
    next();
  });
}
