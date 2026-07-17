# Structured Data Audit — Iteration 1 (2026-07-17)

Verified by parsing rendered HTML JSON-LD on / and /product/swim-goggles.

- Site-wide: Organization (@id, logo, sameAs socials, areaServed LB) + WebSite with SearchAction (/shop?q=) — ✅ parses, linked via @id
- Product pages: Product (name, description, sku, brand, image[], category) + Offer (real price USD, priceValidUntil, condition, InStock/OutOfStock, seller @id) + BreadcrumbList (Home→Shop→Category→Product) — ✅
- AggregateRating/Review only emitted when real Review rows exist — ✅ policy-safe (verified: swim-goggles has none, none emitted)
- Shop: CollectionPage + BreadcrumbList (per docs/SEO.md)
- Missing (content-blocked, not code): FAQPage, Article/blog, LocalBusiness (needs a physical address decision)

Post-deploy TODO: run Google Rich Results Test on a product URL (needs browser; expect Product + Breadcrumbs valid).
