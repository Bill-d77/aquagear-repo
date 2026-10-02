// The only place that talks to Meta's Graph APIs. Credentials stay server-side;
// errors are logged by code/message only — tokens never reach logs or responses.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { metaConfig } from "./config";
import { sha256 } from "./signature";
import type { Channel } from "./normalize";

export type GraphResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code?: number; message: string; friendly: string };

const RETRYABLE_CODES = new Set([1, 2, 4, 17, 32, 613, 80007, 130429, 131056]);
const MAX_ATTEMPTS = 3;

function friendly(code: number | undefined, status: number): string {
  if (code === 190) return "Access token expired or invalid";
  if (code === 10 || (code !== undefined && code >= 200 && code < 300)) return "Missing permission";
  if (code !== undefined && RETRYABLE_CODES.has(code)) return "Rate limited by Meta — try again shortly";
  if (code === 131047 || code === 2534022) return "Outside the 24-hour reply window";
  if (code === 100) return "Meta rejected the request (invalid parameter)";
  if (status === 0) return "Could not reach Meta";
  return "Meta API error";
}

async function graph<T>(url: string, token: string, init: RequestInit = {}): Promise<GraphResult<T>> {
  let last: GraphResult<T> = { ok: false, status: 0, message: "not attempted", friendly: friendly(undefined, 0) };
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let retryAfterMs = 500 * 2 ** (attempt - 1);
    try {
      const res = await fetch(url, {
        ...init,
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
        signal: AbortSignal.timeout(10_000),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true, data: body as T };
      const err = body?.error ?? {};
      last = { ok: false, status: res.status, code: err.code, message: String(err.message ?? res.statusText).slice(0, 300), friendly: friendly(err.code, res.status) };
      const retryable = res.status === 429 || res.status >= 500 || RETRYABLE_CODES.has(err.code);
      if (!retryable) break;
      const ra = Number(res.headers.get("retry-after"));
      if (ra > 0) retryAfterMs = Math.min(ra * 1000, 8000);
    } catch (e) {
      last = { ok: false, status: 0, message: e instanceof Error ? e.message : "network error", friendly: friendly(undefined, 0) };
    }
    if (attempt < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, retryAfterMs));
  }
  console.error(`[meta] ${init.method ?? "GET"} ${new URL(url).pathname} failed: ${last.ok ? "" : `${last.status} code=${last.code} ${last.message}`}`);
  return last;
}

const fb = (path: string) => `https://graph.facebook.com/${metaConfig().graphVersion}/${path}`;
const ig = (path: string) => `https://graph.instagram.com/${metaConfig().graphVersion}/${path}`;

// ── Instagram token (60-day, refreshable) ───────────────────────────────────

const IG_TOKEN_KEY = "instagram_token";
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

