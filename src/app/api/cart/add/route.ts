export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { after } from "next/server";
import { cartCookieOptions, CART_COOKIE_NAME, MAX_CART_QUANTITY } from "@/lib/cart";

// ponytail: opportunistic cleanup instead of cron infra. On ~2% of add-to-cart
// requests, purge abandoned guest carts (PENDING orders >30 days old) after the
// response is sent. Move to a scheduled job if volume ever makes this matter.
const STALE_CART_MS = 30 * 24 * 60 * 60 * 1000;

function cleanupStaleCarts() {
  after(async () => {
    try {
      const cutoff = new Date(Date.now() - STALE_CART_MS);
      const stale = { status: "PENDING", createdAt: { lt: cutoff } } as const;
      await prisma.orderItem.deleteMany({ where: { order: stale } });
      await prisma.order.deleteMany({ where: stale });
    } catch (e) {
      console.error("stale cart cleanup failed:", e);
    }
  });
}

export async function POST(req: Request) {
  try {
    if (Math.random() < 0.02) cleanupStaleCarts();
    const form = await req.formData();
    const productIdValue = form.get("productId");
    const productId = typeof productIdValue === "string" ? productIdValue : "";
    const quantity = Number(form.get("quantity") ?? 1);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CART_QUANTITY) {
      return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || product.isArchived) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (product.stock < quantity) {
      return NextResponse.json({ error: "Insufficient stock" }, { status: 400 });
    }

    const cookieStore = await cookies();
    let cartId = cookieStore.get(CART_COOKIE_NAME)?.value;
    let newCartId: string | null = null;

    if (cartId) {
      const existing = await prisma.order.findFirst({ where: { id: cartId, status: "PENDING" } });
      if (!existing) {
        const order = await prisma.order.create({ data: { total: 0, status: "PENDING" } });
        cartId = order.id;
        newCartId = order.id;
      }
    } else {
      const order = await prisma.order.create({ data: { total: 0, status: "PENDING" } });
      cartId = order.id;
      newCartId = order.id;
    }

    const existingItem = await prisma.orderItem.findFirst({
      where: { orderId: cartId!, productId },
    });

    if (existingItem) {
      const nextQuantity = existingItem.quantity + quantity;
      if (nextQuantity > MAX_CART_QUANTITY || nextQuantity > product.stock) {
        return NextResponse.json({ error: "Insufficient stock" }, { status: 400 });
      }
      await prisma.orderItem.update({
        where: { id: existingItem.id },
        data: { quantity: nextQuantity, price: product.price },
      });
    } else {
      await prisma.orderItem.create({
        data: { orderId: cartId!, productId, quantity, price: product.price }
      });
    }

    const res = NextResponse.json({ success: true });
    if (newCartId) {
      res.cookies.set(CART_COOKIE_NAME, newCartId, cartCookieOptions);
    }
    return res;
  } catch (error) {
    console.error("Error in /api/cart/add:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
