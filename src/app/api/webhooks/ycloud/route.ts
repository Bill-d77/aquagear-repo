export const runtime = "nodejs";
import { NextResponse, after } from "next/server";
import { verifyYCloudSignature, ycloudToMeta } from "@/lib/meta/ycloud";
import { recordWebhook, processEvent, retryDueEvents } from "@/lib/meta/ingest";

// YCloud webhook for the WhatsApp Business app number (coexistence). Not an
// admin request: it authenticates only via the YCloud-Signature HMAC with the
// endpoint secret (YCLOUD_WEBHOOK_SECRET). Inbound messages are converted to
// Meta's format and join the same pipeline as /api/webhooks/meta.

const MAX_BODY_BYTES = 1024 * 1024;

export async function POST(req: Request) {
  const secret = process.env.YCLOUD_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[ycloud] webhook received but YCLOUD_WEBHOOK_SECRET is not set");
    return new NextResponse("Not configured", { status: 503 });
  }

  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return new NextResponse("Payload too large", { status: 413 });
  }
  const raw = await req.text(); // the signature covers these exact bytes
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return new NextResponse("Payload too large", { status: 413 });
  }
  if (!verifyYCloudSignature(raw, req.headers.get("ycloud-signature"), secret)) {
    console.warn("[ycloud] webhook rejected: invalid signature");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(raw);
  } catch {
    return new NextResponse("Malformed JSON", { status: 400 });
  }

  // Status updates, phone-app echoes, account events: acknowledged, not stored.
  const payload = ycloudToMeta(event);
  if (!payload) return new NextResponse("OK", { status: 200 });

  const recorded = await recordWebhook(raw, payload);
  after(async () => {
    if (recorded?.actionable) await processEvent(recorded.id);
    await retryDueEvents(3); // opportunistic catch-up; the daily cron is the backstop
  });

  return new NextResponse("EVENT_RECEIVED", { status: 200 });
}
