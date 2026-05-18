export const runtime = "nodejs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { orderStatusSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  const form = await req.formData();
  const idValue = form.get("id");
  const id = typeof idValue === "string" ? idValue : "";
  const status = orderStatusSchema.safeParse(form.get("status"));
  if (!id || !status.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  // Set the matching timestamp when a status is first reached. We only write
  // a timestamp if it's not already set, so re-applying the same status (or
  // going backwards then forward) doesn't overwrite the first transition.
  const existing = await prisma.order.findUnique({
    where: { id },
    select: { placedAt: true, shippedAt: true, canceledAt: true },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const now = new Date();
  const timestampUpdate: Record<string, Date> = {};
  if (status.data === "PLACED" && !existing.placedAt) timestampUpdate.placedAt = now;
  if (status.data === "SHIPPED" && !existing.shippedAt) timestampUpdate.shippedAt = now;
  if (status.data === "CANCELED" && !existing.canceledAt) timestampUpdate.canceledAt = now;

  await prisma.order.update({
    where: { id },
    data: { status: status.data, ...timestampUpdate },
  });

  // If the request came from an order detail page, redirect back there.
  // Otherwise back to the list.
  const referer = req.headers.get("referer") || "";
  const back = referer.includes(`/admin/orders/${id}`)
    ? `/admin/orders/${id}`
    : "/admin/orders";
  return NextResponse.redirect(new URL(back, req.url));
}
