"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { CART_COOKIE_NAME, MAX_CART_QUANTITY } from "@/lib/cart";

/**
 * Update the quantity of a cart item.
 * If quantity <= 0 the item is removed from the cart.
 * Returns the updated line total in cents, or 0 if removed.
 */
export async function updateCartItemQuantity(
  itemId: string,
  quantity: number
): Promise<{ lineTotal: number; removed: boolean }> {
  // Server actions are public endpoints: only touch an item in the caller's
  // own live cart, never another cart or an already-placed order.
  const cartId = (await cookies()).get(CART_COOKIE_NAME)?.value;
  const item = cartId
    ? await prisma.orderItem.findFirst({
        where: { id: itemId, orderId: cartId, order: { status: "PENDING" } },
        select: { id: true, product: { select: { price: true, stock: true } } },
      })
    : null;
  if (!item) throw new Error("Cart item not found");

  if (!Number.isInteger(quantity) || quantity <= 0) {
    await prisma.orderItem.delete({ where: { id: item.id } });
    revalidatePath("/cart");
    return { lineTotal: 0, removed: true };
  }

  // Floor of 1: an out-of-stock line is refused at checkout with a clear message.
  const capped = Math.max(1, Math.min(quantity, MAX_CART_QUANTITY, item.product.stock));
  await prisma.orderItem.update({ where: { id: item.id }, data: { quantity: capped } });

  revalidatePath("/cart");
  // Live price, matching what the cart page shows and checkout charges.
  return { lineTotal: item.product.price * capped, removed: false };
}
