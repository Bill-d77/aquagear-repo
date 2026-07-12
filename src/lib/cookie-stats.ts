// Aggregates for the /admin/cookies page, computed from the CookieConsent audit
// table. Each row is one consent DECISION; a visitor (anonId) can have several
// over time, so "rates" are computed over each visitor's *latest* decision.
//
// prisma is imported lazily inside getConsentStats so the pure rollup below can
// be run under plain Node (self-check) without resolving the "@/" alias.

export type ConsentRow = {
  anonId: string;
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
  country: string | null;
  createdAt: Date;
};

export type ConsentStats = {
  totalDecisions: number;
  uniqueVisitors: number;
  decisions30d: number;
  // percentages (0–100) over each visitor's latest decision
  acceptAllPct: number;
  rejectAllPct: number;
  functionalPct: number;
  analyticsPct: number;
  marketingPct: number;
  byCountry: { country: string; count: number }[];
  daily: { date: string; count: number }[];
  recent: Omit<ConsentRow, "anonId">[];
};

/**
 * Pure rollup: all decision rows (newest first) → display stats. Kept separate
 * from the DB call so it can be unit-checked. Latest-per-visitor = first time
 * each anonId appears when the rows are sorted newest-first.
 */
export function computeConsentStats(rowsNewestFirst: ConsentRow[]): ConsentStats {
  const seen = new Set<string>();
  const latest: ConsentRow[] = [];
  for (const r of rowsNewestFirst) {
    if (!seen.has(r.anonId)) {
      seen.add(r.anonId);
      latest.push(r);
    }
  }

  const n = latest.length;
  const pct = (c: number) => (n === 0 ? 0 : Math.round((c / n) * 100));
  const count = (pred: (r: ConsentRow) => boolean) => latest.filter(pred).length;

  const countryMap = new Map<string, number>();
  for (const r of latest) {
    const c = r.country || "Unknown";
    countryMap.set(c, (countryMap.get(c) ?? 0) + 1);
  }
  const byCountry = [...countryMap.entries()]
    .map(([country, cnt]) => ({ country, count: cnt }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const thirtyDaysAgo = Date.now() - 30 * 86400_000;
  const dailyMap = new Map<string, number>();
  let decisions30d = 0;
  for (const r of rowsNewestFirst) {
    if (r.createdAt.getTime() >= thirtyDaysAgo) {
      decisions30d++;
      const d = r.createdAt.toISOString().slice(0, 10);
      dailyMap.set(d, (dailyMap.get(d) ?? 0) + 1);
    }
  }
  const daily = [...dailyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, cnt]) => ({ date, count: cnt }));

  return {
    totalDecisions: rowsNewestFirst.length,
    uniqueVisitors: n,
    decisions30d,
    acceptAllPct: pct(count((r) => r.functional && r.analytics && r.marketing)),
    rejectAllPct: pct(count((r) => !r.functional && !r.analytics && !r.marketing)),
    functionalPct: pct(count((r) => r.functional)),
    analyticsPct: pct(count((r) => r.analytics)),
    marketingPct: pct(count((r) => r.marketing)),
    byCountry,
    daily,
    recent: rowsNewestFirst.slice(0, 20).map(({ anonId, ...rest }) => rest),
  };
}

export async function getConsentStats(): Promise<ConsentStats> {
  const { prisma } = await import("@/lib/prisma");
  // ponytail: loads all consent rows and rolls up in JS — fine at this store's
  // volume. Swap for SQL DISTINCT ON + date_trunc if the table passes ~100k rows.
  const rows = await prisma.cookieConsent.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      anonId: true,
      functional: true,
      analytics: true,
      marketing: true,
      country: true,
      createdAt: true,
    },
  });
  return computeConsentStats(rows);
}
