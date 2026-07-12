import { cookies } from "next/headers";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ensureValidImageUrl } from "@/lib/images";
import { CART_COOKIE_NAME, deliveryFeeFor } from "@/lib/cart";
import { getStoreSettings } from "@/lib/settings";
import { CheckoutForm } from "./CheckoutForm";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function Checkout() {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE_NAME)?.value;

  const order = cartId
    ? await prisma.order.findFirst({
        where: { id: cartId, status: "PENDING" },
        include: { items: { include: { product: true } } },
      })
    : null;

  const items = order?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky-50 text-sky-600">
          <ShoppingBag size={28} />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Your cart is empty</h1>
        <p className="text-sm text-gray-500">Add some gear before checking out.</p>
        <Link href="/shop" className="btn-primary px-6 py-3">Continue Shopping</Link>
      </div>
    );
  }

  const lineItems = items.map((i) => ({
    id: i.id,
    name: i.product.name,
    imageUrl: ensureValidImageUrl(i.product.imageUrl),
    quantity: i.quantity,
    price: i.price,
  }));
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const { shippingFlatRate } = await getStoreSettings();

  return (
    <CheckoutForm
      items={lineItems}
      subtotal={subtotal}
      deliveryFee={deliveryFeeFor(subtotal, shippingFlatRate)}
      baseFee={shippingFlatRate}
    />
  );
}
