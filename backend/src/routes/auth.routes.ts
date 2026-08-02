import { Router } from "express";
import { registerSchema, loginSchema, updatePreferencesSchema } from "shared";
import {
  createUser,
  findUserByUsername,
  findUserById,
  verifyPassword,
  toPublicUser,
  updateUserTheme,
  UsernameTakenError,
} from "../services/users.service.js";
import { rateLimit } from "../middleware/rateLimit.js";
import { requireAuth } from "../middleware/auth.js";

export const authRouter = Router();

const registerLimit = rateLimit({
  name: "register",
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many registration attempts, try again later",
});

const loginIpLimit = rateLimit({
  name: "login-ip",
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many login attempts, try again later",
});

// Keyed on (username, requester IP) rather than username alone: an unauthenticated attacker
// could otherwise lock any named user out for the whole window by sending a handful of wrong
// passwords from anywhere -- scoping to the attacker's own IP means the real user, logging in
// from their own IP, is unaffected. Username is compared exactly as typed (no case-folding),
// matching findUserByUsername's case-sensitive lookup -- lowercasing here would let one bucket
// throttle multiple distinct case-variant accounts ("Alice" vs "alice").
const loginUserLimit = rateLimit({
  name: "login-user",
  windowMs: 15 * 60 * 1000,
  max: 10,
  key: (req) => {
    const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
    return `login-user:${username || "unknown"}:${req.ip ?? "unknown"}`;
  },
  message: "Too many login attempts for this username, try again later",
});

authRouter.post("/register", registerLimit, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  try {
    const user = await createUser(parsed.data.username, parsed.data.password);
    req.session.userId = user.id;
    res.status(201).json({ user: toPublicUser(user) });
  } catch (err) {
    if (err instanceof UsernameTakenError) {
      res.status(409).json({ error: err.message });
      return;
    }
    throw err;
  }
});

authRouter.post("/login", loginIpLimit, loginUserLimit, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const user = findUserByUsername(parsed.data.username);
  if (!user || !(await verifyPassword(user, parsed.data.password))) {
    res.status(401).json({ error: "Invalid username or password" });
    return;
  }

  req.session.userId = user.id;
  res.json({ user: toPublicUser(user) });
});

authRouter.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Failed to log out" });
      return;
    }
    res.clearCookie("connect.sid");
    res.status(204).send();
  });
});

authRouter.get("/session", (req, res) => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const user = findUserById(req.session.userId);
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  res.json({ user: toPublicUser(user) });
});

// The app's first user preference (#154). Shaped as "preferences" rather than "set theme" so the
// next one extends this route instead of adding a second. Token-authenticated callers are allowed:
// unlike the token routes themselves, changing your own theme is harmless and inherits normally.
authRouter.patch("/preferences", requireAuth, async (req, res) => {
  const parsed = updatePreferencesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  if (parsed.data.theme === undefined) {
    res.json({ user: toPublicUser(findUserById(req.authUserId!)!) });
    return;
  }

  const updated = await updateUserTheme(req.authUserId!, parsed.data.theme);
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user: toPublicUser(updated) });
});
