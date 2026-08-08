import { Router } from "express";
import {
  createCustomContentSchema,
  updateCustomContentSchema,
  importCustomContentSchema,
  customRaceDataSchema,
  customClassDataSchema,
  customBackgroundDataSchema,
  customSubraceDataSchema,
  customSubclassDataSchema,
  customFeatDataSchema,
  customSpellDataSchema,
  customItemDataSchema,
  customMonsterDataSchema,
  CUSTOM_CONTENT_TYPES_BY_SYSTEM,
} from "shared";
import type { CustomContentType, ImportCustomContentResult } from "shared";
import { requireAuth, requireGlobalRole, requireAdmin } from "../middleware/auth.js";
import { requireCustomContentOwnerOrManager } from "../middleware/customContent.js";
import {
  createCustomContent,
  getCustomContent,
  listVisibleCustomContent,
  listPendingCustomContent,
  listAllCustomContent,
  updateCustomContent,
  approveCustomContent,
  unapproveCustomContent,
  deleteCustomContent,
} from "../services/customContent.service.js";

export const customContentRouter = Router();

customContentRouter.use(requireAuth);

function dataSchemaFor(type: CustomContentType) {
  switch (type) {
    case "race":
      return customRaceDataSchema;
    case "class":
      return customClassDataSchema;
    case "background":
      return customBackgroundDataSchema;
    case "subrace":
      return customSubraceDataSchema;
    case "subclass":
      return customSubclassDataSchema;
    case "feat":
      return customFeatDataSchema;
    case "spell":
      return customSpellDataSchema;
    case "item":
      return customItemDataSchema;
    case "monster":
      return customMonsterDataSchema;
  }
}

// Static routes first, before the /:id param routes.
customContentRouter.get("/pending", requireAdmin, (_req, res) => {
  res.json({ items: listPendingCustomContent() });
});

// Site-wide, every item regardless of status or owner (moved from /api/admin/content) -- DM or
// admin, matching requireCustomContentOwnerOrManager's "any DM/admin can manage any item" below.
customContentRouter.get("/all", requireGlobalRole("dm", "admin"), (_req, res) => {
  res.json({ items: listAllCustomContent() });
});

customContentRouter.get("/", (req, res) => {
  res.json({ items: listVisibleCustomContent(req.authUserId!) });
});

customContentRouter.post("/", requireGlobalRole("dm", "admin"), async (req, res) => {
  const parsed = createCustomContentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  if (!CUSTOM_CONTENT_TYPES_BY_SYSTEM[parsed.data.system].includes(parsed.data.type)) {
    res.status(400).json({ error: `"${parsed.data.type}" is not a valid custom-content type for ${parsed.data.system}` });
    return;
  }

  const dataParsed = dataSchemaFor(parsed.data.type).safeParse(parsed.data.data);
  if (!dataParsed.success) {
    res.status(400).json({ error: "Invalid data", issues: dataParsed.error.issues });
    return;
  }

  const created = await createCustomContent(
    req.authUserId!,
    parsed.data.type,
    parsed.data.system,
    parsed.data.name,
    dataParsed.data,
  );
  res.status(201).json({ item: getCustomContent(created.id) });
});

// Bulk upload (#123) -- static route, must stay above the /:id routes below.
customContentRouter.post("/import", requireGlobalRole("dm", "admin"), async (req, res) => {
  const parsed = importCustomContentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }
  const { system, items } = parsed.data;
  const userId = req.authUserId!;

  // Dedup scope is deliberately "this user's own items in this system" only -- an import
  // updating someone else's content (even an admin's) would need its own authorization story,
  // so a name collision with another user's item just creates a second, separate row rather
  // than silently overwriting content the importer doesn't own.
  const ownItems = listVisibleCustomContent(userId).filter(
    (i) => i.createdByUserId === userId && i.system === system,
  );

  const results: ImportCustomContentResult[] = [];
  for (let index = 0; index < items.length; index++) {
    const row = items[index];
    if (!CUSTOM_CONTENT_TYPES_BY_SYSTEM[system].includes(row.type)) {
      results.push({
        index,
        name: row.name,
        type: row.type,
        status: "error",
        error: `"${row.type}" is not a valid custom-content type for ${system}`,
      });
      continue;
    }

    const dataParsed = dataSchemaFor(row.type).safeParse(row.data);
    if (!dataParsed.success) {
      results.push({
        index,
        name: row.name,
        type: row.type,
        status: "error",
        error: "Invalid data",
        issues: dataParsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      });
      continue;
    }

    // Case-insensitive (type, name) match against the importer's own items -- re-uploading a
    // corrected pack updates existing rows instead of duplicating them.
    const existing = ownItems.find(
      (i) => i.type === row.type && i.name.trim().toLowerCase() === row.name.trim().toLowerCase(),
    );
    if (existing) {
      await updateCustomContent(existing.id, { name: row.name.trim(), data: dataParsed.data });
      results.push({ index, name: row.name, type: row.type, status: "updated", id: existing.id });
    } else {
      const created = await createCustomContent(userId, row.type, system, row.name.trim(), dataParsed.data);
      results.push({ index, name: row.name, type: row.type, status: "created", id: created.id });
      // So a later row in the *same* pack with the same (type, name) updates this one instead
      // of creating a second duplicate within one import.
      ownItems.push({
        id: created.id,
        type: row.type,
        system,
        createdByUserId: userId,
        createdByUsername: "",
        name: row.name.trim(),
        data: dataParsed.data,
        status: "pending",
        approvedByUserId: null,
        approvedAt: null,
        createdAt: "",
      });
    }
  }

  res.json({ results });
});

// Single-item fetch with the full `data` payload (#134) -- same owner-or-manager gate as
// PATCH/DELETE below, since a pending item that's neither the requester's own nor approved
// shouldn't be fetchable just by guessing an id. Needed so a DM/admin can open the full editor
// for an item that only shows up in their site-wide summary list (GET /all above), not the
// approved-plus-own-pending set GET / already returns.
customContentRouter.get("/:id", requireCustomContentOwnerOrManager, (req, res) => {
  res.json({ item: getCustomContent(req.customContentRow!.id) });
});

customContentRouter.patch("/:id", requireCustomContentOwnerOrManager, async (req, res) => {
  const parsed = updateCustomContentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const updates: { name?: string; data?: unknown } = { name: parsed.data.name };
  if (parsed.data.data !== undefined) {
    const dataParsed = dataSchemaFor(req.customContentRow!.type as CustomContentType).safeParse(parsed.data.data);
    if (!dataParsed.success) {
      res.status(400).json({ error: "Invalid data", issues: dataParsed.error.issues });
      return;
    }
    updates.data = dataParsed.data;
  }

  const updated = await updateCustomContent(req.customContentRow!.id, updates);
  res.json({ item: getCustomContent(updated.id) });
});

customContentRouter.delete("/:id", requireCustomContentOwnerOrManager, async (req, res) => {
  await deleteCustomContent(req.customContentRow!.id);
  res.status(204).send();
});

customContentRouter.post("/:id/approve", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const updated = await approveCustomContent(id, req.authUserId!);
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ item: getCustomContent(updated.id) });
});

// Reverses approve (#131) -- e.g. an item shouldn't have been published yet. The frontend is
// responsible for warning that anything already resolving custom-${id} against this item (a
// spell's srdId, a background's grantedFeats, a race trait's grantedSpells) stops resolving for
// everyone but the author the moment it leaves "approved".
customContentRouter.post("/:id/unapprove", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const updated = await unapproveCustomContent(id);
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ item: getCustomContent(updated.id) });
});
