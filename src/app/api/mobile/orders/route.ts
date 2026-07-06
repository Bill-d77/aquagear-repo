export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { deliveryFeeFor, MAX_CART_QUANTITY } from "@/lib/cart";
import { getStoreSettings } from "@/lib/settings";
import { PLACED_ORDER_STATUS } from "@/lib/order-status";
import { notifyNewOrder } from "@/lib/telegram";
import { getMobileUser } from "@/lib/mobile";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

const orderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.number().int().min(1).max(MAX_CART_QUANTITY),
      })
    )
    .min(1)
    .max(50),
  name: z.string().min(1),
  city: z.string().min(1),
  area: z.string().min(1),
  phoneNumber: z.string().min(1),
  apartment: z.string().optional(),
  paymentMode: z.enum(["COD"]),
});

/**
 * Place an order from the app's local cart. Same transaction semantics as the
 * web checkout (stock validation + decrement, delivery fee in total, Telegram
 * alert), but stateless: the items come in the request instead of a cookie cart.
 */
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limit = rateLimit({ key: `morder:ip:${ip}`, max: 10, windowMs: 15 * 60 * 1000 });
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Too many orders. Please try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
    );
  }

  try {
    const parsed = orderSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { items, name, city, area, phoneNumber, apartment, paymentMode } = parsed.data;
    const user = await getMobileUser(req);

    const { shippingFlatRate } = await getStoreSettings();

    const orderId = await prisma.$transaction(async (tx) => {
      const products = await tx.product.findMany({
        where: { id: { in: items.map((i) => i.productId) }, isArchived: false },
      });
      const byId = new Map(products.map((p) => [p.id, p]));

      let subtotal = 0;
      for (const item of items) {
        const product = byId.get(item.productId);
        if (!product) throw new Error("A product in your cart is no longer available");
        if (product.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${product.name}`);
        }
        subtotal += product.price * item.quantity;
      }

      const order = await tx.order.create({
        data: {
          userId: user?.id,
          name,
          location: `${city}, ${area}`,
          phoneNumber,
          apartment,
          paymentMode,
          status: PLACED_ORDER_STATUS,
          placedAt: new Date(),
          total: subtotal + deliveryFeeFor(subtotal, shippingFlatRate),
          items: {
            create: items.map((i) => ({
              productId: i.productId,
              quantity: i.quantity,
              price: byId.get(i.productId)!.price,
            })),
          },
        },
      });

      for (const item of items) {
        const updated = await tx.product.updateMany({
          where: { id: item.productId, isArchived: false, stock: { gte: item.quantity } },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count !== 1) {
          throw new Error(`Insufficient stock for ${byId.get(item.productId)!.name}`);
        }
      }

      return order.id;
    });

    after(() => notifyNewOrder(orderId));

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    return NextResponse.json({
      id: orderId,
      total: order?.total ?? 0,
      status: order?.status ?? PLACED_ORDER_STATUS,
      createdAt: (order?.createdAt ?? new Date()).toISOString(),
    });
  } catch (e) {
    console.error("POST /api/mobile/orders:", e);
    const message = e instanceof Error ? e.message : "Failed to submit order";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** Order history for the authenticated user. */
export async function GET(req: Request) {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const orders = await prisma.order.findMany({
      where: { userId: user.id, status: { not: "PENDING" } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                slug: true,
                imageUrl: true,
                images: { orderBy: { order: "asc" }, take: 1, select: { url: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      orders: orders.map((o) => ({
        id: o.id,
        total: o.total,
        status: o.status,
        location: o.location,
        phoneNumber: o.phoneNumber,
        paymentMode: o.paymentMode,
        trackingNumber: o.trackingNumber,
        carrier: o.carrier,
        createdAt: o.createdAt.toISOString(),
        placedAt: o.placedAt?.toISOString() ?? o.createdAt.toISOString(),
        shippedAt: o.shippedAt?.toISOString() ?? null,
        canceledAt: o.canceledAt?.toISOString() ?? null,
        items: o.items.map((i) => ({
          id: i.id,
          productName: i.product.name,
          productSlug: i.product.slug,
          imageUrl: i.product.imageUrl || i.product.images[0]?.url || "",
          quantity: i.quantity,
          price: i.price,
        })),
      })),
    });
  } catch (e) {
    console.error("GET /api/mobile/orders:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
