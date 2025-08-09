import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.redirect(new URL("/account?redirect=/cart", req.url));
  }

  const form = await req.formData();
  const itemId = String(form.get("id"));
  const cartId = cookies().get("cartId")?.value;
  if (!cartId) {
    return NextResponse.redirect(new URL("/cart", req.url));
  }

  const item = await prisma.orderItem.findFirst({ where: { id: itemId, orderId: cartId } });
  if (!item) {
    return NextResponse.redirect(new URL("/cart", req.url));
  }

  await prisma.orderItem.delete({ where: { id: itemId } });
  return NextResponse.redirect(new URL("/cart", req.url));
} 