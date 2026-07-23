import { Router } from "express";
import multer from "multer";
import fs from "node:fs";
import { createCharacterSchema, updateCharacterSchema, attachCharacterSchema, SYSTEMS, conditionTags } from "shared";
import type { Dnd5eSheetData } from "shared";
import { requireAuth } from "../middleware/auth.js";
import {
  requireCharacterOwnerOrDM,
  requireCharacterOwner,
  requireCharacterViewable,
} from "../middleware/character.js";
import {
  getCharacter,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  listCharactersForOwner,
  setCharacterCampaign,
  setCharacterPortrait,
  mintShareToken,
  revokeShareToken,
  getShareToken,
} from "../services/characters.service.js";
import { getMembership } from "../services/campaigns.service.js";
import { isGlobalAdmin } from "../services/users.service.js";
import { findActiveCombatantForCharacter, syncCombatantConditions } from "../services/encounters.service.js";
import { emitToCampaign } from "../sockets/index.js";
import {
  ALLOWED_PORTRAIT_MIME_TYPES,
  MAX_PORTRAIT_BYTES,
  savePortrait,
  portraitFilePath,
  mimeTypeForFilename,
} from "../lib/portraits.js";

const portraitUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PORTRAIT_BYTES },
  fileFilter: (_req, file, cb) => {
    cb(null, Object.prototype.hasOwnProperty.call(ALLOWED_PORTRAIT_MIME_TYPES, file.mimetype));
  },
});

// The DM (not the owner) never sees the owner's private notes — but a global
// admin is a deliberate exception to that, per "admin sees everything".
function redactPrivateNotesIfNotOwner<T extends { system: string; ownerUserId: number; sheetData: unknown }>(
  character: T,
  requesterId: number,
): T {
  if (character.system === "dnd5e" && character.ownerUserId !== requesterId && !isGlobalAdmin(requesterId)) {
    return { ...character, sheetData: { ...(character.sheetData as Dnd5eSheetData), privateNotes: "" } };
  }
  return character;
}

export const charactersRouter = Router();

charactersRouter.use(requireAuth);

charactersRouter.get("/", (req, res) => {
  const characters = listCharactersForOwner(req.session.userId!);
  res.json({ characters });
});

charactersRouter.post("/", async (req, res) => {
  const parsed = createCharacterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const campaignId = parsed.data.campaignId ?? null;
  if (campaignId !== null && !getMembership(campaignId, req.session.userId!)) {
    res.status(403).json({ error: "Not a member of that campaign" });
    return;
  }

  const systemDef = SYSTEMS[parsed.data.system];
  const sheetParsed = systemDef.schema.safeParse(parsed.data.sheetData ?? systemDef.emptySheet());
  if (!sheetParsed.success) {
    res.status(400).json({ error: `Invalid ${systemDef.name} sheet data`, issues: sheetParsed.error.issues });
    return;
  }

  const character = await createCharacter(req.session.userId!, {
    ...parsed.data,
    sheetData: sheetParsed.data,
  });
  res.status(201).json({ character });
});

charactersRouter.get("/:id", requireCharacterOwnerOrDM, (req, res) => {
  const character = getCharacter(req.characterRow!.id);
  if (!character) {
    res.status(404).json({ error: "Character not found" });
    return;
  }
  res.json({ character: redactPrivateNotesIfNotOwner(character, req.session.userId!) });
});

