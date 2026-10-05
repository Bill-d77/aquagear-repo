// Phone numbers → E.164, Lebanon-first. Shared by checkout, the mobile API,
// WhatsApp ingest and admin edits so the same customer always gets the same key.
// Pure and dependency-free (see meta.test.ts).
//
// ponytail: hand-rolled for Lebanon (+961) — mobiles 3/70/71/76/78/79/80/81,
// landlines 01–09 — instead of libphonenumber-js. Other countries pass through
// only when written with a + or 00 prefix. Upgrade to libphonenumber-js if
// foreign customers become common.

/** Best-effort normalization; returns the cleaned input when it can't tell. */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (raw.trim().startsWith("00")) d = d.slice(2);
  if (d.startsWith("961")) return `+${d.replace(/^9610/, "961")}`;
  if (/^0\d{7}$/.test(d)) return `+961${d.slice(1)}`;
  if (/^(?:7[01689]|8[01])\d{6}$/.test(d) || /^3\d{6}$/.test(d)) return `+961${d}`;
  return raw.trim().startsWith("+") || raw.trim().startsWith("00") ? `+${d}` : d;
}

/** E.164 for storage/matching, or null when the input isn't a usable number. */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const p = normalizePhone(raw);
  return /^\+[1-9]\d{6,14}$/.test(p) ? p : null;
}
