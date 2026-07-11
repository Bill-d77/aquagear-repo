export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, adminProductInclude, serializeAdminProduct } from "@/lib/mobile-admin";
import { productFormSchema } from "@/lib/validation";
import { ensureValidImageUrl } from "@/lib/images";
import { LOW_STOCK_THRESHOLD } from "@/lib/admin";

const PAGE_SIZE = 50;

/** List products: ?query=&categoryId=&archived=1&lowStock=1&page=1 */
export async function GET(req: Request) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const url = new URL(req.url);
  const query = url.searchParams.get("query")?.trim() || "";
  const categoryId = url.searchParams.get("categoryId")?.trim() || "";
  const archived = url.searchParams.get("archived") === "1";
  const lowStock = url.searchParams.get("lowStock") === "1";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);

  const where = {
    isArchived: archived,
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { slug: { contains: query, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(lowStock ? { stock: { lt: LOW_STOCK_THRESHOLD } } : {}),
  };

  try {
    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: adminProductInclude,
        orderBy: lowStock ? { stock: "asc" } : { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);
    return NextResponse.json({
      products: products.map(serializeAdminProduct),
      page,
      pageSize: PAGE_SIZE,
      total,
    });
  } catch (e) {
    console.error("GET /api/mobile/admin/products:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

/** Create a product. JSON body matching productFormSchema. */
export async function POST(req: Request) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;

  try {
    const body = await req.json();
    const parsed = productFormSchema.safeParse({
      ...body,
      imageUrls: Array.isArray(body.imageUrls)
        ? body.imageUrls
            .filter((v: unknown) => typeof v === "string" && v.trim().length > 0)
            .map((v: string) => ensureValidImageUrl(v))
        : [],
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
    }

    const { imageUrls, ...productData } = parsed.data;
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: { ...productData, imageUrl: imageUrls[0] },
      });
      await tx.productImage.createMany({
        data: imageUrls.map((imgUrl, index) => ({ productId: created.id, url: imgUrl, order: index })),
      });
      return tx.product.findUniqueOrThrow({ where: { id: created.id }, include: adminProductInclude });
    });

    return NextResponse.json({ product: serializeAdminProduct(product) }, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A product with this slug already exists" }, { status: 409 });
    }
    console.error("POST /api/mobile/admin/products:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
