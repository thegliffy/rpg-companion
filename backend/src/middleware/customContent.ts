import type { Request, Response, NextFunction } from "express";
import { getCustomContentRow } from "../services/customContent.service.js";
import { isGlobalAdmin } from "../services/users.service.js";

declare global {
  namespace Express {
    interface Request {
      customContentRow?: NonNullable<ReturnType<typeof getCustomContentRow>>;
    }
  }
}

// The creating DM can always manage their own item (pending or approved);
// an admin can manage any item. Nobody else can.
export function requireCustomContentOwnerOrAdmin(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const row = getCustomContentRow(id);
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const userId = req.session.userId!;
  if (row.createdByUserId !== userId && !isGlobalAdmin(userId)) {
    res.status(403).json({ error: "Only the creator or an admin can do this" });
    return;
  }

  req.customContentRow = row;
  next();
}
