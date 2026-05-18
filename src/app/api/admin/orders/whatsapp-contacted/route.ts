export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";

export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id : "";
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const updated = await prisma.order.update({
    where: { id },
    data: { lastContactedAt: new Date() },
    select: { lastContactedAt: true },
  });

  return NextResponse.json({ ok: true, lastContactedAt: updated.lastContactedAt });
}
