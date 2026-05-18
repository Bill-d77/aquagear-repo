import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { MapPin, Phone, User, CreditCard, Package, Search, ExternalLink } from "lucide-react";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/order-status";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Orders · AquaGear Admin",
};

const OPEN_STATUSES: OrderStatus[] = ["PENDING", "PLACED"];
const FILTER_OPTIONS = [
  { value: "OPEN", label: "Open (Pending + Placed)" },
  { value: "ALL", label: "All" },
  ...ORDER_STATUSES.map((s) => ({ value: s, label: s })),
] as const;

type SearchParams = Promise<{ status?: string; q?: string; from?: string; to?: string }>;

export default async function AdminOrders({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const statusFilter = sp.status || "OPEN";
  const q = (sp.q || "").trim();
  const from = sp.from ? new Date(sp.from) : null;
  const to = sp.to ? new Date(sp.to) : null;

  const where: Prisma.OrderWhereInput = {};
  if (statusFilter === "OPEN") {
    where.status = { in: OPEN_STATUSES };
  } else if (statusFilter !== "ALL" && ORDER_STATUSES.includes(statusFilter as OrderStatus)) {
    where.status = statusFilter;
  }
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phoneNumber: { contains: q } },
      { id: { startsWith: q.toLowerCase() } },
    ];
  }
  if ((from && !isNaN(from.getTime())) || (to && !isNaN(to.getTime()))) {
    where.createdAt = {
      ...(from && !isNaN(from.getTime()) ? { gte: from } : {}),
      ...(to && !isNaN(to.getTime()) ? { lte: to } : {}),
    };
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: true } }, user: true },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Orders</h1>
        <span className="text-sm text-gray-500">Showing {orders.length} {orders.length === 1 ? "order" : "orders"}</span>
      </div>

      {/* Filter bar */}
      <form className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 grid gap-3 md:grid-cols-5">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, phone, or order id…"
            className="w-full border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
          />
        </div>
        <select
          name="status"
          defaultValue={statusFilter}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <input
          name="from"
          type="date"
          defaultValue={sp.from || ""}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        />
        <input
          name="to"
          type="date"
          defaultValue={sp.to || ""}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        />
        <div className="md:col-span-5 flex gap-2">
          <button type="submit" className="btn-primary text-sm">Apply</button>
          <Link href="/admin/orders" className="btn-outline text-sm">Reset</Link>
        </div>
      </form>

      <div className="grid gap-6">
        {orders.map((o) => (
          <div key={o.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
              <div>
                <Link
                  href={`/admin/orders/${o.id}`}
                  className="font-semibold text-lg hover:text-sky-700 inline-flex items-center gap-1"
                >
                  Order #{o.id.slice(0, 8).toUpperCase()}
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
                <div className="text-sm text-gray-500">{new Date(o.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  o.status === 'PLACED' ? 'bg-green-100 text-green-700' :
                  o.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                  o.status === 'SHIPPED' ? 'bg-blue-100 text-blue-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {o.status}
                </span>
                <form action="/api/admin/orders/status" method="post" className="flex items-center gap-2">
                  <input type="hidden" name="id" value={o.id} />
                  <select name="status" defaultValue={o.status} className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    {ORDER_STATUSES.map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <button className="text-sm bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-md font-medium transition-colors">
                    Update
                  </button>
                </form>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 grid md:grid-cols-2 gap-8">
              {/* Customer Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <User className="w-4 h-4" /> Customer Details
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <User className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <span className="block font-medium text-gray-900">{o.name || "Guest"}</span>
                      <span className="text-gray-500">{o.user?.email || "No email provided"}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="text-gray-700">{o.phoneNumber || "No phone number"}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="text-gray-700">
                      <div>{o.location || "No location"}</div>
                      {o.apartment && <div className="text-gray-500">{o.apartment}</div>}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CreditCard className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="text-gray-700">Payment: <span className="font-medium">{o.paymentMode}</span></span>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Package className="w-4 h-4" /> Order Items
                </h3>
                <div className="border rounded-lg divide-y">
                  {o.items.map((item) => (
                    <div key={item.id} className="p-3 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-xs font-bold text-gray-500">
                          {item.quantity}x
                        </div>
                        <span className="font-medium text-gray-900">{item.product.name}</span>
                      </div>
                      <div className="text-gray-600">
                        ${(item.price / 100).toFixed(2)}
                      </div>
                    </div>
                  ))}
                  <div className="p-3 bg-gray-50 flex justify-between font-bold text-gray-900">
                    <span>Total</span>
                    <span>${(o.total / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {orders.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No orders match these filters</h3>
            <p className="text-gray-500 mb-4">Try widening the date range or switching the status filter.</p>
            <Link href="/admin/orders" className="btn-outline">Clear filters</Link>
          </div>
        )}
      </div>
    </div>
  );
}
