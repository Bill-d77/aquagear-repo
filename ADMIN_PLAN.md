# AquaGear Admin — Redesign & Features Plan

**Author:** review based on the working tree at commit `753ccfa` (2026-05-18)
**Scope:** polish the existing admin shell and add features. No ground-up redesign — the current sidebar/page layout in `src/app/admin/layout.tsx` is kept.
**Audience:** Bill / solo-developer pace. Phasing is sized for incremental shipping, not a multi-engineer rewrite.

---

## 1. Honest read of the current admin

The admin section has good bones — server-side auth gate at `src/app/admin/layout.tsx:13`, a working orders page with status updates, a real product CRUD wired through `src/app/api/admin/products/{create,update}/route.ts`, and a Prisma schema that's actually reasonable. What's missing isn't structural; it's that the dashboard is mostly cosmetic and several core operator workflows are unsupported.

**What's real and works:**

`/admin/orders` is the strongest page. Each order card has customer details (name, email, phone, location, apartment), the full item list with quantities and prices, the order total, and a status dropdown that posts to `/api/admin/orders/status`. The status enum lives in `src/lib/order-status.ts` as `PENDING → PLACED → SHIPPED → CANCELED`. `/admin/products` lists products (filtered by `isArchived: false`) with edit + delete actions; the delete action in `src/app/admin/products/actions.ts` is well-designed: it tries `prisma.product.delete` first and falls back to `isArchived = true` when the product has associated orders or reviews (Prisma error code `P2003`). `/admin/users` lets you toggle the role between `USER` and `ADMIN`.

**What's stubbed or fake:**

The dashboard at `src/app/admin/page.tsx` is the biggest gap. The four stat cards compute real values (`productCount`, `orderCount`, `userCount`, and revenue summed across `PLACED` and `SHIPPED`) but the **trend strings** under each card are hardcoded lies: `"+12.5% from last month"`, `"+4 new today"`, `"12 low stock"`, `"+2 this week"` — those are static prop values. The "Revenue Overview" panel is literally a `<div>` that says "Chart Placeholder" against a gray background. The "Recent Activity" panel maps over `[1, 2, 3]` and renders fake orders `#1021`, `#1022`, `#1023` at `$120.00` each, "2 minutes ago" — none of this comes from the database. Anyone landing on the dashboard for the first time will see plausible-looking numbers next to total fiction, which is worse than no dashboard.

**What's missing entirely:**

There is no search or filter on any list page — `/admin/products` and `/admin/orders` show every row, sorted only by `createdAt desc`. No pagination either. There is no customer view: `/admin/users` shows users but doesn't let you see a customer's order history, total spend, or contact details in one place. The `Review` model is fully scaffolded in `prisma/schema.prisma` (rating, comment, userId, productId) but has zero UI — no place to read reviews, moderate them, or display them on product pages. Categories exist in the schema but there's no admin UI for them; they're created only by the seed script. There's no settings page, so the WhatsApp number, store name, and business info are hardcoded across multiple files (the audit already flagged this).

**Recurring code-quality issues across admin pages:**

Every page repeats the same auth check: `const role = (session?.user as any)?.role; if (role !== "ADMIN") return <p>Access denied.</p>`. This is dead code — `src/app/admin/layout.tsx` already redirects non-admins at the layout level, so children never render for non-admins. The duplicate checks should come out. The `as any` casts are the same audit finding as before; extending the NextAuth `Session` and `JWT` types in `src/types.d.ts` once would let them disappear from every file.

---

## 2. Polish (no new features — just fixes to what's there)

These are the cheapest wins and should ship first. None require schema changes.

**Kill the dashboard fiction.** Either compute real trends and a real chart, or remove the fake elements until they have backing data. The "Recent Activity" panel should query `prisma.order.findMany({ orderBy: { createdAt: 'desc' }, take: 5 })` and render those. The "Chart Placeholder" should become a real revenue-by-day chart (recharts is already used elsewhere if you want to keep dependencies tight; otherwise a small SVG works). Each stat card's trend string should be a real delta (compute "this period vs. previous period" and render the percentage), or omit the trend line entirely.

**Remove duplicate auth checks.** Drop the `if (role !== "ADMIN") return <p>Access denied.</p>` blocks from `src/app/admin/orders/page.tsx`, `src/app/admin/products/page.tsx`, `src/app/admin/users/page.tsx`, `src/app/admin/products/new/page.tsx`, and `src/app/admin/products/edit/[id]/page.tsx`. The layout already protects them. While you're in there, also drop the `(session?.user as any)?.role` casts — replace with a typed session by extending `next-auth` module declarations in `src/types.d.ts`.

