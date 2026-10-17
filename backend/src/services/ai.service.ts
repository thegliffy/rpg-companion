// AI backends for the character sheet: backstory prose via an OpenAI-compatible chat
// completions endpoint (moneta's Strata llama-server), and portrait images via a ComfyUI
// server's prompt API (bigscreen). Both are LAN services; URLs/models are env-overridable
// with the fleet defaults baked in so a fresh deploy works without extra config.
//
// Design notes:
// - Generation is synchronous request/response from the caller's perspective (the frontend
//   shows a spinner); the Comfy path polls /history until the job finishes.
// - The Comfy graph is built in code (not loaded from a saved workflow file) so the backend
//   has no dependency on files outside the container. Only core nodes are used.
import { getCharacterRow } from "./characters.service.js";
import { getAiSettings } from "./settings.service.js";
import { savePortrait } from "../lib/portraits.js";

// Backends are resolved per-call through the settings service (admin Settings page), with env
// vars as the never-saved fallback.

const LLM_TIMEOUT_MS = 180_000;
const COMFY_TIMEOUT_MS = 600_000;
const POLL_INTERVAL_MS = 3_000;

export class AiUnavailableError extends Error {
  status: number;
  constructor(message: string, status = 503) {
    super(message);
    this.status = status;
  }
}

/** The character facts both generators condition on. Built from the row + (for dnd5e) the
 * sheet payload; empty strings are dropped so the prompt never carries placeholder noise. */
export interface CharacterFacts {
  name: string;
  system: string;
  race?: string;
  subrace?: string;
  class?: string;
  subclass?: string;
  background?: string;
  alignment?: string;
  level?: number;
  personality?: string;
  backstory?: string;
  notes?: string;
}

export function buildFacts(
  row: NonNullable<ReturnType<typeof getCharacterRow>>,
  sheetData?: unknown,
): CharacterFacts {
  const facts: CharacterFacts = {
    name: row.name,
    system: row.system,
    backstory: row.backstory ?? undefined,
    notes: row.notes ?? undefined,
  };
  if (row.system === "dnd5e" && sheetData && typeof sheetData === "object") {
    const s = sheetData as Record<string, unknown>;
    const str = (k: string) => (typeof s[k] === "string" && s[k] ? (s[k] as string) : undefined);
    facts.class = str("class");
    facts.subclass = str("subclass");
    facts.race = str("race");
    facts.subrace = str("subrace");
    facts.background = str("background");
    facts.alignment = str("alignment");
    facts.personality = str("personalityText");
    if (typeof s.level === "number") facts.level = s.level;
  }
  return facts;
}

function factsBlock(f: CharacterFacts): string {
  const label: Record<string, string> = {
    name: "Name",
    race: "Race",
    subrace: "Subrace",
    class: "Class",
    subclass: "Subclass",
    background: "Background",
    alignment: "Alignment",
    level: "Level",
    personality: "Personality traits",
    backstory: "Existing backstory",
    notes: "Player notes",
  };
  return Object.entries(f)
    .filter(([k, v]) => k !== "system" && v !== undefined && v !== "")
    .map(([k, v]) => `${label[k] ?? k}: ${v}`)
    .join("\n");
}

