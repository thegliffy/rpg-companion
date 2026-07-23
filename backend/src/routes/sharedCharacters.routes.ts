import { Router } from "express";
import fs from "node:fs";
import type { Dnd5eSheetData } from "shared";
import { getCharacterByShareToken, getCharacterRowByShareToken } from "../services/characters.service.js";
import { portraitFilePath, mimeTypeForFilename } from "../lib/portraits.js";

// Public, read-only, unauthenticated router for per-character share links (item 77). Deliberately
// NOT mounted behind requireAuth and deliberately exposes only GET handlers -- a share token is a
// lookup key, never an auth credential, and grants zero write capability. Every mutation endpoint
// (character PATCH/DELETE, rolls, notes, portrait upload, share mint/revoke, everything) stays on
// the authed routers behind requireAuth + requireCharacterOwnerOrDM; an anonymous request to any
// of those 401s regardless of whether the attacker knows the token. See characters.routes.ts for
// the owner/DM-only mint/revoke endpoints that manage the token this router reads.
export const sharedCharactersRouter = Router();

/** Anonymous viewers never see the owner's private notes or the freeform owner notes field --
 * unlike redactPrivateNotesIfNotOwner (characters.routes.ts) there's no "is this the owner"
 * check to make since there's no authenticated requester at all. */
function redactForPublicView<T extends { system: string; sheetData: unknown; notes: string | null }>(character: T): T {
  const redacted = { ...character, notes: null };
  if (redacted.system === "dnd5e") {
    redacted.sheetData = { ...(redacted.sheetData as Dnd5eSheetData), privateNotes: "" };
  }
  return redacted;
}

sharedCharactersRouter.get("/:token/portrait", (req, res) => {
  const row = getCharacterRowByShareToken(req.params.token);
  if (!row || !row.portraitFilename) {
    res.status(404).json({ error: "No portrait set" });
    return;
  }

  const filePath = portraitFilePath(row.portraitFilename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "No portrait set" });
    return;
  }

  res.setHeader("Content-Type", mimeTypeForFilename(row.portraitFilename));
  res.setHeader("Cache-Control", "private, max-age=60");
  fs.createReadStream(filePath).pipe(res);
});

sharedCharactersRouter.get("/:token", (req, res) => {
  const character = getCharacterByShareToken(req.params.token);
  if (!character) {
    res.status(404).json({ error: "This share link is invalid or has been revoked" });
    return;
  }
  res.json({ character: redactForPublicView(character) });
});
