import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DollarSign, Package, ShoppingBag, Users, AlertTriangle, Clock } from "lucide-react";
import { RevenueChart, type RevenueChartPoint } from "@/components/admin/RevenueChart";
import { LOW_STOCK_THRESHOLD } from "@/lib/admin";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dashboard · AquaGear Admin",
};

const REVENUE_STATUSES = ["PLACED", "SHIPPED"] as const;
const STUCK_THRESHOLD_HOURS = 24;

async function getDashboardData() {
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

function trendLabel(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? "No change vs prior period" : "New activity this period";
  }
  const delta = ((current - previous) / previous) * 100;
  const sign = delta >= 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)}% vs prior 30d`;
}

export default async function AdminDashboard() {
  const data = await getDashboardData();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h2>
        <p className="text-gray-500 mt-2">Last 30 days, compared to the prior 30.</p>
      </div>

      {(data.stuckPlacedCount > 0 || data.lowStockCount > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {data.stuckPlacedCount > 0 && (
            <Link
              href="/admin/orders?status=PLACED"
              className="flex items-center gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 hover:bg-amber-100 transition-colors"
            >
              <Clock className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">
                  {data.stuckPlacedCount} placed order{data.stuckPlacedCount === 1 ? "" : "s"} waiting &gt;{STUCK_THRESHOLD_HOURS}h
                </div>
                <div className="text-sm text-amber-800">Click to review and ship.</div>
              </div>
            </Link>
          )}
          {data.lowStockCount > 0 && (
            <Link
              href="/admin/products?lowStock=1"
              className="flex items-center gap-3 p-4 rounded-lg bg-red-50 border border-red-200 text-red-900 hover:bg-red-100 transition-colors"
            >
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div className="flex-1">
                <div className="font-semibold">
                  {data.lowStockCount} product{data.lowStockCount === 1 ? "" : "s"} low on stock
                </div>
                <div className="text-sm text-red-800">Click to view items below {LOW_STOCK_THRESHOLD} units.</div>
              </div>
            </Link>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Revenue (30d)"
          value={`$${(data.revenueThis30 / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          icon={DollarSign}
          trend={trendLabel(data.revenueThis30, data.revenuePrev30)}
        />
        <StatCard
          title="Orders (30d)"
          value={data.ordersThis30.toString()}
          icon={ShoppingBag}
          trend={trendLabel(data.ordersThis30, data.ordersPrev30)}
        />
        <StatCard
          title="Active Products"
          value={data.productCount.toString()}
          icon={Package}
          trend={data.lowStockCount > 0 ? `${data.lowStockCount} below ${LOW_STOCK_THRESHOLD} stock` : "All stock levels healthy"}
        />
        <StatCard
          title="New Customers (30d)"
          value={data.usersThis30.toString()}
          icon={Users}
          trend={trendLabel(data.usersThis30, data.usersPrev30)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Revenue (last 30 days)</h3>
            <span className="text-xs text-gray-500">Daily, PLACED + SHIPPED only</span>
          </div>
          <RevenueChart data={data.chartData} />
        </div>
        <div className="col-span-3 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-lg">Recent orders</h3>
            <Link href="/admin/orders" className="text-xs text-sky-700 hover:underline">View all</Link>
          </div>
          {data.recentOrders.length === 0 ? (
            <p className="text-sm text-gray-500">No orders yet.</p>
          ) : (
            <div className="space-y-4">
              {data.recentOrders.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/orders/${o.id}`}
                  className="flex items-center gap-4 pb-4 border-b last:border-0 last:pb-0 hover:bg-gray-50 -mx-2 px-2 py-1 rounded transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                    {o.status[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{o.name || "Guest"}</p>
                    <p className="text-xs text-gray-500">
                      #{o.id.slice(0, 8).toUpperCase()} · {new Date(o.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="font-medium text-sm shrink-0">${(o.total / 100).toFixed(2)}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend }: { title: string; value: string; icon: React.ComponentType<{ className?: string }>; trend: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
      <div className="flex items-center justify-between space-y-0 pb-2">
        <h3 className="tracking-tight text-sm font-medium text-gray-500">{title}</h3>
        <Icon className="h-4 w-4 text-gray-400" />
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <p className="text-xs text-gray-500 mt-1">{trend}</p>
      </div>
    </div>
  );
}
