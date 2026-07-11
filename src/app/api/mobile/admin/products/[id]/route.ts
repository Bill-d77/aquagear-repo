export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireMobileAdmin, adminProductInclude, serializeAdminProduct } from "@/lib/mobile-admin";
import { productFormSchema } from "@/lib/validation";
import { ensureValidImageUrl } from "@/lib/images";

// Partial update: any subset of the product fields, plus archive/restore.
// When imageUrls is present the gallery is replaced in the given order.
const patchSchema = productFormSchema.partial().extend({
  isArchived: z.boolean().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id }, include: adminProductInclude });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ product: serializeAdminProduct(product) });
}

export async function PATCH(req: Request, { params }: Params) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  try {
    const body = await req.json();
    const parsed = patchSchema.safeParse({
      ...body,
      imageUrls: Array.isArray(body.imageUrls)
        ? body.imageUrls
            .filter((v: unknown) => typeof v === "string" && v.trim().length > 0)
            .map((v: string) => ensureValidImageUrl(v))
        : undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const { imageUrls, ...fields } = parsed.data;
    const product = await prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          ...fields,
          ...(imageUrls ? { imageUrl: imageUrls[0] } : {}),
        },
      });
      if (imageUrls) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        await tx.productImage.createMany({
          data: imageUrls.map((imgUrl, index) => ({ productId: id, url: imgUrl, order: index })),
        });
      }
      return tx.product.findUniqueOrThrow({ where: { id }, include: adminProductInclude });
    });

    return NextResponse.json({ product: serializeAdminProduct(product) });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (code === "P2002") return NextResponse.json({ error: "A product with this slug already exists" }, { status: 409 });
    console.error("PATCH /api/mobile/admin/products/[id]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** Delete; falls back to archiving when orders/reviews reference the product (P2003). */
export async function DELETE(req: Request, { params }: Params) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  try {
    await prisma.product.delete({ where: { id } });
    return NextResponse.json({ deleted: true, archived: false });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (code === "P2003") {
      await prisma.product.update({ where: { id }, data: { isArchived: true } });
      return NextResponse.json({ deleted: false, archived: true });
    }
    console.error("DELETE /api/mobile/admin/products/[id]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
