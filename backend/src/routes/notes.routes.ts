import { Router } from "express";
import { createNoteSchema, updateNoteSchema } from "shared";
import { requireAuth } from "../middleware/auth.js";
import { requireNoteAuthorOrDM } from "../middleware/note.js";
import { createNote, updateNote, deleteNote, listPersonalNotes } from "../services/notes.service.js";
import { emitToCampaign } from "../sockets/index.js";

export const notesRouter = Router();

notesRouter.use(requireAuth);

notesRouter.get("/", (req, res) => {
  const notes = listPersonalNotes(req.session.userId!);
  res.json({ notes });
});

notesRouter.post("/", async (req, res) => {
  const parsed = createNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const note = await createNote(null, req.session.userId!, parsed.data.title, parsed.data.contentMd);
  res.status(201).json({ note });
});

notesRouter.patch("/:id", requireNoteAuthorOrDM, async (req, res) => {
  const parsed = updateNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
    return;
  }

  const note = await updateNote(req.noteRow!.id, parsed.data);
  if (req.noteRow!.campaignId !== null) {
    emitToCampaign(req.noteRow!.campaignId, "notes:changed", { noteId: note.id, action: "updated" });
  }
  res.json({ note });
});

notesRouter.delete("/:id", requireNoteAuthorOrDM, async (req, res) => {
  const { id, campaignId } = req.noteRow!;
  await deleteNote(id);
  if (campaignId !== null) {
    emitToCampaign(campaignId, "notes:changed", { noteId: id, action: "deleted" });
  }
  res.status(204).send();
});
