import fs from "node:fs";
import path from "node:path";

const PORTRAITS_DIR = path.join(path.dirname(process.env.DATABASE_PATH ?? "../data/app.db"), "portraits");

export const ALLOWED_PORTRAIT_MIME_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const MAX_PORTRAIT_BYTES = 5 * 1024 * 1024;

function ensureDir() {
  fs.mkdirSync(PORTRAITS_DIR, { recursive: true });
}

export function savePortrait(characterId: number, buffer: Buffer, mimetype: string): string {
  const ext = ALLOWED_PORTRAIT_MIME_TYPES[mimetype];
  if (!ext) {
    throw new Error(`Unsupported image type: ${mimetype}`);
  }

  ensureDir();
  removePortraitFile(characterId);

  const filename = `${characterId}.${ext}`;
  fs.writeFileSync(path.join(PORTRAITS_DIR, filename), buffer);
  return filename;
}

export function removePortraitFile(characterId: number) {
  for (const ext of Object.values(ALLOWED_PORTRAIT_MIME_TYPES)) {
    const p = path.join(PORTRAITS_DIR, `${characterId}.${ext}`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
}

export function portraitFilePath(filename: string): string {
  return path.join(PORTRAITS_DIR, filename);
}

export function mimeTypeForFilename(filename: string): string {
  const ext = filename.split(".").pop();
  const found = Object.entries(ALLOWED_PORTRAIT_MIME_TYPES).find(([, e]) => e === ext);
  return found ? found[0] : "application/octet-stream";
}
