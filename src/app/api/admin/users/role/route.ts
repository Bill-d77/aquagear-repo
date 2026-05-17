export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { roleSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const idValue = form.get("id");
  const id = typeof idValue === "string" ? idValue : "";
  const newRole = roleSchema.safeParse(form.get("role"));
  if (!id || !newRole.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  await prisma.user.update({ where: { id }, data: { role: newRole.data } });
  return NextResponse.redirect(new URL("/admin/users", req.url));
}
