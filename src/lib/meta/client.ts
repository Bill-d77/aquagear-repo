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

// ── WhatsApp credentials (from Embedded Signup, or env) ─────────────────────

const WA_CRED_KEY = "whatsapp";

export interface WhatsAppCreds {
  token: string;
  phoneNumberId: string;
  wabaId: string;
  source: "env" | "signup" | "none";
  /** Signup tokens expire (our Embedded Signup configuration issues 60-day tokens); env tokens are managed by hand. */
  expiresAt: Date | null;
}

/** Env vars win (manual setup / rotation); otherwise the encrypted business token stored by Embedded Signup. */
export async function getWhatsAppCreds(): Promise<WhatsAppCreds> {
  const cfg = metaConfig();
  if (cfg.whatsappToken && cfg.whatsappPhoneNumberId) {
    return { token: cfg.whatsappToken, phoneNumberId: cfg.whatsappPhoneNumberId, wabaId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || "", source: "env", expiresAt: null };
  }
  const row = await prisma.metaCredential.findUnique({ where: { key: WA_CRED_KEY } });
  if (row) {
    try {
      const c = JSON.parse(decrypt(row.value));
      return { token: c.token, phoneNumberId: c.phoneNumberId, wabaId: c.wabaId, source: "signup", expiresAt: row.expiresAt };
    } catch {
      console.error("[meta] stored WhatsApp credentials could not be decrypted (AUTH_SECRET changed?) — reconnect from /admin/meta");
    }
  }
  return { token: "", phoneNumberId: "", wabaId: "", source: "none", expiresAt: null };
}

export type SignupStep = { step: string; ok: boolean; detail?: string };

/**
 * Finish WhatsApp Business app (coexistence) onboarding after Embedded Signup:
 * exchange the 30-second code for a business token, find the number, subscribe
 * this app to the WABA's webhooks, store the credentials encrypted, then start
 * contacts → history sync (Meta allows this once, within 24h of onboarding).
 * Coexistence numbers are already registered, so /register is skipped.
 */
export async function completeCoexistenceSignup(code: string, wabaId: string): Promise<SignupStep[]> {
  const cfg = metaConfig();
  const steps: SignupStep[] = [];
  if (!cfg.appId || !cfg.appSecret) return [{ step: "Configuration", ok: false, detail: "META_APP_ID and META_APP_SECRET must be set" }];

  // Token exchange: Meta takes these as query params; the URL is never logged.
  const res = await fetch(
    `${fb("oauth/access_token")}?${new URLSearchParams({ client_id: cfg.appId, client_secret: cfg.appSecret, code })}`,
    { signal: AbortSignal.timeout(10_000) },
  ).catch(() => null);
  const body = res ? await res.json().catch(() => ({})) : {};
  const token = typeof body.access_token === "string" ? body.access_token : "";
  steps.push({ step: "Exchange signup code", ok: !!token, detail: token ? undefined : friendly(body?.error?.code, res?.status ?? 0) });
  if (!token) {
    console.error(`[meta] signup token exchange failed: ${res?.status ?? "network"} code=${body?.error?.code ?? "-"}`);
    return steps;
  }

  const numbers = await graph<{ data?: { id: string; display_phone_number?: string; is_on_biz_app?: boolean; platform_type?: string }[] }>(
    fb(`${encodeURIComponent(wabaId)}/phone_numbers?fields=id,display_phone_number,is_on_biz_app,platform_type`),
    token,
  );
  const list = numbers.ok ? numbers.data.data ?? [] : [];
  const number = list.find((n) => n.is_on_biz_app) ?? list[0];
  steps.push({
    step: "Find phone number",
    ok: !!number,
    detail: number ? `${number.display_phone_number ?? number.id}${number.is_on_biz_app ? " · on WhatsApp Business app" : " · not reported as on the app"}` : numbers.ok ? "No number on this account" : numbers.friendly,
  });
  if (!number) return steps;

  const sub = await graph<{ success?: boolean }>(fb(`${encodeURIComponent(wabaId)}/subscribed_apps`), token, { method: "POST" });
  steps.push({ step: "Subscribe app to webhooks", ok: sub.ok, detail: sub.ok ? undefined : sub.friendly });

  const value = encrypt(JSON.stringify({ token, phoneNumberId: number.id, wabaId }));
  // The only Embedded Signup configuration Meta offers this app ("…With 60 Expiration Token")
  // issues 60-day tokens; trust expires_in when Meta sends it. Replace with a permanent
  // system-user token via WHATSAPP_* env vars before it lapses (Admin → Meta warns).
  const expiresAt = new Date(Date.now() + (Number(body.expires_in) > 0 ? Number(body.expires_in) * 1000 : 60 * 24 * 60 * 60 * 1000));
  await prisma.metaCredential.upsert({
    where: { key: WA_CRED_KEY },
    create: { key: WA_CRED_KEY, value, seedHash: "embedded-signup", expiresAt },
    update: { value, seedHash: "embedded-signup", expiresAt },
  });
  steps.push({ step: "Store credentials (encrypted)", ok: true });

  steps.push(...(await requestSmbSync(["smb_app_state_sync", "history"])));
  return steps;
}

