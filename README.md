# AquaGear4 E-Commerce Starter

Features
- Next.js 14 App Router
- Prisma with SQLite, ready for Postgres
- Credentials auth with NextAuth, roles user and admin
- Product catalog, product page, cart placeholder
- Admin dashboard with products CRUD
- Seed script with demo admin

Setup
1. Copy .env.example to .env
2. npm install
3. npx prisma migrate dev --name init
4. Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD
5. npm run seed
6. npm run dev

Production notes
- Target deployment is Vercel with Neon Postgres.
- Required production env vars: DATABASE_URL, AUTH_SECRET, and UPLOADTHING_TOKEN.
- SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, and optional SEED_ADMIN_NAME are required only when manually running npm run seed.
- Do not run seed or schema push during every deployment. Back up or branch Neon first, then run any required migrations/seeding explicitly.
- Vercel builds run Prisma client generation and Next.js build only.
