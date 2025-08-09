export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    const url = new URL("/account", req.url);
    url.searchParams.set("redirect", new URL(req.url).searchParams.get("redirect") ?? "/shop");
    return NextResponse.redirect(url);
  }

  const form = await req.formData();
  const productId = String(form.get("productId"));
  const quantity = Number(form.get("quantity") ?? 1);
  let cartId = cookies().get("cartId")?.value;

  if (!cartId) {
    const order = await prisma.order.create({ data: { total: 0, status: "PENDING" } });
    cartId = order.id;
    const res = NextResponse.redirect(new URL("/cart", req.url));
    res.cookies.set("cartId", order.id, { httpOnly: false, path: "/" });
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.orderItem.create({
      data: { orderId: cartId, productId, quantity, price: product.price }
    });
    return res;
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.orderItem.create({
    data: { orderId: cartId, productId, quantity, price: product.price }
  });
  return NextResponse.redirect(new URL("/cart", req.url));
}
