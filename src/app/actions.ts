"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

/**
 * Update the quantity of a cart item.
 * If quantity <= 0 the item is removed from the cart.
 * Returns the updated line total in cents, or 0 if removed.
 */
export async function updateCartItemQuantity(
  itemId: string,
  quantity: number
): Promise<{ lineTotal: number; removed: boolean }> {
  if (quantity <= 0) {
    await prisma.orderItem.delete({ where: { id: itemId } });
    revalidatePath("/cart");
    return { lineTotal: 0, removed: true };
  }

  const updated = await prisma.orderItem.update({
    where: { id: itemId },
    data: { quantity },
    select: { price: true, quantity: true },
  });

  revalidatePath("/cart");
  return { lineTotal: updated.price * updated.quantity, removed: false };
}
