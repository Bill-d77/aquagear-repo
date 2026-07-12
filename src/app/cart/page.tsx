import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import Image from "next/image";
import { CART_COOKIE_NAME } from "@/lib/cart";
import { getStoreSettings } from "@/lib/settings";
import { ensureValidImageUrl } from "@/lib/images";
import { CartQuantitySelector } from "@/components/cart/CartQuantitySelector";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false, follow: true },
};

export default async function CartPage() {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE_NAME)?.value;

  const [items, settings] = await Promise.all([
    cartId
      ? prisma.orderItem.findMany({
          where: { orderId: cartId, order: { status: "PENDING" } },
          include: { product: { select: { name: true, imageUrl: true, slug: true } } },
        })
      : Promise.resolve([] as Array<{
          id: string;
          product: { name: string; imageUrl: string; slug: string };
          price: number;
          quantity: number;
        }>),
    getStoreSettings(),
  ]);

  const total = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const whatsappMessage = encodeURIComponent(
    `Hello, I'd like to order:\n` +
    items.map((i) => `- ${i.product.name} x ${i.quantity}`).join("\n") +
    (items.length ? `\nTotal: ${(total / 100).toFixed(2)} USD` : "")
  );
  const whatsappLink = `https://wa.me/${settings.whatsappNumber}?text=${whatsappMessage}`;

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="section-title mb-0">Your cart</h1>
        <Link href="/shop" className="text-sm text-sky-700 hover:underline flex items-center gap-1">
          <ArrowLeft size={14} />
          Continue shopping
        </Link>
      </div>

      {/* Empty state */}
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <ShoppingCart size={48} className="text-gray-300" aria-hidden="true" />
          <h2 className="text-xl font-semibold text-gray-700">Your cart is empty</h2>
          <p className="text-gray-500 text-sm">Add some sea gear to get started.</p>
          <Link href="/shop" className="btn-primary mt-2">Browse products</Link>
        </div>
      ) : (
        <div className="lg:grid lg:grid-cols-[2fr_1fr] lg:gap-8 lg:items-start">

          {/* Left: items list */}
          <div className="space-y-3">
            {items.map((i) => (
              <div key={i.id} className="card flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="shrink-0 overflow-hidden rounded-xl">
                    <Image
                      src={ensureValidImageUrl(i.product.imageUrl)}
                      alt={i.product.name}
                      width={64}
                      height={64}
                      className="w-16 h-16 object-contain bg-white rounded-md"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{i.product.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{(i.price / 100).toFixed(2)} USD each</p>
                  </div>
                </div>

                {/* Quantity selector + line subtotal + remove */}
                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap justify-end">
                  <CartQuantitySelector
                    itemId={i.id}
                    initialQuantity={i.quantity}
                    unitPrice={i.price}
                  />
                  <form action="/api/cart/remove" method="post">
                    <input type="hidden" name="id" value={i.id} />
                    <button
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors underline"
                      aria-label={`Remove ${i.product.name}`}
                    >
                      Remove
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>

          {/* Right: sticky order summary */}
          <div className="mt-6 lg:mt-0 lg:sticky lg:top-24">
            <div className="card space-y-4">
              <h2 className="font-semibold text-lg">Order summary</h2>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Subtotal ({items.reduce((s, i) => s + i.quantity, 0)} items)</span>
                  <span className="tabular-nums">{(total / 100).toFixed(2)} USD</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Shipping</span>
                  <span>TBD at checkout</span>
                </div>
              </div>

              <div className="border-t pt-3 flex justify-between font-semibold text-gray-900">
                <span>Total</span>
                <span className="tabular-nums">{(total / 100).toFixed(2)} USD</span>
              </div>

              <Link href="/checkout" className="btn-primary w-full text-center">
                Proceed to Checkout
              </Link>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline w-full text-center"
              >
                Order via WhatsApp
              </a>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
