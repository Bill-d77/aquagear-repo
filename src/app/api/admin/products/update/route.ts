export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ensureValidImageUrl } from "@/lib/images";

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const id = String(form.get("id"));
  const name = String(form.get("name"));
  const slug = String(form.get("slug"));
  const description = String(form.get("description"));
  const price = Number(form.get("price"));
  const imageUrl = ensureValidImageUrl(form.get("imageUrl"));
  const stock = Number(form.get("stock"));
  const categoryId = String(form.get("categoryId"));

  await prisma.product.update({
    where: { id },
    data: { name, slug, description, price, imageUrl, stock, categoryId },
  });

  return NextResponse.redirect(new URL("/admin/products", req.url));
} 