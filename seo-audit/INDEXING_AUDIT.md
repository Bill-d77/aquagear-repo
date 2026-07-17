# Indexing Audit — Iteration 1 (2026-07-17)

BLOCKED: Google Search Console data is not accessible from this environment.
GSC verification file exists in /public, so the property is likely verified.

What was verified without GSC:
- All 25 sitemap URLs return 200 and are self-canonical
- Noindex/disallow correctly covers /cart, /checkout, /account, /admin, /api
- site:aquagear-repo.vercel.app check — not run (needs browser search)

Owner actions for iteration 2:
1. Confirm sitemap submitted in GSC; export Coverage + Performance reports
2. Check "Crawled/Discovered — currently not indexed" counts
3. Note: *.vercel.app subdomains can be crawled slowly / deprioritized — a custom domain materially helps here.
