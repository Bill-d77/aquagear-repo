export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ensureValidImageUrl } from "@/lib/images";
import { z } from "zod";

const schema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().min(1),
  price: z.coerce.number().int().nonnegative(),
  imageUrl: z.string().min(1),
  stock: z.coerce.number().int().nonnegative(),
  categoryId: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") {
    return NextResponse.redirect(new URL("/account?redirect=/admin/products", req.url));
  }

  try {
    const form = await req.formData();
    const raw = {
      id: form.get("id"),
      name: form.get("name"),
      slug: form.get("slug"),
      description: form.get("description"),
      price: form.get("price"),
      imageUrl: ensureValidImageUrl(form.get("imageUrl")),
      stock: form.get("stock"),
      categoryId: form.get("categoryId"),
    };
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    const { id, name, slug, description, price, imageUrl, stock, categoryId } = parsed.data;

    await prisma.product.update({
      where: { id },
      data: { name, slug, description, price, imageUrl, stock, categoryId },
    });

    return NextResponse.redirect(new URL("/admin/products", req.url));
  } catch (e) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
} 