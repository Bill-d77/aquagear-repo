export const runtime = "nodejs";
import { NextResponse, after } from "next/server";
import { metaConfig } from "@/lib/meta/config";
import { verifyMetaSignature, safeEqual } from "@/lib/meta/signature";
import { recordWebhook, processEvent, retryDueEvents } from "@/lib/meta/ingest";

// Meta webhook for WhatsApp Cloud API + Instagram messaging. This is not an
// admin request: it authenticates only via Meta's verify token (GET) and the
// X-Hub-Signature-256 HMAC over the raw body (POST).

const MAX_BODY_BYTES = 1024 * 1024;

/** Subscription handshake from the Meta App Dashboard. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token") ?? "";
  const challenge = url.searchParams.get("hub.challenge") ?? "";
  const { verifyToken } = metaConfig();

  if (mode === "subscribe" && verifyToken && safeEqual(token, verifyToken) && /^[\w-]{1,128}$/.test(challenge)) {
    return new NextResponse(challenge, { status: 200, headers: { "content-type": "text/plain" } });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: Request) {
  const { webhookSecrets } = metaConfig();
  if (!webhookSecrets.length) {
    // Never accept unsigned deliveries, not even in development.
    console.error("[meta] webhook received but META_APP_SECRET / INSTAGRAM_APP_SECRET is not set");
    return new NextResponse("Not configured", { status: 503 });
  }

  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return new NextResponse("Payload too large", { status: 413 });
  }
  const raw = await req.text(); // the signature covers these exact bytes
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return new NextResponse("Payload too large", { status: 413 });
  }
  if (!verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"), webhookSecrets)) {
    console.warn("[meta] webhook rejected: invalid signature");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse("Malformed JSON", { status: 400 });
  }

  // Persist first; once stored, a processing failure is retried by us rather
  // than by making Meta redeliver, so we acknowledge with 200 from here on.
  const recorded = await recordWebhook(raw, payload);
  after(async () => {
    if (recorded?.actionable) await processEvent(recorded.id);
    await retryDueEvents(3); // opportunistic catch-up; the daily cron is the backstop
  });

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}
