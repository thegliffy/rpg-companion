import type { Request, Response, NextFunction } from "express";
import { getCharacterRow } from "../services/characters.service.js";
import { getMembership } from "../services/campaigns.service.js";
import { isGlobalAdmin } from "../services/users.service.js";

declare global {
  namespace Express {
    interface Request {
      characterRow?: NonNullable<ReturnType<typeof getCharacterRow>>;
    }
  }
}

function loadCharacterOr404(req: Request, res: Response): boolean {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid character id" });
    return false;
  }

  const character = getCharacterRow(id);
  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return false;
  }

  req.characterRow = character;
  return true;
}

// Owner can always act on their character. The DM of a campaign can act on
// characters only while they are attached to that campaign.
export function requireCharacterOwnerOrDM(req: Request, res: Response, next: NextFunction) {
  if (!loadCharacterOr404(req, res)) return;

  const userId = req.session.userId!;
  if (req.characterRow!.ownerUserId === userId) {
    next();
    return;
  }

  if (req.characterRow!.campaignId !== null) {
    const membership = getMembership(req.characterRow!.campaignId, userId);
    if (membership?.role === "dm") {
      next();
      return;
    }
  }

  // A global admin can act on any character, owned or attached anywhere.
  if (isGlobalAdmin(userId)) {
    next();
    return;
  }

  res.status(403).json({ error: "Only the character's owner or the DM can do this" });
}

export function requireCharacterOwner(req: Request, res: Response, next: NextFunction) {
  if (!loadCharacterOr404(req, res)) return;

  if (req.characterRow!.ownerUserId !== req.session.userId! && !isGlobalAdmin(req.session.userId!)) {
    res.status(403).json({ error: "Only the character's owner can do this" });
    return;
  }
  next();
}

// Matches the visibility of the campaign character list: the owner, or (if
// attached) any member of that campaign — not just the DM.
export function requireCharacterViewable(req: Request, res: Response, next: NextFunction) {
  if (!loadCharacterOr404(req, res)) return;

  const userId = req.session.userId!;
  if (req.characterRow!.ownerUserId === userId) {
    next();
    return;
  }

  if (req.characterRow!.campaignId !== null && getMembership(req.characterRow!.campaignId, userId)) {
    next();
    return;
  }

  if (isGlobalAdmin(userId)) {
    next();
    return;
  }

  res.status(403).json({ error: "Not authorized to view this character" });
}
