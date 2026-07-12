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

    // Collect all submitted image URLs (one hidden input per image).
    // We filter empty strings first — the "required" sentinel submits "" when no image is present.
    const rawImageUrls = (form.getAll("imageUrls") as string[])
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .map((v) => ensureValidImageUrl(v));

    const parsed = productFormSchema.safeParse({
      name: form.get("name"),
      slug: form.get("slug"),
      description: form.get("description"),
      price: form.get("price"),
      imageUrls: rawImageUrls,
      stock: form.get("stock"),
      categoryId: form.get("categoryId"),
      brand: form.get("brand"),
      gtin: form.get("gtin"),
      mpn: form.get("mpn"),
      condition: form.get("condition") ?? "new",
      googleProductCategory: form.get("googleProductCategory"),
    });

    if (!parsed.success) {
      console.error("Validation error:", parsed.error.flatten());
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { imageUrls, ...productData } = parsed.data;
    const primaryImageUrl = imageUrls[0];

    await prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...productData,
          imageUrl: primaryImageUrl,
        },
      });

      await tx.productImage.createMany({
        data: imageUrls.map((url, index) => ({
          productId: product.id,
          url,
          order: index,
        })),
      });
    });

    return NextResponse.redirect(new URL("/admin/products", req.url));
  } catch (error) {
    console.error("Create product error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
