# Image SEO Audit — Iteration 1 (2026-07-17)

- next/image serves AVIF/WebP + responsive srcset + lazy loading automatically on Vercel ✅
- Homepage: 9/9 imgs have alt text ✅; product imgs use product name as alt ✅
- Hero has priority + sizes ✅
- Fixed this iteration: 1.5 MB PNG favicon → 24 KB icon-192.png; OG image 404 → real .jpg
- Product images live on utfs.io (UploadThing) — allowed in next.config remotePatterns, optimized through next/image ✅
- Optional: re-export hero_section1.jpg tighter (~58 KiB savings per Lighthouse); descriptive filenames for future uploads (current CDN hashes are fine — alt text carries the signal)
