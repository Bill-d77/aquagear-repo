export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAdminApi, redirectWithError } from "@/lib/admin";
import { orderStatusSchema } from "@/lib/validation";
import type { OrderStatus } from "@/lib/order-status";

// Statuses whose orders hold inventory. Checkout decrements stock when an
// order becomes PLACED, so leaving this set must give the units back and
// re-entering it must take them again.
const HOLDS_STOCK: ReadonlySet<OrderStatus> = new Set(["PLACED", "SHIPPED"]);

class InsufficientStockError extends Error {}

export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  const form = await req.formData();
  const idValue = form.get("id");
  const id = typeof idValue === "string" ? idValue : "";
  const status = orderStatusSchema.safeParse(form.get("status"));
  if (!id || !status.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // If the request came from an order detail page, redirect back there.
  const referer = req.headers.get("referer") || "";
  const back = referer.includes(`/admin/orders/${id}`) ? `/admin/orders/${id}` : "/admin/orders";

  try {
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
      if (!existing) throw new Error("NOT_FOUND");

      const held = HOLDS_STOCK.has(existing.status as OrderStatus);
      const willHold = HOLDS_STOCK.has(status.data);

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
      if (status.data === "PLACED" && !existing.placedAt) timestampUpdate.placedAt = now;
      if (status.data === "SHIPPED" && !existing.shippedAt) timestampUpdate.shippedAt = now;
      if (status.data === "CANCELED" && !existing.canceledAt) timestampUpdate.canceledAt = now;

      await tx.order.update({ where: { id }, data: { status: status.data, ...timestampUpdate } });
    });
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return redirectWithError(req, back, `Cannot reactivate: insufficient stock for ${e.message}`);
    }
    if (e instanceof Error && e.message === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }

  return NextResponse.redirect(new URL(back, req.url));
}
