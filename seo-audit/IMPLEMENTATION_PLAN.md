# Implementation Plan / Priority Matrix

## Done in iteration 1 (validate post-deploy)
| # | Issue | Sev | Fix | Validation |
|---|---|---|---|---|
| 1 | OG image 404 | High | .jpg path + dims | curl 200; share-preview renders |
| 2 | Title "AquaGear4" | Med | renamed | view-source |
| 3 | Contrast failures ×4 | Med | darker shades | Lighthouse a11y = 100 |
| 4 | Heading skip | Low | h3→h2 | Lighthouse |
| 5 | Hero LCP animation | Med | fade-up removed | LCP < 2.5 s |
| 6 | 1.5 MB favicon | Med | icon-192.png | network tab |

## Owner decisions needed (blocked on non-code input)
| # | Issue | Sev | Action | Effort | Expected gain |
|---|---|---|---|---|---|
| 7 | No custom domain | High | Buy domain, add to Vercel, set SITE_URL, 301s automatic | 1 h | Brand CTR + crawl priority; biggest single lever |
| 8 | Coming-soon products in feed/sitemap | Med | Archive in /admin until launch | 10 min | Avoid Merchant disapproval |
| 9 | storeName "AquaGear4" in DB | Med | Edit in /admin/settings | 2 min | Consistent brand in schema/header |
| 10 | Fake SALE badges (M1) | Med | Real original prices, or drop badge | decision | Policy risk removed |
| 11 | GSC access / sitemap submitted | High | Share exports or confirm | 15 min | Unblocks indexing audit |
| 12 | Product copy depth (specs/FAQs) | Med | Write real copy per product | days | Rich results + long-tail |

## Later (1–6 months)
- Category landing pages with own canonicals once catalog grows
- Blog/guides for informational + AI-Overview queries (Phase 20)
- FAQPage schema once real FAQs exist
- Full CSP with nonces
- GA4 + consent (needs measurement ID + privacy decision)
