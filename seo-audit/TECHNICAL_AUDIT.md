# Technical SEO Audit — Iteration 1 (2026-07-17) — Score: 92/100

All checks run against https://aquagear-repo.vercel.app (live).

| Check | Result | Evidence |
|---|---|---|
| HTTPS + HTTP→HTTPS | ✅ 308 redirect | curl http:// → 308 https |
| HSTS | ✅ max-age=63072000; includeSubDomains | response header |
| HTTP/2 | ✅ | curl -I shows HTTP/2 |
| Compression | ✅ Brotli | content-encoding: br |
| robots.txt | ✅ allows all, disallows /admin /api /cart /checkout /account, sitemap ref | live fetch |
| sitemap.xml | ✅ dynamic, 25 URLs, lastmod from DB updatedAt, all 200 | crawl script |
| Canonicals | ✅ every page; /shop?category&q&sort consolidates to /shop | live HTML |
| Trailing slash | ✅ 308 to non-slash | curl /shop/ |
| 404 handling | ✅ real 404 status (page + product) | curl |
| Redirect chains/loops | ✅ none found | single-hop 308s only |
| Security headers | ✅ XFO, nosniff, Referrer-Policy, Permissions-Policy, CSP frame-ancestors | headers |
| Mixed content | ✅ none | all assets https |
| Font loading | ✅ woff2 preloaded via Link header | response header |
| GSC verification | ✅ google9ffba4b99f9ad970.html in /public | repo |
| OG image | ❌→fixed: /hero_section1.png was 404 | curl 404; now .jpg |
| Custom domain | ⚠️ none — ranking on *.vercel.app | — |
| bfcache | ⚠️ blocked (no-store on SSR pages) | Lighthouse |

Deductions: OG 404 (fixed this iteration), no custom domain, bfcache.
