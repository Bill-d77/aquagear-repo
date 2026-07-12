/**
 * Runnable self-check for the consent codec (the only non-trivial logic here).
 * Run: `node src/lib/cookies.selfcheck.ts`  (Node 22+ strips the types natively)
 */
import assert from "node:assert/strict";
import {
  serializeConsent,
  parseConsent,
  ACCEPT_ALL,
  DECLINE_ALL,
  CONSENT_VERSION,
} from "./cookies.ts";

// round-trips
assert.deepEqual(
  { functional: true, analytics: true, marketing: true },
  pick(parseConsent(serializeConsent(ACCEPT_ALL))),
);
assert.deepEqual(
  { functional: false, analytics: false, marketing: false },
  pick(parseConsent(serializeConsent(DECLINE_ALL))),
);

// timestamp is preserved
const ts = "2026-01-01T00:00:00.000Z";
assert.equal(parseConsent(serializeConsent(ACCEPT_ALL, ts))!.ts, ts);

// rejects: empty, garbage, and stale version -> null (banner re-shows)
assert.equal(parseConsent(undefined), null);
assert.equal(parseConsent(""), null);
assert.equal(parseConsent("not json"), null);
assert.equal(parseConsent(JSON.stringify({ v: CONSENT_VERSION + 1, analytics: true })), null);

// missing keys coerce to false, never throw
assert.deepEqual(pick(parseConsent(JSON.stringify({ v: CONSENT_VERSION }))), DECLINE_ALL);

function pick(c: { functional: boolean; analytics: boolean; marketing: boolean } | null) {
  assert.ok(c, "expected non-null consent");
  return { functional: c.functional, analytics: c.analytics, marketing: c.marketing };
}

console.log("cookies.selfcheck: OK");
