import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { appSettings } from "../db/schema.js";

// Admin-configurable settings, stored in the app_settings key/value table. Env vars are the
// fallback when a key has never been saved, so a fresh deploy behaves exactly as before.
// Only the keys listed here can be read/written through the API (no arbitrary-key writes).

export interface AiSettings {
  llmUrl: string;
  llmModel: string;
  comfyUrl: string;
  comfyCheckpoint: string;
}

const DEFAULTS: AiSettings = {
  llmUrl: process.env.AI_LLM_URL ?? "http://10.0.0.10:18280/v1",
  llmModel: process.env.AI_LLM_MODEL ?? "orcarouter-qwen3.8-flash-next-uncensored-iq4_xs",
  comfyUrl: process.env.AI_COMFY_URL ?? "http://10.1.202.26:8188",
  comfyCheckpoint: process.env.AI_COMFY_CHECKPOINT ?? "juggernautXL_version4NSFW.safetensors",
};

const KEY_MAP: Record<keyof AiSettings, string> = {
  llmUrl: "ai_llm_url",
  llmModel: "ai_llm_model",
  comfyUrl: "ai_comfy_url",
  comfyCheckpoint: "ai_comfy_checkpoint",
};

export function getAiSettings(): AiSettings {
  const rows = db.select().from(appSettings).all();
  const byKey = new Map(rows.map((r) => [r.key, r.value]));
  const out = { ...DEFAULTS };
  for (const [field, key] of Object.entries(KEY_MAP) as [keyof AiSettings, string][]) {
    const v = byKey.get(key);
    if (v !== undefined && v !== "") out[field] = v;
  }
  return out;
}

export async function setAiSettings(partial: Partial<AiSettings>): Promise<AiSettings> {
  for (const field of Object.keys(partial) as (keyof AiSettings)[]) {
    const key = KEY_MAP[field];
    const value = partial[field]!;
    await db
      .insert(appSettings)
      .values({ key, value, updatedAt: new Date().toISOString() })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date().toISOString() } });
  }
  return getAiSettings();
}
