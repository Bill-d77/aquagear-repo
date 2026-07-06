# AquaGear4 E-Commerce

Marine, watersports, and beach equipment storefront for Lebanon.

## Features
- Next.js 16 App Router, React 18, Tailwind CSS 3
- Prisma ORM — SQLite for local dev; switch `datasource` provider to `postgresql` for production (Neon)
- Credentials auth with NextAuth v5 (USER / ADMIN roles)
- Storefront: home, shop with search/filter/sort, product pages with image gallery, cart, mobile-first checkout (COD, flat delivery fee with free delivery over $70)
- Customer accounts with order history
- Admin dashboard: products CRUD with UploadThing images, categories, orders, users, store settings (incl. delivery fee)
- JSON API for the iOS app under `/api/mobile` (JWT auth, products, orders, reviews)
- Telegram notification to the admin on each new order
- Seed script with demo admin

## Setup
1. Copy `.env.example` to `.env`
2. `npm install`
3. `npx prisma migrate dev`
4. Set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`, then `npm run seed`
5. `npm run dev`

## Production notes
- Target deployment is Vercel; database is Neon Postgres (set the Prisma provider accordingly).
- Required env vars: `DATABASE_URL`, `AUTH_SECRET`, `UPLOADTHING_TOKEN`. Optional: `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` (order alerts), `SITE_URL` (canonical URLs).
- Do not run seed or schema push during deployments. Back up or branch Neon first, then run migrations explicitly (`npx prisma migrate deploy`).
- Vercel builds run Prisma client generation and Next.js build only.

## Tests
`node --test src/lib/telegram.test.ts`
