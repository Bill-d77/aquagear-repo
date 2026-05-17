export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { orderStatusSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const idValue = form.get("id");
  const id = typeof idValue === "string" ? idValue : "";
  const status = orderStatusSchema.safeParse(form.get("status"));
  if (!id || !status.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await prisma.order.update({ where: { id }, data: { status: status.data } });
  return NextResponse.redirect(new URL("/admin/orders", req.url));
}
