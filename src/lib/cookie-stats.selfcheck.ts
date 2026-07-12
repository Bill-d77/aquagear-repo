/** Self-check for the consent rollup. Run: `node src/lib/cookie-stats.selfcheck.ts` */
import assert from "node:assert/strict";
import { computeConsentStats, type ConsentRow } from "./cookie-stats.ts";

const day = 86400_000;
const now = Date.now();
const row = (o: Partial<ConsentRow> & { anonId: string; createdAt: Date }): ConsentRow => ({
  functional: false,
  analytics: false,
  marketing: false,
  country: null,
  ...o,
});

// visitor A changed their mind: latest (analytics only) must win over the older accept-all.
const rows: ConsentRow[] = [
  row({ anonId: "A", analytics: true, country: "LB", createdAt: new Date(now - 1 * day) }),
  row({ anonId: "A", functional: true, analytics: true, marketing: true, country: "LB", createdAt: new Date(now - 5 * day) }),
  row({ anonId: "B", functional: true, analytics: true, marketing: true, country: "US", createdAt: new Date(now - 2 * day) }),
  row({ anonId: "C", country: "LB", createdAt: new Date(now - 40 * day) }), // reject-all, outside 30d
];

const s = computeConsentStats(rows);
assert.equal(s.totalDecisions, 4);
assert.equal(s.uniqueVisitors, 3); // A, B, C
assert.equal(s.decisions30d, 3); // C is 40d old
// latest choices: A={analytics}, B={all}, C={none}
assert.equal(s.analyticsPct, 67); // A + B of 3 = 66.7 -> 67
assert.equal(s.marketingPct, 33); // only B
assert.equal(s.acceptAllPct, 33); // only B
assert.equal(s.rejectAllPct, 33); // only C
assert.deepEqual(s.byCountry, [
  { country: "LB", count: 2 },
  { country: "US", count: 1 },
]);
assert.equal(s.recent.length, 4);
assert.ok(!("anonId" in s.recent[0]), "recent rows must not leak anonId");

// empty input never divides by zero
const z = computeConsentStats([]);
assert.equal(z.uniqueVisitors, 0);
assert.equal(z.analyticsPct, 0);

console.log("cookie-stats.selfcheck: OK");
