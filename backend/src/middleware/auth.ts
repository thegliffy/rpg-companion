import type { Request, Response, NextFunction } from "express";
import type { GlobalRole } from "shared";
import { findUserById } from "../services/users.service.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireGlobalRole(...allowed: GlobalRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = findUserById(req.session.userId!);
    if (!user || !allowed.includes(user.role as GlobalRole)) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    next();
  };
}

export const requireAdmin = requireGlobalRole("admin");
