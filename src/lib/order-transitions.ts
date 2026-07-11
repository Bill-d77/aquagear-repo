// Order status transitions with stock reconciliation, shared by the web admin
// route and /api/mobile/admin/orders/[id].
import { prisma } from "@/lib/prisma";
import type { OrderStatus } from "@/lib/order-status";

// Statuses whose orders hold inventory. Checkout decrements stock when an
// order becomes PLACED, so leaving this set must give the units back and
// re-entering it must take them again.
const HOLDS_STOCK: ReadonlySet<OrderStatus> = new Set(["PLACED", "SHIPPED"]);

export class InsufficientStockError extends Error {}
export class OrderNotFoundError extends Error {}

export async function changeOrderStatus(id: string, status: OrderStatus): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findUnique({
      where: { id },
      select: {
        status: true,
        placedAt: true,
        shippedAt: true,
        canceledAt: true,
        items: { select: { productId: true, quantity: true, product: { select: { name: true } } } },
      },
    });
    if (!existing) throw new OrderNotFoundError();

    const held = HOLDS_STOCK.has(existing.status as OrderStatus);
    const willHold = HOLDS_STOCK.has(status);

    if (held && !willHold) {
      // e.g. PLACED/SHIPPED → CANCELED: give the units back.
      for (const item of existing.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    } else if (!held && willHold) {
      // e.g. CANCELED → PLACED: re-validate and take the units again.
      for (const item of existing.items) {
        const updated = await tx.product.updateMany({
          where: { id: item.productId, isArchived: false, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count !== 1) throw new InsufficientStockError(item.product.name);
      }
    }

    // Set the matching timestamp when a status is first reached; never
    // overwrite the first transition.
    const now = new Date();
    const timestampUpdate: Record<string, Date> = {};
    if (status === "PLACED" && !existing.placedAt) timestampUpdate.placedAt = now;
    if (status === "SHIPPED" && !existing.shippedAt) timestampUpdate.shippedAt = now;
    if (status === "CANCELED" && !existing.canceledAt) timestampUpdate.canceledAt = now;

    await tx.order.update({ where: { id }, data: { status, ...timestampUpdate } });
  });
}
