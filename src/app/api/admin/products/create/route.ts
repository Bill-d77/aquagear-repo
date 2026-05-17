export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ensureValidImageUrl } from "@/lib/images";
import { isAdmin } from "@/lib/admin";
import { productFormSchema } from "@/lib/validation";

export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const form = await req.formData();
    const parsed = productFormSchema.safeParse({
      name: form.get("name"),
      slug: form.get("slug"),
      description: form.get("description"),
      price: form.get("price"),
      imageUrl: ensureValidImageUrl(form.get("imageUrl")),
      stock: form.get("stock"),
      categoryId: form.get("categoryId"),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    await prisma.product.create({ data: parsed.data });
    return NextResponse.redirect(new URL("/admin/products", req.url));
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