**Search + filter on `/admin/products`.** Add a search box (filters by name or slug, server-side via a `where: { name: { contains: q, mode: 'insensitive' } }`), a category dropdown filter, and a "show archived" toggle. Add pagination (or, cheaper: cap at 50 rows and add a "load more" link). The current page becomes unusable past 100 products.

**Search + filter on `/admin/orders`.** Filter by status (PENDING/PLACED/SHIPPED/CANCELED), date range, and search by customer name, phone, or last 4 of order id. Default view should be "open orders" (PENDING + PLACED), not all-time. This is the page the operator looks at most; making it scannable is the highest-leverage UX fix in the whole admin.

**Empty states.** `/admin/orders` has a good empty state; `/admin/products` and `/admin/users` don't. Match the pattern.

**Visual consistency.** `/admin/products` uses a plain row layout while `/admin/orders` uses card design with header/body/footer. Bring `/admin/products` and `/admin/users` up to the same card style for consistency. Same goes for the new/edit product forms — they currently use a plain `card` class with stacked inputs; they'd benefit from labeled fields (the current `placeholder`-only labels are an accessibility issue) and a left-aligned section structure.

**Price input clarity.** The new/edit product form's price field is labeled "Price in cents" and stores cents (`Int`) directly. This is technically correct (avoids float math) but every other admin reading the form will be confused. Either accept dollars in the UI and multiply by 100 server-side, or keep cents but label the field with a clear example: "Price (cents — e.g., 1500 = $15.00)". The first option is friendlier.

---

## 3. New features, grouped by business outcome

You said all four outcomes matter. Here are the highest-value features in each, with implementation sketches that name the actual files and Prisma models involved. Pick from this list; you don't have to do all of them.

### 3a. Order fulfillment

This is the operator's daily loop. AquaGear is COD-driven and ships physical goods, so anything that reduces friction between "order placed" and "package out the door" is direct ROI.

**Order detail page (`/admin/orders/[id]`).** The current orders index renders everything in cards — fine for a glance, but bad for any order that needs follow-up. A dedicated detail page lets you fit more: full address with a Google Maps "open in maps" link, a per-order WhatsApp button that opens chat with the customer prefilled with `"Hi {name}, calling about order #{shortId}..."`, internal admin notes (new field on `Order`), and a status timeline. Schema add: `Order.notes String?` and `Order.statusHistory` either as a JSON column or a new `OrderStatusChange` table with `(orderId, status, changedAt, changedByUserId)`.

**Status timestamps.** Add `Order.placedAt DateTime?`, `Order.shippedAt DateTime?`, `Order.canceledAt DateTime?` and have the status-change endpoint (`src/app/api/admin/orders/status/route.ts`) write the corresponding timestamp when status transitions. Lets you measure "time to ship" and surface stuck orders.

**Stuck-orders queue.** A small panel on the dashboard (or a tab on `/admin/orders`) that shows orders in `PLACED` status for >24 hours, sorted oldest first. This is the single most actionable metric for a COD store — every stuck order is a customer waiting.

**Carrier / tracking number.** Add `Order.trackingNumber String?` and `Order.carrier String?` to the schema. Display in the order detail page; optionally include in the customer-facing order confirmation (out of admin scope but worth noting).

**WhatsApp contact log.** When the operator clicks the WhatsApp button on an order, optimistically mark it as "contacted" with a timestamp. Stored as `Order.lastContactedAt DateTime?`. Helps with the "did I already call this customer?" problem when the queue grows.

### 3b. Inventory & stock

**Low-stock view.** A new page at `/admin/products/low-stock` (or a tab on the existing products page) that lists products where `stock < threshold`. Threshold could be a constant (e.g., 5) initially, or per-category, or per-product (add `Product.lowStockThreshold Int?` with a category-level default fallback). Sort by stock ascending so the most urgent items are at the top.

**Stock dashboard card.** Replace the fake "12 low stock" trend string on the dashboard with a real count from the same query. Link the stat card to `/admin/products/low-stock`.

**Bulk stock update.** Two flavors. The simpler one: an "edit stock" inline input on the products list with a small "save" button per row. The richer one: a "bulk update" mode that turns the list into editable rows and submits stock changes for many products at once. Start with the simpler one; the bulk version can come later. Server endpoint: `POST /api/admin/products/stock-bulk` that accepts an array of `{ id, stock }` and validates each.

**Stock history (optional, phase 3).** New table `StockChange(productId, delta, reason, changedAt, changedByUserId)`. Reasons: `'manual_adjust' | 'order_placed' | 'order_canceled' | 'restock'`. Hook order placement and cancellation to write entries. Lets you answer "where did the stock go" when reconciling.

