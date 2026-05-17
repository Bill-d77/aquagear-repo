export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { CART_COOKIE_NAME } from "@/lib/cart";

export async function POST(req: Request) {
  // No auth check needed here; we verify ownership via cartId cookie
  const form = await req.formData();
  const itemId = String(form.get("id"));
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE_NAME)?.value;

  if (!cartId) {
    return NextResponse.redirect(new URL("/cart", req.url));
  }

  // Ensure the item belongs to the current user's cart
  const item = await prisma.orderItem.findFirst({
    where: { id: itemId, orderId: cartId }
  });

  if (!item) {
    return NextResponse.redirect(new URL("/cart", req.url));
  }

  await prisma.orderItem.delete({ where: { id: itemId } });
  return NextResponse.redirect(new URL("/cart", req.url));
}
