import type { Request, Response, NextFunction } from "express";
import type { GlobalRole } from "shared";
import { findUserById } from "../services/users.service.js";
import { resolveApiToken } from "../services/apiTokens.service.js";

declare global {
  namespace Express {
    interface Request {
      /** Who this request is acting as, from either a session cookie or a bearer token (#147).
       * The single source of caller identity -- routes read this, never `req.session.userId`,
       * so a token-authenticated request works everywhere a browser one does. */
      authUserId?: number;
      /** True when identity came from an API token rather than a session cookie. Only the token
       * routes care: a token must not be able to mint or list its own successors (#148). */
      isTokenAuth?: boolean;
    }
  }
}

/** Populates req.authUserId from an `Authorization: Bearer rpgc_...` header when present, falling
 * back to the session cookie. Mounted app-wide before the routers.
 *
 * Deliberately does NOT write `req.session.userId` for token requests: mutating the session marks
 * it dirty, and express-session would then persist it -- every scripted API call would write a junk
 * row into the same `sessions` table real logins use, forever.
 *
 * No rate limiting here (unlike login, which has IP and per-user limits): brute-forcing 256 bits of
 * entropy isn't a threat model, so a limiter could only ever throttle a legitimate script. */
export function resolveAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.get("authorization");
  if (header?.startsWith("Bearer ")) {
    const userId = resolveApiToken(header.slice("Bearer ".length).trim());
    if (userId !== null) {
      req.authUserId = userId;
      req.isTokenAuth = true;
      next();
      return;
    }
    // An invalid/expired bearer token falls through to the session rather than 401-ing outright, so
    // a stale header can't lock a legitimately-logged-in browser out of its own session.
  }

  req.authUserId = req.session.userId;
  req.isTokenAuth = false;
  next();
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  // resolveAuth always sets isTokenAuth to a boolean, so `undefined` means it never ran -- an app
  // was assembled without it. Without this check that misconfiguration would silently 401 every
  // authenticated route, which reads as "wrong password" rather than "wrong wiring" and is
  // miserable to diagnose. Fail loudly instead.
  if (req.isTokenAuth === undefined) {
    throw new Error("resolveAuth middleware is not mounted -- every authenticated route would 401");
  }
  if (!req.authUserId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  next();
}

export function requireGlobalRole(...allowed: GlobalRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = findUserById(req.authUserId!);
    if (!user || !allowed.includes(user.role as GlobalRole)) {
      res.status(403).json({ error: "Not authorized" });
      return;
    }
    next();
  };
}

export const requireAdmin = requireGlobalRole("admin");

/** Rejects token-authenticated requests (#148). Used only on the token routes themselves: tokens
 * inherit their owner's role everywhere else, but a leaked token must not be able to quietly issue
 * itself successors or enumerate the owner's other tokens -- that's what keeps revocation
 * meaningful. */
export function requireSessionAuth(req: Request, res: Response, next: NextFunction) {
  if (req.isTokenAuth) {
    res.status(403).json({ error: "API tokens can't manage API tokens -- sign in to do this" });
    return;
  }
  next();
}
