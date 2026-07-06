export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { productInclude, serializeProduct } from "@/lib/mobile";
import type { Prisma } from "@prisma/client";

const PAGE_SIZE = 24;

const ORDERINGS: Record<string, Prisma.ProductOrderByWithRelationInput> = {
  newest: { createdAt: "desc" },
  price_asc: { price: "asc" },
  price_desc: { price: "desc" },
  rated: { reviews: { _count: "desc" } },
  name: { name: "asc" },
};

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(params.get("limit")) || PAGE_SIZE));
  const search = params.get("search")?.trim();
  const category = params.get("category");
  const orderBy = ORDERINGS[params.get("sort") ?? "newest"] ?? ORDERINGS.newest;

  const where: Prisma.ProductWhereInput = {
    isArchived: false,
    ...(category ? { categoryId: category } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  try {
    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: productInclude,
      }),
    ]);

    return NextResponse.json({
      products: products.map(serializeProduct),
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      total,
    });
  } catch (e) {
    console.error("GET /api/mobile/products:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
