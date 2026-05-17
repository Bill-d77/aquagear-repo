export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { cartCookieOptions, CART_COOKIE_NAME, MAX_CART_QUANTITY } from "@/lib/cart";

function getSafeRedirect(req: Request) {
  const url = new URL(req.url);
  const redirectUrl = url.searchParams.get("redirect") || "/cart";
  return redirectUrl.startsWith("/") && !redirectUrl.startsWith("//") ? redirectUrl : "/cart";
}

export async function POST(req: Request) {
  try {
    const redirectUrl = getSafeRedirect(req);

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
    let res: NextResponse | null = null;

    if (cartId) {
      const existing = await prisma.order.findFirst({ where: { id: cartId, status: "PENDING" } });
      if (!existing) {
        const order = await prisma.order.create({ data: { total: 0, status: "PENDING" } });
        cartId = order.id;
        res = NextResponse.redirect(new URL(redirectUrl, req.url));
        res.cookies.set(CART_COOKIE_NAME, order.id, cartCookieOptions);
      }
    } else {
      const order = await prisma.order.create({ data: { total: 0, status: "PENDING" } });
      cartId = order.id;
      res = NextResponse.redirect(new URL(redirectUrl, req.url));
      res.cookies.set(CART_COOKIE_NAME, order.id, cartCookieOptions);
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

    return res ?? NextResponse.redirect(new URL(redirectUrl, req.url));
  } catch (error) {
    console.error("Error in /api/cart/add:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
