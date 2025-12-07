import { prisma } from "@/lib/prisma";
import { DollarSign, Package, ShoppingBag, Users } from "lucide-react";

async function getStats() {
  const [productCount, orderCount, userCount, totalRevenue] = await Promise.all([
    prisma.product.count(),
    prisma.order.count(),
    prisma.user.count(),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { status: { not: "PENDING" } } // Only count completed/paid orders ideally
    })
  ]);

  return {
    productCount,
    orderCount,
    userCount,
    revenue: totalRevenue._sum.total || 0
  };
}

export default async function AdminDashboard() {
  const stats = await getStats();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h2>
        <p className="text-gray-500 mt-2">Overview of your store's performance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Revenue"
          value={`$${stats.revenue.toLocaleString()}`}
          icon={DollarSign}
          trend="+12.5% from last month"
        />
        <StatCard
          title="Orders"
          value={stats.orderCount.toString()}
          icon={ShoppingBag}
          trend="+4 new today"
        />
        <StatCard
          title="Products"
          value={stats.productCount.toString()}
          icon={Package}
          trend="12 low stock"
        />
        <StatCard
          title="Customers"
          value={stats.userCount.toString()}
          icon={Users}
          trend="+2 this week"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-semibold text-lg mb-4">Revenue Overview</h3>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center text-gray-400">
            Chart Placeholder
          </div>
        </div>
        <div className="col-span-3 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-semibold text-lg mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 pb-4 border-b last:border-0 last:pb-0">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                  ORD
                </div>
                <div>
                  <p className="font-medium text-sm">New order #102{i}</p>
                  <p className="text-xs text-gray-500">2 minutes ago</p>
                </div>
                <div className="ml-auto font-medium text-sm">$120.00</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, trend }: { title: string, value: string, icon: any, trend: string }) {
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
