export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireMobileAdmin, adminOrderInclude, serializeAdminOrder } from "@/lib/mobile-admin";
import { roleSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

/** Customer profile: user details + full order history. */
export async function GET(req: Request, { params }: Params) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, createdAt: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const orders = await prisma.order.findMany({
    where: { userId: id, status: { not: "PENDING" } },
    include: adminOrderInclude,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    user: { ...user, createdAt: user.createdAt.toISOString() },
    orders: orders.map(serializeAdminOrder),
  });
}

const patchSchema = z.object({ role: roleSchema });

export async function PATCH(req: Request, { params }: Params) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Never demote the last admin — that would lock everyone out of the admin
  // with no recovery short of direct DB access (mirrors the web route).
  if (parsed.data.role !== "ADMIN") {
    const otherAdmins = await prisma.user.count({ where: { role: "ADMIN", id: { not: id } } });
    if (otherAdmins === 0) {
      return NextResponse.json({ error: "Cannot demote the last admin — promote someone else first." }, { status: 409 });
    }
  }

  try {
    const user = await prisma.user.update({
      where: { id },
      data: { role: parsed.data.role },
      select: { id: true, name: true, email: true, role: true },
    });
    return NextResponse.json({ user });
  } catch (e) {
    if ((e as { code?: string }).code === "P2025") return NextResponse.json({ error: "Not found" }, { status: 404 });
    console.error("PATCH /api/mobile/admin/users/[id]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