async function chatCompletion(messages: { role: string; content: string }[]): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), LLM_TIMEOUT_MS);
  try {
    const settings = getAiSettings();
    const res = await fetch(`${settings.llmUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Reasoning models spend part of the budget on thinking before answering; keep this
      // generous or the answer gets truncated mid-thought.
      body: JSON.stringify({ model: settings.llmModel, messages, temperature: 0.9, max_tokens: 4000 }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      throw new AiUnavailableError(`LLM backend returned ${res.status}`, 502);
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string; reasoning_content?: string } }[];
    };
    // Reasoning models (e.g. moneta's Strata qwen) stream their chain-of-thought in
    // reasoning_content and can return content:null when the budget is spent thinking --
    // accept either, preferring the final answer.
    const message = data.choices?.[0]?.message;
    const text = message?.content ?? message?.reasoning_content;
    if (!text) throw new AiUnavailableError("LLM backend returned an empty completion", 502);
    return text.trim();
  } catch (err) {
    if (err instanceof AiUnavailableError) throw err;
    throw new AiUnavailableError("LLM backend unreachable", 503);
  } finally {
    clearTimeout(timer);
  }
}

/** Generate backstory prose for a character. `instructions` is an optional player steering
 * line ("grimmer tone", "give her a debt to a hag coven") appended to the prompt. */
export async function generateBackstory(facts: CharacterFacts, instructions?: string): Promise<string> {
  const system =
    "You are a tabletop RPG character backstory writer. Write vivid, specific, playable " +
    "backstory prose in the character's voice-appropriate register: 150-250 words, plain " +
    "paragraphs, no markdown headings, no bullet points, no stat-block mechanics. Invent " +
    "concrete details (names, places, debts, scars) rather than generic filler, but never " +
    "contradict the provided facts.";
  const user =
    `Write a backstory for this character:\n\n${factsBlock(facts)}` +
    (instructions ? `\n\nPlayer instructions (take priority): ${instructions}` : "");
  return chatCompletion([
    { role: "system", content: system },
    { role: "user", content: user },
  ]);
}

/** Build the image prompt for a portrait: appearance-focused, conditioned on the sheet facts. */
export function buildPortraitPrompt(facts: CharacterFacts, instructions?: string): string {
  const parts = [
    "character portrait",
    `${facts.level ? `level ${facts.level} ` : ""}${[facts.race, facts.subrace].filter(Boolean).join(" ") || "humanoid"}`,
    facts.class ? `${facts.class}${facts.subclass ? ` ${facts.subclass}` : ""}` : "",
    facts.background ? `${facts.background} background` : "",
    facts.personality ? `personality showing through expression: ${facts.personality}` : "",
    instructions ?? "",
    "detailed fantasy character art, head and shoulders, dramatic lighting, painted, high detail",
  ]
    .filter(Boolean)
    .join(", ");
  return parts;
}

const NEGATIVE_PROMPT =
  "ugly, blurry, low quality, deformed, extra fingers, watermark, text, signature, cropped";

interface ComfyNode {
  class_type: string;
  inputs: Record<string, unknown>;
}

/** Minimal core-node SDXL txt2img graph: checkpoint -> CLIP pair -> KSampler -> VAE -> Save. */
function buildComfyGraph(prompt: string, seed: number, checkpoint: string): Record<string, ComfyNode> {
  return {
    "3": {
      class_type: "KSampler",
      inputs: {
        seed,
        steps: 30,
        cfg: 6.0,
        sampler_name: "dpmpp_2m",
        scheduler: "karras",
        denoise: 1.0,
        model: ["4", 0],
        positive: ["6", 0],
        negative: ["7", 0],
        latent_image: ["5", 0],
      },
    },
    "4": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: checkpoint } },
    // Portrait aspect (matches the sheet's portrait box better than a square).
    "5": { class_type: "EmptyLatentImage", inputs: { width: 896, height: 1152, batch_size: 1 } },
    "6": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["4", 1] } },
    "7": { class_type: "CLIPTextEncode", inputs: { text: NEGATIVE_PROMPT, clip: ["4", 1] } },
    "8": { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
    "9": { class_type: "SaveImage", inputs: { filename_prefix: "rpgcompanion", images: ["8", 0] } },
  };
}

async function comfyFetch(path: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), COMFY_TIMEOUT_MS);
  try {
    return await fetch(`${getAiSettings().comfyUrl}${path}`, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Queue a txt2img job on ComfyUI and wait for the output image bytes. */
export async function generateImage(prompt: string, seed?: number): Promise<Buffer> {
  const graph = buildComfyGraph(prompt, seed ?? Math.floor(Math.random() * 2 ** 52), getAiSettings().comfyCheckpoint);
  const queueRes = await comfyFetch("/prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: graph }),
  });
  if (!queueRes.ok) {
    const body = await queueRes.text().catch(() => "");
    throw new AiUnavailableError(`ComfyUI rejected the job (${queueRes.status}): ${body.slice(0, 300)}`, 502);
  }
  const { prompt_id: promptId } = (await queueRes.json()) as { prompt_id: string };

  const deadline = Date.now() + COMFY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const histRes = await comfyFetch(`/history/${promptId}`);
    if (!histRes.ok) continue;
    const hist = (await histRes.json()) as Record<
      string,
      { status?: { status_str?: string }; outputs?: Record<string, unknown> }
    >;
    const entry = hist[promptId];
    if (!entry) continue; // still queued/running
    const status = entry.status?.status_str;
    if (status === "error" || status === "execution_error") {
      throw new AiUnavailableError("ComfyUI failed to generate the image", 502);
    }
    // Comfy history shape: outputs is { [nodeId]: { images: [{filename, subfolder, type}] } }.
    const image = Object.values(entry.outputs ?? {})
      .flatMap((o) => (o as { images?: { filename?: string; subfolder?: string; type?: string }[] }).images ?? [])
      .find((o) => o.filename);
    if (!image?.filename) continue;
    const viewRes = await comfyFetch(
      `/view?filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder ?? "")}&type=${encodeURIComponent(image.type ?? "output")}`,
    );
    if (!viewRes.ok) throw new AiUnavailableError("ComfyUI image fetch failed", 502);
    return Buffer.from(await viewRes.arrayBuffer());
  }
  throw new AiUnavailableError("ComfyUI generation timed out", 504);
}

/** Generate a portrait and save it as the character's portrait (same storage path as uploads). */
export async function generatePortrait(
  characterId: number,
  facts: CharacterFacts,
  opts: { instructions?: string; seed?: number; setPortrait: (id: number, filename: string) => void | Promise<void> },
): Promise<string> {
  const buffer = await generateImage(buildPortraitPrompt(facts, opts.instructions), opts.seed);
  const filename = savePortrait(characterId, buffer); // magic-byte validated, replaces any existing file
  await opts.setPortrait(characterId, filename);
  return filename;
}
