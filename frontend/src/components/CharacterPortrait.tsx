import { useRef, useState } from "react";
import type { Character } from "shared";
import * as charactersApi from "../api/characters";

export function CharacterPortrait({
  characterId,
  canEdit,
  size = 128,
  onSaved,
}: {
  characterId: number;
  canEdit: boolean;
  size?: number;
  // The upload bumps the character's updatedAt server-side; callers holding an
  // optimistic-concurrency token (e.g. the sheet's autosave) need the fresh value or every
  // later save 409s as "changed elsewhere".
  onSaved?: (character: Character) => void;
}) {
  const [version, setVersion] = useState(0);
  const [hasImage, setHasImage] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const character = await charactersApi.uploadPortrait(characterId, file);
      setHasImage(true);
      setVersion((v) => v + 1);
      onSaved?.(character);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const boxStyle: React.CSSProperties = {
    width: size,
    height: size,
    border: "1px solid var(--border-strong)",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    background: "var(--surface-sunken)",
    cursor: canEdit ? "pointer" : "default",
    flexShrink: 0,
  };

  return (
    <div>
      <div style={boxStyle} onClick={() => canEdit && fileInput.current?.click()} title={canEdit ? "Click to upload a portrait" : undefined}>
        {hasImage ? (
          <img
            src={charactersApi.portraitUrl(characterId, version)}
            alt="Character portrait"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setHasImage(false)}
          />
        ) : (
          <span style={{ fontSize: "0.8rem", color: "var(--text-dim)", textAlign: "center", padding: "0.5rem" }}>
            {canEdit ? "Click to upload portrait" : "No portrait"}
          </span>
        )}
      </div>
      {canEdit && (
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      )}
      {uploading && <small>Uploading…</small>}
      {error && <p style={{ color: "var(--danger)", fontSize: "0.8rem" }}>{error}</p>}
    </div>
  );
}
