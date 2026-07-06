export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { roleSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  const form = await req.formData();
  const idValue = form.get("id");
  const id = typeof idValue === "string" ? idValue : "";
  const newRole = roleSchema.safeParse(form.get("role"));
  if (!id || !newRole.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Never demote the last admin — that would lock everyone out of /admin
  // with no recovery short of direct DB access.
  if (newRole.data !== "ADMIN") {
    const otherAdmins = await prisma.user.count({
      where: { role: "ADMIN", id: { not: id } },
    });
    if (otherAdmins === 0) {
      return NextResponse.json(
        { error: "Cannot demote the last admin" },
        { status: 400 },
      );
    }
  }

  await prisma.user.update({ where: { id }, data: { role: newRole.data } });
  return NextResponse.redirect(new URL("/admin/users", req.url));
}
