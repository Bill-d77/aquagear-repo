export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin } from "@/lib/mobile-admin";
import { categoryFormSchema } from "@/lib/validation";

export async function GET(req: Request) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json({
    categories: categories.map((c) => ({ id: c.id, name: c.name, productCount: c._count.products })),
  });
}

export async function POST(req: Request) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const parsed = categoryFormSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  try {
    const category = await prisma.category.create({ data: parsed.data });
    return NextResponse.json({ category: { id: category.id, name: category.name, productCount: 0 } }, { status: 201 });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }
    console.error("POST /api/mobile/admin/categories:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
