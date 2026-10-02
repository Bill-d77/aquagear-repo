// YCloud (Meta partner) relays the WhatsApp Business app number via coexistence.
// Its inbound-message webhook carries the same per-message fields as Meta's Cloud
// API (text, image, order, context, referral, …), so we re-wrap it in Meta's
// envelope and reuse the whole Meta pipeline. Pure (node:crypto only) so it's
// unit-testable.
import { createHmac, timingSafeEqual } from "node:crypto";

/** Verify "YCloud-Signature: t=<unix>,s=<hex HMAC-SHA256 of `${t}.${rawBody}`>". */
export function verifyYCloudSignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header || !secret) return false;
  const parts = new Map(header.split(",").map((p) => p.trim().split("=", 2) as [string, string]));
  const t = parts.get("t");
  const s = parts.get("s");
  if (!t || !/^\d+$/.test(t) || !s || !/^[0-9a-f]{64}$/i.test(s)) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`, "utf8").digest();
  return timingSafeEqual(expected, Buffer.from(s, "hex"));
}

type Obj = Record<string, any>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Re-wrap a `whatsapp.inbound_message.received` event as a Meta Cloud API
 * webhook payload. Anything else (status updates, echoes of messages sent from
 * the phone, account events) returns null and is acknowledged without storing.
 */
export function ycloudToMeta(event: unknown): Obj | null {
  if (!isObj(event) || event.type !== "whatsapp.inbound_message.received") return null;
  const m = event.whatsappInboundMessage;
  if (!isObj(m) || typeof m.wamid !== "string" || typeof m.type !== "string") return null;
  const waId = String(m.from ?? "").replace(/\D/g, ""); // YCloud: "+9617…", Meta: "9617…"
  if (!waId) return null;

  const sent = Math.floor(new Date(m.sendTime ?? event.createTime).getTime() / 1000);
  const message: Obj = {
    id: m.wamid,
    from: waId,
    timestamp: String(Number.isFinite(sent) ? sent : Math.floor(Date.now() / 1000)),
    type: m.type,
  };
  for (const key of [m.type, "context", "referral"]) if (m[key] !== undefined) message[key] = m[key];

  const name = isObj(m.customerProfile) ? m.customerProfile.name : undefined;
  return {
    object: "whatsapp_business_account",
    entry: [{
      id: String(m.wabaId ?? ""),
      changes: [{
        field: "messages",
        value: {
          messaging_product: "whatsapp",
          contacts: typeof name === "string" && name ? [{ wa_id: waId, profile: { name } }] : [],
          messages: [message],
        },
      }],
    }],
  };
}
