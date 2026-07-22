import { Router } from "express";
import {
  createCustomContentSchema,
  updateCustomContentSchema,
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
import type { CustomContentType } from "shared";
import { requireAuth, requireGlobalRole, requireAdmin } from "../middleware/auth.js";
import { requireCustomContentOwnerOrAdmin } from "../middleware/customContent.js";
import {
  createCustomContent,
  getCustomContent,
  listVisibleCustomContent,
  listPendingCustomContent,
  updateCustomContent,
  approveCustomContent,
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

customContentRouter.get("/", (req, res) => {
  res.json({ items: listVisibleCustomContent(req.session.userId!) });
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
    req.session.userId!,
    parsed.data.type,
    parsed.data.system,
    parsed.data.name,
    dataParsed.data,
  );
  res.status(201).json({ item: getCustomContent(created.id) });
});

customContentRouter.patch("/:id", requireCustomContentOwnerOrAdmin, async (req, res) => {
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

customContentRouter.delete("/:id", requireCustomContentOwnerOrAdmin, async (req, res) => {
  await deleteCustomContent(req.customContentRow!.id);
  res.status(204).send();
});

customContentRouter.post("/:id/approve", requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const updated = await approveCustomContent(id, req.session.userId!);
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ item: getCustomContent(updated.id) });
});
