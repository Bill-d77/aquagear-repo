export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { ensureValidImageUrl } from "@/lib/images";
import { productUpdateFormSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

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
    const parsed = productUpdateFormSchema.safeParse(raw);
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
