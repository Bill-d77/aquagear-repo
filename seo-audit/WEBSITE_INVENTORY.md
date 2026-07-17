# Website Inventory — Iteration 1 (2026-07-17)

## Technology Stack (verified from repo + live headers)
- Framework: Next.js 16 (App Router, React 18), TypeScript
- Rendering: SSR (`force-dynamic` on all storefront pages — DB-driven)
- Hosting/CDN: Vercel (hobby plan), HTTP/2, Brotli
- Database: PostgreSQL (Neon serverless) via Prisma 5
- Auth: next-auth v5 beta (JWT), bcryptjs
- Media: UploadThing (utfs.io) for product images; next/image optimization
- Styling: Tailwind CSS 3; Analytics: @vercel/analytics + first-party /api/track
- Deploy: git push → GitHub (Bill-d77/aquagear-repo) → Vercel

## URL Inventory (from live sitemap.xml, all verified 200)
- / (priority 1), /shop (0.9), 23 × /product/[slug] (0.7)
- Non-sitemap public: /privacy-policy, /cookie-policy, /cart, /checkout, /account (noindex/disallowed)
- Feeds: /sitemap.xml (dynamic), /robots.txt, /feed/google (Merchant RSS 2.0)
- Admin: /admin/* (disallowed in robots, auth-gated)

## Crawl depth
Flat: every product is 2 clicks from home (home → shop → product). No orphans found — all sitemap URLs reachable via /shop grid.
