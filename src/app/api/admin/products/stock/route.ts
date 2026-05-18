export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { stockUpdateSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  const form = await req.formData();
  const parsed = stockUpdateSchema.safeParse({
    id: form.get("id"),
    stock: form.get("stock"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await prisma.product.update({
    where: { id: parsed.data.id },
    data: { stock: parsed.data.stock },
  });

  const referer = req.headers.get("referer");
  return NextResponse.redirect(new URL(referer || "/admin/products", req.url));
}