**Category management UI.** `/admin/categories` — list, rename, create, delete categories. Currently categories are seeded from `prisma/seed.mjs` and never editable. Delete should be guarded the same way `deleteProduct` is (catch `P2003`, fall back to archiving or refuse with a clear message).

**Archived products view.** The current `/admin/products` filters `isArchived: false`. Add a toggle to view archived products, with an "unarchive" action. Archived products are otherwise invisible after the audit cleanup.

### 3c. Sales analytics

These need real charts. Recommend `recharts` (the audit already mentioned it as an available React option, and `lucide-react` is already a dependency from the same ecosystem). All of these go on the dashboard, replacing the current placeholder.

**Revenue over time.** Daily revenue for the last 30 days as a line chart. Query: `prisma.order.groupBy({ by: ['createdAt'], where: { status: { in: ['PLACED', 'SHIPPED'] }, createdAt: { gte: thirtyDaysAgo } }, _sum: { total: true } })` — though `groupBy` on a `DateTime` is per-row, so you'll want to either truncate in SQL via `prisma.$queryRaw` (`DATE_TRUNC('day', "createdAt")`) or fetch rows and bucket in JS. For a small store, fetch-and-bucket in JS is fine.

**Top products.** Best-selling products by units sold and by revenue, over a configurable window (30 / 90 days). Query joins `OrderItem` to `Order` and groups by `productId`. Two side-by-side bar charts or a single table with two sortable columns.

**Order status funnel.** Counts of orders by current status — `PENDING / PLACED / SHIPPED / CANCELED`. Shows where the bottleneck is. If `PENDING` is much larger than `PLACED`, your checkout has friction. If `PLACED` is much larger than `SHIPPED`, your fulfillment is the bottleneck.

**Conversion metric (lightweight).** Without tracking pageviews this is approximate, but: `% of users who have ever placed an order` is computable today. `count(distinct order.userId) / count(user)`. Single stat card.

**Revenue trend deltas.** Replace each dashboard stat card's hardcoded trend with a real period-over-period comparison: "Revenue this 30d vs previous 30d", showing absolute change and percentage. Same pattern for orders and new customer signups.

### 3d. Customer engagement

**Customer detail page (`/admin/customers/[id]`).** Single view that aggregates everything about one user: contact info, all orders chronologically, total lifetime spend (sum of `PLACED + SHIPPED` orders), average order value, last order date, days since last order. Add a "send WhatsApp" button that pre-fills a message and opens wa.me. Rename `/admin/users` to `/admin/customers` since "users" is engineer-speak; "customers" is what AquaGear actually has.

**Customer list with stats.** Augment `/admin/users` (now `/admin/customers`) so each row shows order count, total spent, and last order date — not just name, email, and role. Lets you find your best customers at a glance.

**Reviews moderation page (`/admin/reviews`).** The `Review` model is in the schema but nothing consumes it. Build the moderation UI even before the public-facing review submission, so you're ready when reviews start coming in. Page lists reviews with product, customer, rating, and comment; actions are "approve / hide / delete." Schema add: `Review.status String @default("PENDING")` with values `PENDING / APPROVED / HIDDEN`. The shop product page would then filter to `status: 'APPROVED'` only.

**Customer notes.** `User.adminNotes String?` — operator-only field, plain text, free-form. Useful for "called twice, no answer" or "VIP, expedite all orders."

**Saved customer search.** Less critical, but if you find yourself filtering for the same things repeatedly (e.g., "customers in Beirut who haven't ordered in 60 days"), add a saved-search feature. Phase 3+ thing.

---

## 4. Cross-cutting improvements

These touch multiple areas and shouldn't be slotted into a single feature.

**Settings page (`/admin/settings`).** New `StoreSettings` model with a single row pattern: `{ id: "singleton", storeName, whatsappNumber, shippingFlatRate, businessHoursStart, businessHoursEnd, ... }`. Move the hardcoded `96171634379` from all 5 files into this row, with a typed helper `getStoreSettings()` that reads it once and caches in module scope. Same pattern for the homepage hero copy, shipping fee (currently nowhere in the data model), and any other config the operator should be able to change without redeploying.

**Type the session role once.** In `src/types.d.ts`, declare:
```ts
declare module "next-auth" {
  interface Session { user: { id: string; name?: string; email?: string; role: "USER" | "ADMIN"; }; }
}
declare module "next-auth/jwt" {
  interface JWT { role: "USER" | "ADMIN"; }
}
```
Then update `src/lib/auth.ts` to write the typed shape and remove every `as any` cast across the admin codebase. Lift the inline auth-check pattern into a `requireAdmin()` helper in `src/lib/admin.ts` that throws/redirects, so route handlers don't repeat the pattern either.

