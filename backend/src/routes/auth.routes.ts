import { Router } from "express";
import { registerSchema, loginSchema } from "shared";
import {
  createUser,
  findUserByUsername,
  findUserById,
  verifyPassword,
  toPublicUser,
  UsernameTakenError,
} from "../services/users.service.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
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

authRouter.post("/login", async (req, res) => {
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
