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

    // Collect all submitted image URLs (one hidden input per image).
    // We filter empty strings first — the "required" sentinel submits "" when no image is present.
    const rawImageUrls = (form.getAll("imageUrls") as string[])
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .map((v) => ensureValidImageUrl(v));

    const parsed = productUpdateFormSchema.safeParse({
      id: form.get("id"),
      name: form.get("name"),
      slug: form.get("slug"),
      description: form.get("description"),
      price: form.get("price"),
      imageUrls: rawImageUrls,
      stock: form.get("stock"),
      categoryId: form.get("categoryId"),
    });

    if (!parsed.success) {
      console.error("Validation error:", parsed.error.flatten());
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { id, imageUrls, ...productData } = parsed.data;
    const primaryImageUrl = imageUrls[0];

    await prisma.$transaction(async (tx) => {
      // Update product record
      await tx.product.update({
        where: { id },
        data: {
          ...productData,
          imageUrl: primaryImageUrl,
        },
      });

      // Replace all images: delete old, insert new in order
      await tx.productImage.deleteMany({ where: { productId: id } });
      await tx.productImage.createMany({
        data: imageUrls.map((url, index) => ({
          productId: id,
          url,
          order: index,
        })),
      });
    });

    return NextResponse.redirect(new URL("/admin/products", req.url));
  } catch (e) {
    console.error("Update product error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
