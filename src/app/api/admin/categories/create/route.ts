export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAdminApi, redirectWithError } from "@/lib/admin";
import { categoryFormSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  const form = await req.formData();
  const parsed = categoryFormSchema.safeParse({ name: form.get("name") });
  if (!parsed.success) {
    return redirectWithError(req, "/admin/categories", "Invalid category name.");
  }

  try {
    await prisma.category.create({ data: { name: parsed.data.name } });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === "P2002") {
      // Unique constraint on name
      return redirectWithError(req, "/admin/categories", "A category with this name already exists.");
    }
    throw e;
  }

  return NextResponse.redirect(new URL("/admin/categories", req.url));
}
