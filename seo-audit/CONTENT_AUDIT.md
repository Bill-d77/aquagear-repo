# Content & On-Page Audit — Iteration 1 (2026-07-17) — Score: 70/100

## Verified good
- Unique titles + descriptions on every page (template "%s · AquaGear"); product meta description derived from product description, truncated at 160 ✅
- One h1 per page; heading order fixed this iteration ✅
- OG/Twitter cards on all pages; per-product OG images ✅
- Real data only: ratings/reviews never fabricated in markup ✅

## Findings

**C1 (Medium) — Brand inconsistency "AquaGear4"**: homepage title said
"AquaGear4" (fixed in code this iteration). The DB `storeName` setting is also
"AquaGear4" — it feeds Organization/WebSite schema and the header. Owner: change
store name to "AquaGear" in /admin/settings.

**C2 (Medium) — "Coming soon" products are indexed and in the Merchant feed**:
e.g. "Fenders Starter (coming soon )" (note trailing space) with a real price.
Google Shopping will treat these as purchasable → disapproval/trust risk, and
"(coming soon)" in titles wastes the primary keyword slot.
Fix: archive them until launch (removes from sitemap + feed automatically), or
strip "(coming soon)" and set stock 0.

**C3 (Medium) — "SALE" badge on every non-new product** (page.tsx): display-only
sale claims = deceptive-pricing risk if a Merchant listing ever carries a sale
annotation. Pre-existing finding (AUDIT_REPORT.md M1). Needs business decision:
real original prices in DB, or drop the badge.

**C4 (Low) — Thin product descriptions**: one short paragraph per product
("High-quality fenders for sea activities."). No specs/FAQ/size guides. Blocked
on real product knowledge (see docs/SEO.md) — needs copywriting, not code.

**C5 (Low) — No informational content**: no blog, guides, or FAQ → nothing to
win featured snippets / AI Overviews with. Long-term (Phase 20) item.
