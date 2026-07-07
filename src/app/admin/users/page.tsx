import { prisma } from "@/lib/prisma";
import { User as UserIcon, Mail, ShoppingBag, DollarSign } from "lucide-react";
import { RoleForm } from "@/components/admin/RoleForm";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Customers · AquaGear Admin",
};

const REVENUE_STATUSES = ["PLACED", "SHIPPED"];

export default async function AdminUsers({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  // Auth handled by /admin layout
  // ponytail: take 200 bounds the page; add search/pagination when the list outgrows it.
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      orders: {
        select: { total: true, status: true, createdAt: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Customers</h1>
        <span className="text-sm text-gray-500">{users.length} shown</span>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {users.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <UserIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No customers yet</h3>
          <p className="text-gray-500">When people sign up, they'll appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => {
            const revenueOrders = u.orders.filter((o) => REVENUE_STATUSES.includes(o.status));
            const totalSpent = revenueOrders.reduce((s, o) => s + o.total, 0);
            const lastOrder = u.orders.reduce<Date | null>((latest, o) => {
              return !latest || o.createdAt > latest ? o.createdAt : latest;
            }, null);

            return (
              <div key={u.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-wrap items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-700 flex items-center justify-center font-semibold shrink-0">
                  {u.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{u.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === "ADMIN" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700"}`}>
                      {u.role}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 flex items-center gap-1 truncate">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{u.email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-sm shrink-0">
                  <div className="flex items-center gap-1 text-gray-600" title="Total orders">
                    <ShoppingBag className="w-3.5 h-3.5" />
                    {u.orders.length}
                  </div>
                  <div className="flex items-center gap-1 text-gray-900 font-medium" title="Total spent (placed + shipped)">
                    <DollarSign className="w-3.5 h-3.5" />
                    {(totalSpent / 100).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-500 hidden md:block">
                    {lastOrder ? `Last ${new Date(lastOrder).toLocaleDateString()}` : "No orders"}
                  </div>
                </div>
                <RoleForm userId={u.id} currentRole={u.role} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
