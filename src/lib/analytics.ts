// Admin analytics, computed entirely from data we actually store: Orders,
// Users, OrderItems, Products. Nothing here is estimated or fabricated — every
// number traces to a DB row. Visitor/device/geo/heatmap/UTM analytics are NOT
// here because there is no event pipeline; that data lives in Vercel Web
// Analytics (pageviews/devices/geo) or would need an events table to build.
import { prisma } from "@/lib/prisma";

export type RangeKey = "today" | "7d" | "30d" | "90d" | "ytd";

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "ytd", label: "This year" },
];

const REVENUE_STATUSES = ["PLACED", "SHIPPED"];

export function rangeStart(key: RangeKey, now = new Date()): Date {
  const d = new Date(now);
  switch (key) {
    case "today": d.setHours(0, 0, 0, 0); return d;
    case "7d": d.setDate(d.getDate() - 7); return d;
    case "90d": d.setDate(d.getDate() - 90); return d;
    case "ytd": return new Date(now.getFullYear(), 0, 1);
    case "30d":
    default: d.setDate(d.getDate() - 30); return d;
  }
}

/** Top-N counts for one PageView column within a range. */
async function topBy(
  field: "path" | "country" | "device" | "browser" | "referrer",
  start: Date,
  take = 8,
) {
  const rows = await prisma.pageView.groupBy({
    by: [field],
    where: { createdAt: { gte: start }, [field]: { not: null } },
    _count: { _all: true },
    // Order by the grouped field's count — aggregate orderBy may only reference
    // fields present in `by` (ordering by `id` here throws at runtime).
    orderBy: { _count: { [field]: "desc" } },
    take,
  });
  return rows.map((r) => ({ label: String(r[field] ?? "Unknown"), count: r._count._all }));
}

/** First-party traffic stats (consent-gated pageview log). */
export async function getTraffic(range: RangeKey) {
  const start = rangeStart(range);
  const [pageviews, visitors, topPages, countries, devices, browsers, referrers] = await Promise.all([
    prisma.pageView.count({ where: { createdAt: { gte: start } } }),
    prisma.pageView.findMany({
      where: { createdAt: { gte: start }, anonId: { not: null } },
      distinct: ["anonId"],
      select: { anonId: true },
    }).then((r) => r.length),
    topBy("path", start, 10),
    topBy("country", start),
    topBy("device", start),
    topBy("browser", start),
    topBy("referrer", start),
  ]);
  return { pageviews, visitors, topPages, countries, devices, browsers, referrers };
}

export async function getAnalytics(range: RangeKey) {
  const now = new Date();
  const start = rangeStart(range, now);
  const inRange = { gte: start, lte: now };

  const [
    revenueAgg,
    ordersCount,
    cartsCreated,
    shippedCount,
    newCustomers,
    registeredOrders,
    revenueRows,
    itemRows,
    customerRows,
    repeatCustomers,
  ] = await Promise.all([
    // Revenue: only realised orders.
    prisma.order.aggregate({ _sum: { total: true }, where: { status: { in: REVENUE_STATUSES }, createdAt: inRange } }),
    // Orders placed in range (excludes live/abandoned carts).
    prisma.order.count({ where: { status: { not: "PENDING" }, createdAt: inRange } }),
    // Every order starts life as a PENDING cart, so createdAt-in-range = carts started.
    prisma.order.count({ where: { createdAt: inRange } }),
    prisma.order.count({ where: { status: "SHIPPED", createdAt: inRange } }),
    prisma.user.count({ where: { createdAt: inRange } }),
    prisma.order.count({ where: { status: { not: "PENDING" }, createdAt: inRange, userId: { not: null } } }),
    prisma.order.findMany({
      where: { status: { in: REVENUE_STATUSES }, createdAt: inRange },
      select: { createdAt: true, total: true },
    }),
    // Line items on realised orders in range → best sellers.
    prisma.orderItem.findMany({
      where: { order: { status: { in: REVENUE_STATUSES }, createdAt: inRange } },
      select: { quantity: true, price: true, product: { select: { id: true, name: true, slug: true } } },
    }),
    // Realised orders with a customer → top customers.
    prisma.order.findMany({
      where: { status: { in: REVENUE_STATUSES }, createdAt: inRange, userId: { not: null } },
      select: { total: true, user: { select: { id: true, name: true, email: true } } },
    }),
    // All-time: customers with more than one realised order (returning buyers).
    prisma.order.groupBy({
      by: ["userId"],
      where: { status: { in: REVENUE_STATUSES }, userId: { not: null } },
      _count: { _all: true },
    }),
  ]);

  const revenue = revenueAgg._sum.total ?? 0;
  const orders = ordersCount;
  const aov = orders > 0 ? Math.round(revenue / orders) : 0;
  const conversion = cartsCreated > 0 ? Math.round((orders / cartsCreated) * 100) : 0;

  // Daily revenue buckets across the range.
  const dayCount = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / 86400000));
  const daily = new Map<string, number>();
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(now.getTime() - i * 86400000);
    daily.set(d.toISOString().slice(0, 10), 0);
  }
  for (const r of revenueRows) {
    const k = r.createdAt.toISOString().slice(0, 10);
    if (daily.has(k)) daily.set(k, (daily.get(k) ?? 0) + r.total);
  }
  const chart = [...daily.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, revenue]) => ({ date, revenue }));

  // Best sellers.
  const prodMap = new Map<string, { name: string; slug: string; units: number; revenue: number }>();
  for (const it of itemRows) {
    const p = prodMap.get(it.product.id) ?? { name: it.product.name, slug: it.product.slug, units: 0, revenue: 0 };
    p.units += it.quantity;
    p.revenue += it.price * it.quantity;
    prodMap.set(it.product.id, p);
  }
  const bestSellers = [...prodMap.values()].sort((a, b) => b.units - a.units).slice(0, 8);

  // Top customers.
  const custMap = new Map<string, { name: string; email: string; spent: number; orders: number }>();
  for (const o of customerRows) {
    if (!o.user) continue;
    const c = custMap.get(o.user.id) ?? { name: o.user.name, email: o.user.email, spent: 0, orders: 0 };
    c.spent += o.total;
    c.orders += 1;
    custMap.set(o.user.id, c);
  }
  const topCustomers = [...custMap.values()].sort((a, b) => b.spent - a.spent).slice(0, 8);

  const returningCustomers = repeatCustomers.filter((c) => c._count._all > 1).length;

  return {
    revenue,
    orders,
    aov,
    conversion,
    cartAbandonment: 100 - conversion,
    cartsCreated,
    shippedCount,
    newCustomers,
    registeredOrders,
    guestOrders: orders - registeredOrders,
    returningCustomers,
    chart,
    bestSellers,
    topCustomers,
  };
}
