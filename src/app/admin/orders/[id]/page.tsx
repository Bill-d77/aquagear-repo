import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  MapPin,
  Phone,
  User,
  CreditCard,
  Package,
  Truck,
  ArrowLeft,
  Calendar,
  StickyNote,
  History,
  MessageCircle,
} from "lucide-react";
import { ORDER_STATUSES, isDraftStatus } from "@/lib/order-status";
import { SourceBadge, StatusBadge } from "@/components/admin/OrderBadges";
import { DraftReview } from "@/components/admin/DraftReview";
import { getStoreSettings } from "@/lib/settings";
import { WhatsAppContactButton } from "@/components/admin/WhatsAppContactButton";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order ${id.slice(0, 8).toUpperCase()} · AquaGear Admin` };
}

export default async function AdminOrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const [order, settings] = await Promise.all([
    prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: { select: { id: true, name: true, slug: true } } } },
        user: true,
        conversation: { select: { id: true, name: true, username: true } },
        audits: { orderBy: { createdAt: "desc" } },
      },
    }),
    getStoreSettings(),
  ]);

  if (!order) return notFound();
  const isDraft = isDraftStatus(order.status);
  const products = isDraft
    ? await prisma.product.findMany({ where: { isArchived: false }, orderBy: { name: "asc" }, select: { id: true, name: true, price: true, stock: true } })
    : [];

  const mapsQuery = encodeURIComponent(
    [order.location, order.apartment].filter(Boolean).join(", "),
  );
  const mapsUrl = mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${mapsQuery}` : null;

  const customerWhatsAppNumber = (order.phoneNumber || "").replace(/[^0-9]/g, "");
  const whatsappPrefilled = encodeURIComponent(
    `Hello ${order.name || "there"}, calling about your order #${order.id.slice(0, 8).toUpperCase()} at AquaGear.`,
  );
  const customerWhatsappUrl = customerWhatsAppNumber
    ? `https://wa.me/${customerWhatsAppNumber}?text=${whatsappPrefilled}`
    : `https://wa.me/${settings.whatsappNumber}?text=${whatsappPrefilled}`;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      <div>
        <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="w-4 h-4" />
          Back to orders
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Order #{order.id.slice(0, 8).toUpperCase()}
            </h1>
            <p className="text-sm text-gray-500">Placed {new Date(order.createdAt).toLocaleString()}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source={order.source} />
            <StatusBadge status={order.status} />
            {order.conversation && (
              <Link href={`/admin/inbox/${order.conversation.id}`} className="btn-outline text-sm inline-flex items-center gap-1">
                <MessageCircle className="w-4 h-4" /> View conversation
              </Link>
            )}
          </div>
        </div>
      </div>

      {isDraft && <DraftReview order={order} products={products} />}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — customer + items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <User className="w-4 h-4" /> Customer
            </h2>
            <div className="grid sm:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Name</div>
                <div className="font-medium text-gray-900">{order.name || "Guest"}</div>
                <div className="text-gray-500 text-xs">{order.user?.email || "No email"}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Phone</div>
                <div className="font-medium text-gray-900 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-gray-400" />
                  {order.phoneNumber || "—"}
                </div>
              </div>
              <div className="sm:col-span-2">
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Delivery address</div>
                <div className="font-medium text-gray-900 flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-gray-400 mt-1 shrink-0" />
                  <div>
                    <div>{order.location || "—"}</div>
                    {order.apartment && <div className="text-gray-500 text-xs">{order.apartment}</div>}
                  </div>
                </div>
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-sky-700 hover:underline mt-1 inline-block ml-5"
                  >
                    Open in Google Maps →
                  </a>
                )}
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Payment</div>
                <div className="font-medium text-gray-900 flex items-center gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                  {order.paymentMode}
                </div>
              </div>
            </div>
          </div>

          {/* Items card */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="p-6 pb-3">
              <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                <Package className="w-4 h-4" /> Items ({order.items.length})
              </h2>
            </div>
            <div className="divide-y">
              {order.items.map((item) => (
                <div key={item.id} className="px-6 py-3 flex items-center justify-between text-sm">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                      {item.quantity}x
                    </div>
                    <Link
                      href={`/admin/products/edit/${item.product.id}`}
                      className="font-medium text-gray-900 hover:text-sky-700 truncate"
                    >
                      {item.product.name}
                    </Link>
                  </div>
                  <div className="text-gray-600 shrink-0">${(item.price / 100).toFixed(2)}</div>
                </div>
              ))}
              <div className="px-6 py-3 bg-gray-50 rounded-b-xl flex justify-between font-bold text-gray-900">
                <span>Total</span>
                <span>${(order.total / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Admin notes (drafts edit notes in the review form) */}
          {!isDraft && <form action="/api/admin/orders/notes" method="post" className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <StickyNote className="w-4 h-4" /> Internal notes
            </h2>
            <input type="hidden" name="id" value={order.id} />
            <textarea
              name="notes"
              defaultValue={order.notes || ""}
              placeholder="Notes only visible to admins (e.g., called twice, delivered to neighbor, etc.)"
              rows={3}
              className="w-full border border-gray-300 rounded-md p-3 text-sm focus:border-sky-500 focus:ring-sky-500"
            />
            <button type="submit" className="btn-primary text-sm">Save notes</button>
          </form>}

          {/* Audit history */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <History className="w-4 h-4" /> History
            </h2>
            {order.audits.length === 0 && <p className="text-sm text-gray-500">No recorded changes.</p>}
            <ol className="space-y-3">
              {order.audits.map((a) => (
                <li key={a.id} className="text-sm border-l-2 border-gray-200 pl-3">
                  <div className="font-medium text-gray-900">{a.action}</div>
                  <div className="text-xs text-gray-500">{a.createdAt.toLocaleString()} · {a.actor}</div>
                  {a.detail && <p className="text-xs text-gray-600 whitespace-pre-wrap break-words mt-1">{a.detail}</p>}
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Right column — status, contact, tracking */}
        <div className="space-y-6">
          {/* Status timeline + change */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Status</h2>
            <div className="space-y-2 text-sm">
              <TimelineEntry
                label="Placed"
                at={order.placedAt}
                fallbackAt={order.status === "PLACED" || order.status === "SHIPPED" ? order.createdAt : null}
              />
              <TimelineEntry label="Shipped" at={order.shippedAt} />
              <TimelineEntry label="Canceled" at={order.canceledAt} />
            </div>
            {!isDraft && <form action="/api/admin/orders/status" method="post" className="space-y-2 pt-3 border-t">
              <input type="hidden" name="id" value={order.id} />
              <label className="block text-xs uppercase tracking-wider text-gray-500">Change status</label>
              <select
                name="status"
                defaultValue={order.status}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                {ORDER_STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <button className="btn-outline text-sm w-full">Update status</button>
            </form>}
          </div>

          {/* WhatsApp contact */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-3">
            <h2 className="font-semibold text-gray-900">Customer contact</h2>
            <WhatsAppContactButton
              orderId={order.id}
              whatsappUrl={customerWhatsappUrl}
              initiallyContactedAt={order.lastContactedAt ? order.lastContactedAt.toISOString() : null}
            />
          </div>

          {/* Tracking */}
          <form action="/api/admin/orders/tracking" method="post" className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Truck className="w-4 h-4" /> Shipping
            </h2>
            <input type="hidden" name="id" value={order.id} />
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Carrier</label>
              <input
                name="carrier"
                defaultValue={order.carrier || ""}
                placeholder="e.g. Aramex, DHL, local courier"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Tracking number</label>
              <input
                name="trackingNumber"
                defaultValue={order.trackingNumber || ""}
                placeholder="Optional"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
              />
            </div>
            <button type="submit" className="btn-outline text-sm w-full">Save shipping info</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function TimelineEntry({ label, at, fallbackAt }: { label: string; at: Date | null; fallbackAt?: Date | null }) {
  const actualAt = at || fallbackAt || null;
  return (
    <div className="flex items-center gap-2">
      <Calendar className={`w-3.5 h-3.5 ${actualAt ? "text-gray-600" : "text-gray-300"}`} />
      <span className={`font-medium ${actualAt ? "text-gray-900" : "text-gray-400"}`}>{label}</span>
      <span className="text-xs text-gray-500 ml-auto">
        {actualAt ? new Date(actualAt).toLocaleString() : "—"}
      </span>
    </div>
  );
}
