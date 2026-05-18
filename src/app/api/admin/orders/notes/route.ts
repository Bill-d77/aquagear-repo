export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { orderNotesSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  const form = await req.formData();
  const parsed = orderNotesSchema.safeParse({
    id: form.get("id"),
    notes: form.get("notes") ?? "",
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await prisma.order.update({
    where: { id: parsed.data.id },
    data: { notes: parsed.data.notes || null },
  });

  return NextResponse.redirect(new URL(`/admin/orders/${parsed.data.id}`, req.url));
}
