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

/** Detect image type from magic bytes; ignores client-declared MIME. */
export function detectImageMime(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 6) {
    const header = buffer.toString("ascii", 0, 6);
    if (header === "GIF87a" || header === "GIF89a") return "image/gif";
  }
  return null;
}

export function savePortrait(characterId: number, buffer: Buffer, _mimetype?: string): string {
  // Prefer magic-byte detection over the client-declared MIME type.
  const detected = detectImageMime(buffer);
  if (!detected) {
    throw new Error("Unsupported or invalid image file");
  }
  const ext = ALLOWED_PORTRAIT_MIME_TYPES[detected];

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
