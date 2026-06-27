import Link from "next/link";
import { CheckCircle2, Package, MapPin, Banknote, Truck } from "lucide-react";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

export default async function CheckoutSuccess({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderId } = await searchParams;
  const order = orderId
    ? await prisma.order.findUnique({
        where: { id: orderId },
        select: { id: true, total: true, name: true, location: true, apartment: true, paymentMode: true },
      })
    : null;

  const rows = order
    ? [
        { icon: Package, label: "Order Number", value: `#${order.id.slice(-8).toUpperCase()}` },
        { icon: MapPin, label: "Delivery Address", value: [order.location, order.apartment].filter(Boolean).join(", ") || "—" },
        { icon: Banknote, label: "Payment", value: order.paymentMode === "COD" ? "Cash on Delivery" : order.paymentMode },
        { icon: Truck, label: "Estimated Delivery", value: "1–3 business days" },
      ]
    : [];

  return (
    <div className="fade-up mx-auto max-w-md px-4 py-12 text-center">
      <div className="mb-5 flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 size={44} className="text-emerald-600" />
        </div>
      </div>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Order Confirmed!</h1>
      <p className="mt-2 text-slate-600">
        Thank you for shopping with AquaGear. Your order has been received and will be confirmed shortly.
      </p>

      {order && (
        <div className="mt-6 space-y-3 rounded-3xl border border-slate-100 bg-white p-5 text-left shadow-sm">
          {rows.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <Icon size={18} className="mt-0.5 shrink-0 text-sky-600" />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-500">{label}</div>
                <div className="break-words font-medium text-slate-900">{value}</div>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-3">
            <span className="font-semibold text-slate-900">Total</span>
            <span className="text-lg font-bold text-sky-600">{money(order.total)}</span>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/account" className="btn-primary px-6 py-3">Track Order</Link>
        <Link href="/shop" className="btn-outline px-6 py-3">Continue Shopping</Link>
      </div>
    </div>
  );
}
