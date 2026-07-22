import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Note, NotesChangedPayload, CampaignRole } from "shared";
import * as notesApi from "../api/notes";
import { useCampaignRoom, useSocketEvent } from "../socket/useSocketEvent";

function NoteForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Note;
  onSubmit: (title: string, contentMd: string) => Promise<void>;
  onCancel?: () => void;
}) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [contentMd, setContentMd] = useState(initial?.contentMd ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(title, contentMd);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ border: "1px solid #ccc", padding: "1rem" }}>
      <div>
        <input
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={{ width: "100%" }}
        />
      </div>
      <div>
        <textarea
          placeholder="Markdown content"
          value={contentMd}
          onChange={(e) => setContentMd(e.target.value)}
          rows={6}
          style={{ width: "100%" }}
        />
      </div>
      <button type="submit" disabled={submitting}>
        Save
      </button>
      {onCancel && (
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
}

export function NotesSection({
  campaignId,
  currentUserId,
  role,
}: {
  campaignId: number | null;
  currentUserId: number;
  role: CampaignRole | null;
}) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | "new" | null>(null);
  const isPersonal = campaignId === null;

  const refresh = useCallback(() => {
    notesApi
      .listNotes(campaignId)
      .then(setNotes)
      .catch((err) => setError(err.message));
  }, [campaignId]);

  useEffect(refresh, [refresh]);

  useCampaignRoom(campaignId);
  useSocketEvent<NotesChangedPayload>("notes:changed", refresh, !isPersonal);

  function canEdit(note: Note) {
    return role === "dm" || note.authorUserId === currentUserId;
  }

  async function handleCreate(title: string, contentMd: string) {
    await notesApi.createNote(campaignId, title, contentMd);
    setEditingId(null);
    if (isPersonal) refresh();
  }

  async function handleUpdate(id: number, title: string, contentMd: string) {
    await notesApi.updateNote(id, { title, contentMd });
    setEditingId(null);
    if (isPersonal) refresh();
  }

  async function handleDelete(id: number) {
    await notesApi.deleteNote(id);
    if (isPersonal) refresh();
  }

  return (
    <div>
      <h2>{isPersonal ? "My notes" : "Notes"}</h2>
      {error && <p style={{ color: "crimson" }}>{error}</p>}

      {notes.map((n) =>
        editingId === n.id ? (
          <NoteForm
            key={n.id}
            initial={n}
            onSubmit={(title, contentMd) => handleUpdate(n.id, title, contentMd)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div key={n.id} style={{ border: "1px solid #ddd", padding: "1rem", marginBottom: "0.5rem" }}>
            <h3>{n.title}</h3>
            <ReactMarkdown>{n.contentMd}</ReactMarkdown>
            <small>
              by {n.authorUsername} &middot; updated {new Date(n.updatedAt).toLocaleString()}
            </small>
            {canEdit(n) && (
              <div>
                <button onClick={() => setEditingId(n.id)}>Edit</button>
                <button onClick={() => handleDelete(n.id)}>Delete</button>
              </div>
            )}
          </div>
        ),
      )}

      {editingId === "new" ? (
        <NoteForm onSubmit={handleCreate} onCancel={() => setEditingId(null)} />
      ) : (
        <button onClick={() => setEditingId("new")}>New note</button>
      )}
    </div>
  );
}
