import type { RequestHandler } from "express";

type RateLimitOptions = {
  windowMs: number;
  max: number;
  /** Defaults to client IP. */
  key?: (req: Parameters<RequestHandler>[0]) => string;
  message?: string;
};

const buckets = new Map<string, number[]>();

/** Simple in-memory sliding-window rate limiter (per-process). */
export function rateLimit(opts: RateLimitOptions): RequestHandler {
  const message = opts.message ?? "Too many requests, try again later";

  return (req, res, next) => {
    const key = opts.key?.(req) ?? req.ip ?? "unknown";
    const now = Date.now();
    const windowStart = now - opts.windowMs;
    const stamps = (buckets.get(key) ?? []).filter((t) => t > windowStart);

    if (stamps.length >= opts.max) {
      buckets.set(key, stamps);
      res.status(429).json({ error: message });
      return;
    }

    stamps.push(now);
    buckets.set(key, stamps);
    next();
  };
}
