import type { Request, Response, NextFunction } from "express";
import { getCustomContentRow } from "../services/customContent.service.js";
import { isGlobalDmOrAdmin } from "../services/users.service.js";

declare global {
  namespace Express {
    interface Request {
      customContentRow?: NonNullable<ReturnType<typeof getCustomContentRow>>;
    }
  }
}

// The creating user can always manage their own item (pending or approved); any DM or admin
// can manage any item, not just their own -- DMs are already the only non-admin role that can
// create custom content at all, so this just extends that same trust to editing/deleting
// anyone's. Nobody else can. Approval/unapproval stays admin-only (see admin.routes.ts) --
// publishing something site-wide is a separate decision from fixing/removing an item.
export function requireCustomContentOwnerOrManager(req: Request, res: Response, next: NextFunction) {
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

  const userId = req.authUserId!;
  if (row.createdByUserId !== userId && !isGlobalDmOrAdmin(userId)) {
    res.status(403).json({ error: "Only the creator, a DM, or an admin can do this" });
    return;
  }

  req.customContentRow = row;
  next();
}
