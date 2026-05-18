export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { categoryFormSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  const form = await req.formData();
  const parsed = categoryFormSchema.safeParse({ name: form.get("name") });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  try {
    await prisma.category.create({ data: { name: parsed.data.name } });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2002") {
      // Unique constraint on name
      return NextResponse.json({ error: "A category with this name already exists" }, { status: 409 });
    }
    throw e;
  }

  return NextResponse.redirect(new URL("/admin/categories", req.url));
}
