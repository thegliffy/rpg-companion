import type { RequestHandler } from "express";

type RateLimitOptions = {
  /** Namespaces the default (IP-based) key so unrelated limiters never share a bucket -- e.g.
   * without this, 10 failed campaign-join attempts and a subsequent registration attempt from the
   * same IP would draw on the same counter. Ignored when a custom `key` is supplied. */
  name: string;
  windowMs: number;
  max: number;
  /** Defaults to `${name}:${client IP}`. */
  key?: (req: Parameters<RequestHandler>[0]) => string;
  message?: string;
};

const buckets = new Map<string, number[]>();

// Every bucket is inert once its own window has elapsed, but a key that's never revisited (e.g.
// an attacker sending a fresh random username per login attempt) would otherwise sit in `buckets`
// forever -- the per-request filter below only prunes a key when THAT key is looked up again.
// Sweep periodically so buckets.size is bounded by "active within maxWindowMs", not "ever seen".
let maxWindowMs = 0;
let sweepStarted = false;
function ensureSweep() {
  if (sweepStarted) return;
  sweepStarted = true;
  const timer = setInterval(
    () => {
      const cutoff = Date.now() - maxWindowMs;
      for (const [key, stamps] of buckets) {
        if (stamps.length === 0 || stamps[stamps.length - 1] <= cutoff) buckets.delete(key);
      }
    },
    10 * 60 * 1000,
  );
  timer.unref();
}

/** Simple in-memory sliding-window rate limiter (per-process). */
export function rateLimit(opts: RateLimitOptions): RequestHandler {
  const message = opts.message ?? "Too many requests, try again later";
  maxWindowMs = Math.max(maxWindowMs, opts.windowMs);
  ensureSweep();

  return (req, res, next) => {
    const key = opts.key?.(req) ?? `${opts.name}:${req.ip ?? "unknown"}`;
    const now = Date.now();
    const windowStart = now - opts.windowMs;
    const stamps = (buckets.get(key) ?? []).filter((t) => t > windowStart);

    if (stamps.length >= opts.max) {
      if (stamps.length > 0) buckets.set(key, stamps);
      else buckets.delete(key);
      res.status(429).json({ error: message });
      return;
    }

    stamps.push(now);
    buckets.set(key, stamps);
    next();
  };
}
