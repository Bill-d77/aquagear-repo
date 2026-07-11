// Dashboard aggregates shared by the /admin page and /api/mobile/admin/dashboard.
import { prisma } from "@/lib/prisma";
import { LOW_STOCK_THRESHOLD } from "@/lib/admin";

export const REVENUE_STATUSES = ["PLACED", "SHIPPED"] as const;
export const STUCK_THRESHOLD_HOURS = 24;

export type RevenueChartPoint = { date: string; revenue: number };

export async function getDashboardData() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const stuckCutoff = new Date(now.getTime() - STUCK_THRESHOLD_HOURS * 60 * 60 * 1000);

  const [
    productCount,
    revenueThis30,
    revenuePrev30,
    ordersThis30,
    ordersPrev30,
    usersThis30,
    usersPrev30,
    lowStockCount,
    stuckPlacedCount,
    recentOrders,
    revenueByDay,
  ] = await Promise.all([
    prisma.product.count({ where: { isArchived: false } }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: thirtyDaysAgo } },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
    }),
    // PENDING rows are live/abandoned carts, not orders — exclude them from
    // order counts and recents (revenue above already filters).
    prisma.order.count({ where: { status: { not: "PENDING" }, createdAt: { gte: thirtyDaysAgo } } }),
    prisma.order.count({ where: { status: { not: "PENDING" }, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    prisma.product.count({ where: { isArchived: false, stock: { lt: LOW_STOCK_THRESHOLD } } }),
    prisma.order.count({ where: { status: "PLACED", placedAt: { lt: stuckCutoff } } }),
    prisma.order.findMany({
      where: { status: { not: "PENDING" } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, name: true, total: true, status: true, createdAt: true },
    }),
    prisma.order.findMany({
      where: { status: { in: [...REVENUE_STATUSES] }, createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, total: true },
    }),
  ]);

  // Bucket revenueByDay into ISO-day strings (cheaper to do in JS for a small store
  // than to drop to raw SQL with DATE_TRUNC).
  const dailyMap = new Map<string, number>();
  for (let i = 0; i < 30; i++) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    dailyMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const o of revenueByDay) {
    const key = o.createdAt.toISOString().slice(0, 10);
    dailyMap.set(key, (dailyMap.get(key) || 0) + o.total);
  }
  const chartData: RevenueChartPoint[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }));

  return {
    productCount,
    revenueThis30: revenueThis30._sum.total || 0,
    revenuePrev30: revenuePrev30._sum.total || 0,
    ordersThis30,
    ordersPrev30,
    usersThis30,
    usersPrev30,
    lowStockCount,
    stuckPlacedCount,
    recentOrders,
    chartData,
  };
}
