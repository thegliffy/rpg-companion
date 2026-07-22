import type { Request, Response, NextFunction } from "express";
import { getNoteRow } from "../services/notes.service.js";
import { getMembership } from "../services/campaigns.service.js";

declare global {
  namespace Express {
    interface Request {
      noteRow?: NonNullable<ReturnType<typeof getNoteRow>>;
    }
  }
}

export function requireNoteAuthorOrDM(req: Request, res: Response, next: NextFunction) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: "Invalid note id" });
    return;
  }

  const note = getNoteRow(id);
  if (!note) {
    res.status(404).json({ error: "Note not found" });
    return;
  }

  const userId = req.session.userId!;
  if (note.authorUserId === userId) {
    req.noteRow = note;
    next();
    return;
  }

  if (note.campaignId !== null) {
    const membership = getMembership(note.campaignId, userId);
    if (membership?.role === "dm") {
      req.noteRow = note;
      next();
      return;
    }
  }

  res.status(403).json({ error: "Only the note's author or the DM can do this" });
}