function key() {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required to store Meta credentials");
  return createHash("sha256").update(`meta-credential:${secret}`).digest();
}
function encrypt(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64");
}
function decrypt(blob: string) {
  const buf = Buffer.from(blob, "base64");
  const d = createDecipheriv("aes-256-gcm", key(), buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8");
}

/**
 * The refreshed token from the DB, as long as it descends from the token
 * currently in env (rotating INSTAGRAM_ACCESS_TOKEN in Vercel wins).
 */
export async function getInstagramToken(): Promise<string> {
  const envToken = metaConfig().instagramEnvToken;
  if (!envToken) return "";
  const row = await prisma.metaCredential.findUnique({ where: { key: IG_TOKEN_KEY } });
  if (row && row.seedHash === sha256(envToken)) {
    try {
      return decrypt(row.value);
    } catch {
      console.error("[meta] stored Instagram token could not be decrypted (AUTH_SECRET changed?) — using env token");
    }
  }
  return envToken;
}

/** Called by the daily cron. Long-lived Instagram tokens expire after 60 days unless refreshed. */
export async function refreshInstagramTokenIfDue(): Promise<string> {
  const envToken = metaConfig().instagramEnvToken;
  if (!envToken) return "instagram not configured";
  const row = await prisma.metaCredential.findUnique({ where: { key: IG_TOKEN_KEY } });
  const fresh = row && row.seedHash === sha256(envToken);
  if (fresh && Date.now() - row.updatedAt.getTime() < REFRESH_AFTER_MS) return "instagram token fresh";

  const current = await getInstagramToken();
  // This endpoint takes the token as a query param (Meta's API); the URL is never logged.
  const res = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(current)}`,
    { signal: AbortSignal.timeout(10_000) },
  ).catch(() => null);
  const body = res ? await res.json().catch(() => ({})) : {};
  if (!res?.ok || typeof body.access_token !== "string") {
    console.error(`[meta] Instagram token refresh failed: ${res?.status ?? "network"} ${body?.error?.message ?? ""}`);
    return "instagram token refresh failed";
  }
  const data = {
    value: encrypt(body.access_token),
    seedHash: sha256(envToken),
    expiresAt: Number(body.expires_in) > 0 ? new Date(Date.now() + Number(body.expires_in) * 1000) : null,
  };
  await prisma.metaCredential.upsert({ where: { key: IG_TOKEN_KEY }, create: { key: IG_TOKEN_KEY, ...data }, update: data });
  return "instagram token refreshed";
}

// ── Messaging ───────────────────────────────────────────────────────────────

export async function sendText(channel: Channel, customerId: string, text: string): Promise<GraphResult<{ id: string }>> {
  const cfg = metaConfig();
  if (channel === "WHATSAPP") {
    if (!cfg.whatsappPhoneNumberId || !cfg.whatsappToken) return notConfigured("WhatsApp");
    const res = await graph<{ messages?: { id: string }[] }>(fb(`${cfg.whatsappPhoneNumberId}/messages`), cfg.whatsappToken, {
      method: "POST",
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: customerId, type: "text", text: { preview_url: false, body: text } }),
    });
    return res.ok ? { ok: true, data: { id: res.data.messages?.[0]?.id ?? "" } } : res;
  }
  const token = await getInstagramToken();
  if (!token) return notConfigured("Instagram");
  const res = await graph<{ message_id?: string }>(ig(`${cfg.instagramAccountId || "me"}/messages`), token, {
    method: "POST",
    body: JSON.stringify({ recipient: { id: customerId }, message: { text } }),
  });
  return res.ok ? { ok: true, data: { id: res.data.message_id ?? "" } } : res;
}

export async function fetchInstagramProfile(igsid: string): Promise<{ name?: string; username?: string } | null> {
  const token = await getInstagramToken();
  if (!token) return null;
  const res = await graph<{ name?: string; username?: string }>(ig(`${encodeURIComponent(igsid)}?fields=name,username`), token);
  return res.ok ? res.data : null;
}

const MAX_MEDIA_BYTES = 16 * 1024 * 1024;
const IG_MEDIA_HOSTS = /(?:^|\.)(?:fbcdn\.net|fbsbx\.com|cdninstagram\.com)$/;

/** Fetch message media for the admin proxy. WhatsApp media needs an authenticated two-step fetch. */
export async function fetchMedia(channel: string, metadata: Record<string, any> | null): Promise<Response | null> {
  if (channel === "WHATSAPP") {
    const mediaId = metadata?.mediaId;
    const { whatsappToken } = metaConfig();
    if (typeof mediaId !== "string" || !whatsappToken) return null;
    const info = await graph<{ url?: string; file_size?: number }>(fb(encodeURIComponent(mediaId)), whatsappToken);
    if (!info.ok || !info.data.url || (info.data.file_size ?? 0) > MAX_MEDIA_BYTES) return null;
    return fetch(info.data.url, { headers: { authorization: `Bearer ${whatsappToken}` }, signal: AbortSignal.timeout(15_000) }).catch(() => null);
  }
  const url = metadata?.attachments?.[0]?.url;
  if (typeof url !== "string") return null;
  let host: string;
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    host = u.hostname;
  } catch {
    return null;
  }
  if (!IG_MEDIA_HOSTS.test(host)) return null; // never proxy arbitrary hosts (SSRF)
  return fetch(url, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
}

export { MAX_MEDIA_BYTES };

// ── Health ──────────────────────────────────────────────────────────────────

export interface ChannelHealth {
  state: "connected" | "not_configured" | "error";
  label: string;
  detail?: string;
}

export async function checkHealth(): Promise<Record<Channel, ChannelHealth>> {
  const cfg = metaConfig();
  const wa: Promise<ChannelHealth> =
    cfg.whatsappPhoneNumberId && cfg.whatsappToken
      ? graph<{ display_phone_number?: string; verified_name?: string }>(
          fb(`${cfg.whatsappPhoneNumberId}?fields=display_phone_number,verified_name`),
          cfg.whatsappToken,
        ).then((r) =>
          r.ok
            ? { state: "connected", label: `${r.data.verified_name ?? ""} ${r.data.display_phone_number ?? ""}`.trim() || "Connected" }
            : { state: "error", label: r.friendly, detail: `${r.status} code=${r.code ?? "-"} ${r.message}` },
        )
      : Promise.resolve({ state: "not_configured", label: "Not configured" });
  const igToken = await getInstagramToken();
  const igh: Promise<ChannelHealth> = igToken
    ? graph<{ username?: string; user_id?: string }>(ig("me?fields=user_id,username"), igToken).then((r) =>
        r.ok
          ? { state: "connected", label: r.data.username ? `@${r.data.username}` : "Connected" }
          : { state: "error", label: r.friendly, detail: `${r.status} code=${r.code ?? "-"} ${r.message}` },
      )
    : Promise.resolve({ state: "not_configured", label: "Not configured" });
  const [WHATSAPP, INSTAGRAM] = await Promise.all([wa, igh]);
  return { WHATSAPP, INSTAGRAM };
}

function notConfigured(name: string): GraphResult<never> {
  return { ok: false, status: 0, message: `${name} not configured`, friendly: `${name} is not configured` };
}