charactersRouter.patch("/:id", requireCharacterOwnerOrDM, async (req, res) => {
  const parsed = updateCharacterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const updates: typeof parsed.data = { ...parsed.data };
  const isOwnerRequester = req.characterRow!.ownerUserId === req.session.userId!;

  // Once created, the owner can no longer rename their character or change class/background
  // (identity-defining fields) -- a DM or admin reaching this route as a non-owner can, since
  // requireCharacterOwnerOrDM already gates that. Silently restore rather than reject.
  if (isOwnerRequester && updates.name !== undefined) {
    updates.name = req.characterRow!.name;
  }

  if (updates.sheetData !== undefined) {
    // system is immutable; validate against the stored character's system
    const systemDef = SYSTEMS[req.characterRow!.system as keyof typeof SYSTEMS] ?? SYSTEMS.generic;
    const sheetParsed = systemDef.schema.safeParse(updates.sheetData);
    if (!sheetParsed.success) {
      res.status(400).json({ error: `Invalid ${systemDef.name} sheet data`, issues: sheetParsed.error.issues });
      return;
    }
    updates.sheetData = sheetParsed.data;

    if (req.characterRow!.system === "dnd5e") {
      const existing = JSON.parse(req.characterRow!.sheetData) as Dnd5eSheetData;

      // The DM (not the owner) can edit the rest of the sheet but can never
      // change the owner's private notes — silently restore the stored value.
      // A global admin is exempt from this, same as the view-side redaction.
      if (req.characterRow!.ownerUserId !== req.session.userId! && !isGlobalAdmin(req.session.userId!)) {
        (updates.sheetData as Dnd5eSheetData).privateNotes = existing.privateNotes ?? "";
      }

      // The owner can no longer change class/background once created — same
      // revert-not-reject as the name field above.
      if (isOwnerRequester) {
        (updates.sheetData as Dnd5eSheetData).class = existing.class;
        (updates.sheetData as Dnd5eSheetData).background = existing.background;
      }
    }
  }

  const character = await updateCharacter(req.characterRow!.id, updates);

  // One-way sync: if this 5e character is currently a combatant in its
  // campaign's active encounter, push its condition tags onto that combatant.
  if (character.system === "dnd5e" && character.campaignId !== null && updates.sheetData !== undefined) {
    const combatant = findActiveCombatantForCharacter(character.campaignId, character.id);
    if (combatant) {
      const encounter = await syncCombatantConditions(combatant.id, conditionTags(character.sheetData as Dnd5eSheetData));
      emitToCampaign(character.campaignId, "initiative:updated", encounter);
    }
  }

  res.json({ character: redactPrivateNotesIfNotOwner(character, req.session.userId!) });
});

charactersRouter.delete("/:id", requireCharacterOwnerOrDM, async (req, res) => {
  await deleteCharacter(req.characterRow!.id);
  res.status(204).send();
});

charactersRouter.post("/:id/attach", requireCharacterOwner, async (req, res) => {
  const parsed = attachCharacterSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  if (!getMembership(parsed.data.campaignId, req.session.userId!)) {
    res.status(403).json({ error: "Not a member of that campaign" });
    return;
  }

  const character = await setCharacterCampaign(req.characterRow!.id, parsed.data.campaignId);
  res.json({ character });
});

// Owner can detach their character; the DM of the attached campaign can also
// detach it (remove it from their game) via owner-or-DM.
charactersRouter.post("/:id/detach", requireCharacterOwnerOrDM, async (req, res) => {
  const character = await setCharacterCampaign(req.characterRow!.id, null);
  res.json({ character });
});

charactersRouter.post(
  "/:id/portrait",
  requireCharacterOwnerOrDM,
  (req, res, next) => {
    portraitUpload.single("portrait")(req, res, (err) => {
      if (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : "Invalid image upload" });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    if (!req.file) {
      res.status(400).json({ error: "No image uploaded, or unsupported image type (jpeg/png/webp/gif only)" });
      return;
    }

    const filename = savePortrait(req.characterRow!.id, req.file.buffer, req.file.mimetype);
    await setCharacterPortrait(req.characterRow!.id, filename);
    res.status(201).json({ ok: true });
  },
);

// Share-link management -- owner/DM only. Minting/revoking never touches the public router;
// it only flips the shareToken column that the public router reads.
charactersRouter.post("/:id/share", requireCharacterOwnerOrDM, async (req, res) => {
  const token = await mintShareToken(req.characterRow!.id);
  res.json({ shareToken: token });
});

charactersRouter.get("/:id/share", requireCharacterOwnerOrDM, (req, res) => {
  res.json({ shareToken: getShareToken(req.characterRow!.id) });
});

charactersRouter.delete("/:id/share", requireCharacterOwnerOrDM, async (req, res) => {
  await revokeShareToken(req.characterRow!.id);
  res.status(204).send();
});

charactersRouter.get("/:id/portrait", requireCharacterViewable, (req, res) => {
  const filename = req.characterRow!.portraitFilename;
  if (!filename) {
    res.status(404).json({ error: "No portrait set" });
    return;
  }

  const filePath = portraitFilePath(filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "No portrait set" });
    return;
  }

  res.setHeader("Content-Type", mimeTypeForFilename(filename));
  res.setHeader("Cache-Control", "private, max-age=60");
  fs.createReadStream(filePath).pipe(res);
});