**Audit polish carryover.** The medium/low audit items that touch admin: image sizing mismatch on the shop page (also affects admin products list — fetched at 600x400, rendered at 48x48), proper `favicon.ico`, page-specific metadata on admin routes. Worth folding in alongside the redesign rather than as a separate sweep.

**Audit log.** A simple `AdminAction(actorId, action, targetType, targetId, metadata, at)` table to record every product edit, order status change, role change, and review moderation. Defensive against "who archived this product?" forensics, especially as more admins get added.

---

## 5. Phased rollout

A realistic order assuming you're shipping a few hours at a time, not a sprint.

**Phase 1 — Polish (1-2 sessions).** Strip the fake dashboard, ship real "recent orders" panel and one real chart (recommend revenue-over-time). Add search/filter to `/admin/products` and `/admin/orders`. Remove duplicate auth checks. Type the session role and drop `as any`. Card-ify `/admin/products` and `/admin/users` to match `/admin/orders` style. Bring in the deferred audit polish (image sizing, favicon, metadata).

**Phase 2 — Fulfillment + inventory core (2-3 sessions).** Order detail page with notes, status timestamps, WhatsApp log. Stuck-orders queue on dashboard. Low-stock view + dashboard count. Category management UI. Settings page (replaces hardcoded WhatsApp number — also closes an audit item).

**Phase 3 — Analytics + customers (3-5 sessions).** Top-products and status-funnel charts. Customer detail page and renamed /admin/customers with lifetime stats. Customer notes field. Conversion metric stat card. Real trend deltas on the existing stat cards.

**Phase 4 — Reviews + extras (whenever).** Reviews moderation page. Audit log table. Stock history table. Bulk stock update.

Anything beyond phase 4 (multi-admin permissions with roles beyond `USER/ADMIN`, exports, saved searches, broadcasts) is out of scope for this round but can be lifted into a future plan once the core is stable.

---

## 6. Open questions for you

A few decisions I'd want to make explicitly before phase 1 starts. None are blocking the plan itself, but they shape the implementation.

Whether to invest in the `recharts` dependency, or stay dependency-free and render SVG charts manually for the volume you currently have. Recharts adds ~50KB gzipped; manual SVG is a couple hours of work to get one good chart component you can reuse. For 4-5 chart types, recharts is the right call.

Whether the settings table should be a singleton row in Postgres, or a static `config.ts` file in the repo. Singleton row is more flexible (edit without deploy) but adds a query; config file is simpler but requires deploys for changes. Recommend singleton row — the WhatsApp number changing without a redeploy is a legitimate need.

Whether to add the `Review.status` field and reviews moderation before the public-facing review submission exists. Recommend yes — the moderation UI is independently useful for seeded fake reviews if you want to bootstrap social proof, and it means you're not racing to ship moderation under pressure when real reviews start arriving.

---

## Appendix — Files this plan would touch

For estimation. Not exhaustive, but the main hits:

- `src/app/admin/page.tsx` — rewrite, replace placeholders with real queries and charts
- `src/app/admin/orders/page.tsx` — add filters + search + pagination
- `src/app/admin/orders/[id]/page.tsx` — **new**, detail view
- `src/app/admin/products/page.tsx` — add filters + search + low-stock toggle
- `src/app/admin/products/low-stock/page.tsx` — **new** (or a tab on the products page)
- `src/app/admin/categories/page.tsx` — **new**
- `src/app/admin/customers/page.tsx` — rename + augment from `users/page.tsx`
- `src/app/admin/customers/[id]/page.tsx` — **new**
- `src/app/admin/reviews/page.tsx` — **new**
- `src/app/admin/settings/page.tsx` — **new**
- `src/components/admin/AdminSidebar.tsx` — add new nav entries
- `src/app/api/admin/orders/status/route.ts` — write timestamp on status transition
- `src/app/api/admin/orders/[id]/notes/route.ts` — **new**
- `src/app/api/admin/products/stock-bulk/route.ts` — **new**
- `src/app/api/admin/categories/*` — **new**
- `src/app/api/admin/settings/route.ts` — **new**
- `prisma/schema.prisma` — add `Order.notes`, status timestamps, `Order.trackingNumber`, `Order.carrier`, `Order.lastContactedAt`, `Review.status`, `User.adminNotes`, optional `StoreSettings`, optional `AdminAction`, optional `StockChange`
- `src/lib/admin.ts` — add `requireAdmin()` helper
- `src/types.d.ts` — extend `next-auth` Session/JWT types
- New migration files in `prisma/migrations/`
