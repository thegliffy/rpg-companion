import { Router } from "express";
import { updateUserRoleSchema, resetUserPasswordSchema, reassignCharacterOwnerSchema } from "shared";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import {
  listUsers,
  updateUserRole,
  resetUserPassword,
  toPublicUser,
  findUserById,
  countUserDependants,
  hasAnyDependants,
  countAdmins,
  deleteUser,
} from "../services/users.service.js";
import { listAllCustomContent } from "../services/customContent.service.js";
import { listAllCharacters, reassignCharacterOwner } from "../services/characters.service.js";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);

adminRouter.get("/users", (_req, res) => {
  const users = listUsers().map(toPublicUser);
  res.json({ users });
});

adminRouter.get("/content", (_req, res) => {
  res.json({ items: listAllCustomContent() });
});

adminRouter.get("/characters", (_req, res) => {
  res.json({ characters: listAllCharacters() });
});

adminRouter.patch("/characters/:id/owner", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid character id" });
    return;
  }

  const parsed = reassignCharacterOwnerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  if (!findUserById(parsed.data.ownerUserId)) {
    res.status(400).json({ error: "Target user not found" });
    return;
  }

  const updated = await reassignCharacterOwner(id, parsed.data.ownerUserId);
  if (!updated) {
    res.status(404).json({ error: "Character not found" });
    return;
  }
  res.json({ character: updated });
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

// Blocked, not cascading (#135): a bare delete would fail at the DB with an opaque FK constraint
// error (7 of 9 FKs to users.id are NOT NULL, foreign_keys=ON -- api_tokens joined the list in
// #146) or, worse, silently orphan data if that pragma were ever off. Reassigning or deleting
// dependants is a decision the admin makes deliberately -- see #133 for characters, and
// CustomContentManager for content.
adminRouter.delete("/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid user id" });
    return;
  }

  if (id === req.authUserId) {
    res.status(400).json({ error: "You can't delete your own account" });
    return;
  }

  const target = findUserById(id);
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (target.role === "admin" && countAdmins() <= 1) {
    res.status(400).json({ error: "Can't delete the last remaining admin" });
    return;
  }

  const dependants = countUserDependants(id);
  if (hasAnyDependants(dependants)) {
    res.status(409).json({ error: "This user still owns data -- reassign or delete it first", dependants });
    return;
  }

  await deleteUser(id);
  res.status(204).send();
});
