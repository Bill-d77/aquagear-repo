export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin } from "@/lib/mobile-admin";
import { categoryFormSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const parsed = categoryFormSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  try {
    const category = await prisma.category.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ category: { id: category.id, name: category.name } });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (code === "P2002") return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    console.error("PATCH /api/mobile/admin/categories/[id]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  try {
    await prisma.category.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (code === "P2003") {
      // FK violation — products still reference this category (mirrors the web admin).
      return NextResponse.json(
        { error: "Can't delete: products still reference this category. Move them to another category first." },
        { status: 409 },
      );
    }
    console.error("DELETE /api/mobile/admin/categories/[id]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
