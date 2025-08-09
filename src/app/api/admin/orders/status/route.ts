import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const id = String(form.get("id"));
  const status = String(form.get("status"));

  await prisma.order.update({ where: { id }, data: { status } });
  return NextResponse.redirect(new URL("/admin/orders", req.url));
} 