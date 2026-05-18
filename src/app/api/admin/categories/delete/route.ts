export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";

export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  const form = await req.formData();
  const id = typeof form.get("id") === "string" ? (form.get("id") as string) : "";
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    await prisma.category.delete({ where: { id } });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2003") {
      // FK violation — products still reference this category.
      // We don't soft-archive categories; surface a clear error.
      return NextResponse.json(
        { error: "Can't delete: products still reference this category. Move them to another category first." },
        { status: 409 },
      );
    }
    throw e;
  }

  return NextResponse.redirect(new URL("/admin/categories", req.url));
}
