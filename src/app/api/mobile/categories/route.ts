export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { products: { where: { isArchived: false } } } },
        products: {
          where: { isArchived: false },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { imageUrl: true, images: { orderBy: { order: "asc" }, take: 1, select: { url: true } } },
        },
      },
    });

    return NextResponse.json({
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        productCount: c._count.products,
        imageUrl: c.products[0]?.imageUrl || c.products[0]?.images[0]?.url || "",
      })),
    });
  } catch (e) {
    console.error("GET /api/mobile/categories:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
