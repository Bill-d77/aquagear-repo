export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productInclude, serializeProduct } from "@/lib/mobile";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  try {
    const product = await prisma.product.findUnique({
      where: { slug },
      include: productInclude,
    });
    if (!product || product.isArchived) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const [reviews, related] = await Promise.all([
      prisma.review.findMany({
        where: { productId: product.id },
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { name: true } } },
      }),
      prisma.product.findMany({
        where: { categoryId: product.categoryId, isArchived: false, id: { not: product.id } },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: productInclude,
      }),
    ]);

    return NextResponse.json({
      product: serializeProduct(product),
      reviews: reviews.map((r) => ({
        id: r.id,
        rating: r.rating,
        comment: r.comment,
        userName: r.user.name,
        createdAt: r.createdAt.toISOString(),
      })),
      related: related.map(serializeProduct),
    });
  } catch (e) {
    console.error("GET /api/mobile/products/[slug]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
