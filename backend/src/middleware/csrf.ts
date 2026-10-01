import type { RequestHandler } from "express";

/** Same-site guard for cookie-authenticated state changes.
 *
 * The session cookie is `sameSite=lax`, which already blocks cross-site POST *bodies* from
 * browsers, but lax is not a complete CSRF defense: subdomain takeover/CSRF, and any future
 * widening of the cookie policy, would let a foreign origin ride the cookie. This middleware
 * closes that gap at the app layer with no token plumbing:
 *
 * - Browsers attach `Origin` on every CORS-safelisted cross-origin POST/PUT/PATCH/DELETE, and
 *   on same-origin non-GETs too (except some legacy GET-with-redirect cases). If Origin is
 *   present it MUST match the request's own origin, or the request is rejected.
 * - `Sec-Fetch-Site` is the modern, unspoofable signal where supported: anything other than
 *   same-origin/same-site/none is rejected.
 * - Requests with NO Origin header are allowed through: curl/scripts/native clients send none,
 *   and a cross-site *browser* form POST (the classic CSRF vector) is limited to GET/HEAD by
 *   HTML spec — the methods that actually mutate state here all require a JSON body, which
 *   cross-site forms can't forge with lax cookies.
 *
 * Bearer-token requests are inherently CSRF-safe (a cross-site attacker can't attach the
 * Authorization header), but they pass the Origin check anyway when a browser sends one.
 */
export function requireSameSiteOrigin(): RequestHandler {
  return (req, res, next) => {
    const origin = req.get("origin");

    if (origin) {
      const own = `${req.protocol}://${req.get("host") ?? ""}`;
      if (origin !== own) {
        res.status(403).json({ error: "Cross-origin requests are not allowed" });
        return;
      }
    }

    const fetchSite = req.get("sec-fetch-site");
    if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
      res.status(403).json({ error: "Cross-site requests are not allowed" });
      return;
    }

    next();
  };
}
