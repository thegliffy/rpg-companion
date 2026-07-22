import { Router } from "express";
import { updateUserRoleSchema, resetUserPasswordSchema } from "shared";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { listUsers, updateUserRole, resetUserPassword, toPublicUser } from "../services/users.service.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/users", (_req, res) => {
  const users = listUsers().map(toPublicUser);
  res.json({ users });
});

adminRouter.patch("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const parsed = updateUserRoleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const updated = await updateUserRole(id, parsed.data.role);
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user: toPublicUser(updated) });
});

adminRouter.patch("/users/:id/password", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  const parsed = resetUserPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const updated = await resetUserPassword(id, parsed.data.password);
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ user: toPublicUser(updated) });
});
