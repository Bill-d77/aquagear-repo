export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  // Removed auth check to allow guest checkout

  const url = new URL(req.url);
  const redirectUrl = url.searchParams.get("redirect") || "/cart";

  const form = await req.formData();
  const productId = String(form.get("productId"));
  const quantity = Number(form.get("quantity") ?? 1);

  // Ensure product exists first
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let cartId = cookies().get("cartId")?.value;
  let res: NextResponse | null = null;

  if (cartId) {
    const existing = await prisma.order.findUnique({ where: { id: cartId } });
    if (!existing) {
      const order = await prisma.order.create({ data: { total: 0, status: "PENDING" } });
      cartId = order.id;
      res = NextResponse.redirect(new URL(redirectUrl, req.url));
      res.cookies.set("cartId", order.id, { httpOnly: false, path: "/" });
    }
  } else {
    const order = await prisma.order.create({ data: { total: 0, status: "PENDING" } });
    cartId = order.id;
    res = NextResponse.redirect(new URL(redirectUrl, req.url));
    res.cookies.set("cartId", order.id, { httpOnly: false, path: "/" });
  }

  await prisma.orderItem.create({
    data: { orderId: cartId!, productId, quantity, price: product.price }
  });

  return res ?? NextResponse.redirect(new URL(redirectUrl, req.url));
}