/** Ask Meta to send contacts and/or chat history via webhooks (contacts first, per Meta). */
export async function requestSmbSync(types: ("smb_app_state_sync" | "history")[]): Promise<SignupStep[]> {
  const { token, phoneNumberId } = await getWhatsAppCreds();
  if (!token || !phoneNumberId) return [{ step: "Sync", ok: false, detail: "WhatsApp is not connected" }];
  const steps: SignupStep[] = [];
  for (const sync_type of types) {
    const r = await graph<{ request_id?: string }>(fb(`${phoneNumberId}/smb_app_data`), token, {
      method: "POST",
      body: JSON.stringify({ messaging_product: "whatsapp", sync_type }),
    });
    steps.push({
      step: sync_type === "history" ? "Start chat history sync" : "Start contacts sync",
      ok: r.ok,
      detail: r.ok ? undefined : `${r.friendly} (${r.message})`,
    });
  }
  return steps;
}

// ── Messaging ───────────────────────────────────────────────────────────────

/** Phone numbers go in `to`; a business-scoped user id ("LB.123…", phone withheld) in `recipient`. */
const waAddress = (customerId: string) => (customerId.includes(".") ? { recipient: customerId } : { to: customerId });

export async function sendText(channel: Channel, customerId: string, text: string): Promise<GraphResult<{ id: string }>> {
  const cfg = metaConfig();
  if (channel === "WHATSAPP") {
    const wa = await getWhatsAppCreds();
    if (!wa.phoneNumberId || !wa.token) return notConfigured("WhatsApp");
    const res = await graph<{ messages?: { id: string }[] }>(fb(`${wa.phoneNumberId}/messages`), wa.token, {
      method: "POST",
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", ...waAddress(customerId), type: "text", text: { preview_url: false, body: text } }),
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

// ── WhatsApp templates (the only messages allowed outside the 24h window) ───

export interface WhatsAppTemplate {
  name: string;
  language: string;
  body: string; // BODY component text with {{1}}… placeholders
  params: number;
}

// ponytail: per-instance 10-minute cache so the auto-refreshing inbox doesn't
// call Graph every 10s. New/edited templates show up within 10 minutes.
let templateCache: { at: number; list: WhatsAppTemplate[] } | null = null;

/** Approved templates of the connected WABA (text-only bodies; header/button media templates are skipped). */
export async function listTemplates(): Promise<WhatsAppTemplate[]> {
  if (templateCache && Date.now() - templateCache.at < 10 * 60_000) return templateCache.list;
  const { token, wabaId } = await getWhatsAppCreds();
  if (!token || !wabaId) return [];
  const res = await graph<{ data?: { name: string; language: string; status: string; components?: { type: string; format?: string; text?: string }[] }[] }>(
    fb(`${encodeURIComponent(wabaId)}/message_templates?fields=name,language,status,components&status=APPROVED&limit=100`),
    token,
  );
  if (!res.ok) return templateCache?.list ?? [];
  const list = (res.data.data ?? [])
    .filter((t) => t.status === "APPROVED" && !(t.components ?? []).some((c) => c.type === "HEADER" && c.format && c.format !== "TEXT"))
    .flatMap((t) => {
      const body = t.components?.find((c) => c.type === "BODY")?.text ?? "";
      const header = t.components?.find((c) => c.type === "HEADER")?.text ?? "";
      if (/\{\{/.test(header)) return []; // header variables not supported in this simple picker
      const params = new Set(body.match(/\{\{\d+\}\}/g) ?? []).size;
      return [{ name: t.name, language: t.language, body, params }];
    });
  templateCache = { at: Date.now(), list };
  return list;
}

/** Send an approved template with positional body parameters. */
export async function sendTemplate(to: string, name: string, language: string, params: string[]): Promise<GraphResult<{ id: string }>> {
  const wa = await getWhatsAppCreds();
  if (!wa.phoneNumberId || !wa.token) return notConfigured("WhatsApp");
  const res = await graph<{ messages?: { id: string }[] }>(fb(`${wa.phoneNumberId}/messages`), wa.token, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      ...waAddress(to),
      type: "template",
      template: {
        name,
        language: { code: language },
        ...(params.length ? { components: [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] } : {}),
      },
    }),
  });
  return res.ok ? { ok: true, data: { id: res.data.messages?.[0]?.id ?? "" } } : res;
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
    const { token: whatsappToken } = await getWhatsAppCreds();
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
  const creds = await getWhatsAppCreds();
  const wa: Promise<ChannelHealth> =
    creds.phoneNumberId && creds.token
      ? graph<{ display_phone_number?: string; verified_name?: string; is_on_biz_app?: boolean; platform_type?: string }>(
          fb(`${creds.phoneNumberId}?fields=display_phone_number,verified_name,is_on_biz_app,platform_type`),
          creds.token,
        ).then((r) =>
          r.ok
            ? {
                state: "connected",
                label: `${r.data.verified_name ?? ""} ${r.data.display_phone_number ?? ""}`.trim() || "Connected",
                detail: `is_on_biz_app=${r.data.is_on_biz_app ?? "?"} platform_type=${r.data.platform_type ?? "?"}`,
              }
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
