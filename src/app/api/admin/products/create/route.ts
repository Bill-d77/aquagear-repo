import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ensureValidImageUrl } from "@/lib/images";

export async function POST(req: Request) {
  const form = await req.formData();
  const data = {
    name: String(form.get("name")),
    slug: String(form.get("slug")),
    description: String(form.get("description")),
    price: Number(form.get("price")),
    imageUrl: ensureValidImageUrl(form.get("imageUrl")),
    stock: Number(form.get("stock")),
    categoryId: String(form.get("categoryId"))
  };
  await prisma.product.create({ data });
  return NextResponse.redirect(new URL("/admin/products", req.url));
}
