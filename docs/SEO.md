# AquaGear SEO — What's implemented and what's deferred

## Implemented (this PR + prior work)

**Indexing & crawl**
- `app/robots.ts` — allows all, disallows `/admin`, `/api`, `/cart`, `/checkout`, `/account`; points at the sitemap.
- `app/sitemap.ts` — dynamic: homepage, `/shop`, and every non-archived product, with `lastModified` from `updatedAt`.
- `/cart`, `/checkout`, `/checkout/success` carry `robots: { index: false }` (belt-and-suspenders with robots.txt).
- `SITE_URL` (`lib/site.ts`) drives all absolute URLs; set `SITE_URL` env in production.

**Metadata (App Router Metadata API)**
- Root layout: title template, description, canonical base (`metadataBase`), default Open Graph + Twitter card, `robots`, `themeColor`, icons.
- Product pages: dynamic title/description, `alternates.canonical`, per-product OG/Twitter image.
- Shop: canonical consolidated to `/shop` so `?category`/`?q`/`?sort` facets don't create duplicate URLs.

**Structured data (JSON-LD, real data only)**
- Site-wide: `Organization` (logo, socials) + `WebSite` with `SearchAction` (→ `/shop?q=`).
- Product pages: `Product` + `Offer` (real price, USD, in/out-of-stock, condition) + `BreadcrumbList`.
- `AggregateRating` / `Review` are emitted **only when real `Review` rows exist** — never fabricated.
- Shop: `CollectionPage` + `BreadcrumbList`.
- Validate with Google's [Rich Results Test](https://search.google.com/test/rich-results) after deploy.

## Deliberately NOT done (needs data, content, or a decision — not code)

| Requirement | Why it's blocked | To unblock |
|---|---|---|
| ~~Google Merchant Center product feed~~ | ✅ **Done** — `Product` now has optional `brand`/`gtin`/`mpn`/`condition`/`googleProductCategory` (admin-editable), and `/feed/google` emits an RSS 2.0 Merchant feed for every product. Products without a GTIN/brand ship with `identifier_exists=no`. Enter identifiers in the admin product form to strengthen listings. | — |
| Fake "sale" in Offer markup | The "$5 off" old price is display-only marketing, not a real discount. Emitting it as `salePrice`/`priceValidUntil` would be deceptive-pricing markup (policy violation). | Decide whether the sale is real; if real, store the true original price. |
| Per-product long description / specs / FAQ / buying guide | Model has one `description` field. Auto-generating specs/FAQs for real physical products would be fabrication. | Add fields + write real copy (or an admin content editor). |
| Blog | No blog system exists. Writing articles about products the store actually sells needs real product/domain knowledge. | Build a `Post` model + editor, then commission content. |
| `FAQPage` structured data | No FAQ content exists to mark up. | Add real FAQs first. |
| GA4 / GTM / conversion tracking | Needs a Measurement ID (business account) and a cookie-consent decision (privacy). | Provide `NEXT_PUBLIC_GA_ID`; then wire GA + consent banner. |
| Image → WebP/AVIF conversion | `next/image` already serves WebP/AVIF + responsive sizes + lazy loading automatically on Vercel. Source PNGs (`hero_section1.png`, `product_hero.png` ~2 MB) are large but only affect origin/build, not delivered bytes. | Optional: re-export sources as compressed WebP. |
| Lighthouse 95/100/100/100 | Can't be measured in this environment. | Run Lighthouse/PageSpeed against the deployed URL. |

## Post-deploy checklist
1. Set `SITE_URL` to the production origin.
2. Submit `https://<site>/sitemap.xml` in Google Search Console.
3. Run the Rich Results Test on a product URL — expect Product + Breadcrumbs valid, no errors.
4. Confirm `/cart`, `/checkout`, `/admin` are excluded in Search Console coverage.
