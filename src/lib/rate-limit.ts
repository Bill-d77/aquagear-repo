// Simple in-memory sliding-window rate limiter.
//
// Caveat: this lives in process memory, so on serverless platforms (e.g. Vercel)
// each lambda instance has its own counters. That means the effective limit is
// "max attempts per instance per window," not "per global cluster." It still
// raises the cost of brute-force / spam meaningfully versus zero limits. For
// global enforcement, swap the Map for Upstash Redis or @vercel/kv.

type Bucket = number[]; // timestamps (ms) of recent hits

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 10_000; // hard cap to bound memory in pathological cases

export interface RateLimitOptions {
  /** Identifier to bucket on (e.g. "signup:ip:1.2.3.4" or "login:email:foo@x.com"). */
  key: string;
  /** Maximum number of hits allowed inside the window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds the caller should wait before retrying (only meaningful when ok=false). */
  retryAfter: number;
  /** Remaining hits in the current window. */
  remaining: number;
}

export function rateLimit({ key, max, windowMs }: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const cutoff = now - windowMs;

  // Drop oldest keys if the map has grown unreasonably large.
  if (buckets.size > MAX_KEYS) {
    const firstKey = buckets.keys().next().value;
    if (firstKey !== undefined) buckets.delete(firstKey);
  }

  const existing = buckets.get(key) ?? [];
  // Prune timestamps that fall outside the window.
  const fresh = existing.filter((t) => t > cutoff);

  if (fresh.length >= max) {
    const oldest = fresh[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, fresh);
    return { ok: false, retryAfter, remaining: 0 };
  }

  fresh.push(now);
  buckets.set(key, fresh);
  return { ok: true, retryAfter: 0, remaining: max - fresh.length };
}

/**
 * Best-effort client IP extraction from a Request. Falls back to "unknown"
 * so the limiter still bucket-groups requests that lack forwarded headers
 * (better than letting them bypass the limit entirely).
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

/**
 * Same as getClientIp but reads from a Headers instance (useful inside
 * NextAuth callbacks where the raw Request isn't available — pair it with
 * `headers()` from "next/headers").
 */
export function getClientIpFromHeaders(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  const real = headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}
