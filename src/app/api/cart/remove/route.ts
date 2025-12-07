export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(req: Request) {
  // No auth check needed here; we verify ownership via cartId cookie
  const form = await req.formData();
  const itemId = String(form.get("id"));
  const cartId = cookies().get("cartId")?.value;

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