// Meta webhook authentication. Pure (node:crypto only) so it's unit-testable.
import { createHmac, createHash, timingSafeEqual } from "node:crypto";

/**
 * Verify an X-Hub-Signature-256 header ("sha256=<hex>") against the raw body.
 * Several secrets are accepted because WhatsApp deliveries are signed with the
 * Meta app secret while Instagram-Login deliveries use the Instagram app secret.
 */
export function verifyMetaSignature(rawBody: string, header: string | null, secrets: string[]): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const given = Buffer.from(header.slice(7), "hex");
  if (given.length !== 32) return false;
  return secrets.some((secret) => {
    const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
    return timingSafeEqual(expected, given);
  });
}

/** Constant-time string compare for verify tokens / cron secrets. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
