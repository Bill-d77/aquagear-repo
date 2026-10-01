import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { MapPin, Phone, User, CreditCard, Package, Search, ExternalLink } from "lucide-react";
import { ORDER_STATUSES, DRAFT_STATUSES, ORDER_SOURCES, isDraftStatus } from "@/lib/order-status";
import { SourceBadge, StatusBadge, statusLabel } from "@/components/admin/OrderBadges";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Orders · AquaGear Admin",
};

const OPEN_STATUSES: string[] = [...DRAFT_STATUSES, "PENDING", "PLACED"];
const ALL_STATUSES: string[] = [...DRAFT_STATUSES, ...ORDER_STATUSES];
const FILTER_OPTIONS = [
  { value: "OPEN", label: "Open (drafts, pending, placed)" },
  { value: "ALL", label: "All statuses" },
  ...ALL_STATUSES.map((s) => ({ value: s, label: statusLabel(s) })),
] as const;
const SOURCE_LABELS: Record<string, string> = { WEBSITE: "Website", APP: "App", WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram" };

type SearchParams = Promise<{ status?: string; source?: string; q?: string; from?: string; to?: string; page?: string; error?: string }>;

const PAGE_SIZE = 25;

export default async function AdminOrders({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const statusFilter = sp.status || "OPEN";
  const sourceFilter = (ORDER_SOURCES as readonly string[]).includes(sp.source ?? "") ? sp.source! : "";
  const q = (sp.q || "").trim();
  const from = sp.from ? new Date(sp.from) : null;
  const to = sp.to ? new Date(sp.to) : null;
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);

  const where: Prisma.OrderWhereInput = {};
  if (statusFilter === "OPEN") {
    where.status = { in: OPEN_STATUSES };
  } else if (statusFilter !== "ALL" && ALL_STATUSES.includes(statusFilter)) {
    where.status = statusFilter;
  }
  if (sourceFilter) where.source = sourceFilter;
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { phoneNumber: { contains: q } },
      { id: { startsWith: q.toLowerCase() } },
      { items: { some: { product: { name: { contains: q, mode: "insensitive" } } } } },
      { conversation: { username: { contains: q, mode: "insensitive" } } },
    ];
  }
  if ((from && !isNaN(from.getTime())) || (to && !isNaN(to.getTime()))) {
    where.createdAt = {
      ...(from && !isNaN(from.getTime()) ? { gte: from } : {}),
      ...(to && !isNaN(to.getTime()) ? { lte: to } : {}),
    };
  }

  const [orders, totalCount] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { items: { include: { product: true } }, user: true, conversation: { select: { lastMessageAt: true } } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.order.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Prev/next links keep the active filters, only swapping the page number.
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (sp.status) params.set("status", sp.status);
    if (sourceFilter) params.set("source", sourceFilter);
    if (q) params.set("q", q);
    if (sp.from) params.set("from", sp.from);
    if (sp.to) params.set("to", sp.to);
    params.set("page", String(p));
    return `/admin/orders?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Orders</h1>
        <span className="text-sm text-gray-500">
          {totalCount} {totalCount === 1 ? "order" : "orders"} · page {page} of {totalPages}
        </span>
      </div>

      {sp.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {sp.error}
        </div>
      )}

      {/* Filter bar */}
      <form className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 grid gap-3 md:grid-cols-6">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, phone, order id, product, @username…"
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
        <select
          name="source"
          defaultValue={sourceFilter}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        >
          <option value="">All sources</option>
          {ORDER_SOURCES.map((s) => (
            <option key={s} value={s}>{SOURCE_LABELS[s]}</option>
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
        <div className="md:col-span-6 flex gap-2">
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
                <div className="text-sm text-gray-500">
                  {new Date(o.createdAt).toLocaleString()}
                  {o.conversation && <> · last message {o.conversation.lastMessageAt.toLocaleString()}</>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <SourceBadge source={o.source} />
                <StatusBadge status={o.status} />
                {isDraftStatus(o.status) ? (
                  <Link href={`/admin/orders/${o.id}`} className="btn-primary text-sm">Review</Link>
                ) : (
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
                )}
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

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="btn-outline text-sm">← Previous</Link>
          ) : (
            <span className="btn-outline text-sm opacity-40 pointer-events-none">← Previous</span>
          )}
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages ? (
            <Link href={pageHref(page + 1)} className="btn-outline text-sm">Next →</Link>
          ) : (
            <span className="btn-outline text-sm opacity-40 pointer-events-none">Next →</span>
          )}
        </div>
      )}
    </div>
  );
}
