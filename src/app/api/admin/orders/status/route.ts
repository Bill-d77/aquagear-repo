export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { requireAdminApi, redirectWithError } from "@/lib/admin";
import { orderStatusSchema } from "@/lib/validation";
import { changeOrderStatus, InsufficientStockError, OrderNotFoundError } from "@/lib/order-transitions";
import { isDraftStatus } from "@/lib/order-status";
import { prisma } from "@/lib/prisma";

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

  // If the request came from an order detail page, redirect back there.
  const referer = req.headers.get("referer") || "";
  const back = referer.includes(`/admin/orders/${id}`) ? `/admin/orders/${id}` : "/admin/orders";

  const current = await prisma.order.findUnique({ where: { id }, select: { status: true } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (isDraftStatus(current.status)) {
    return redirectWithError(req, `/admin/orders/${id}`, "This is a draft from WhatsApp/Instagram — review and confirm it below.");
  }

  try {
    await changeOrderStatus(id, status.data);
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return redirectWithError(req, back, `Cannot reactivate: insufficient stock for ${e.message}`);
    }
    if (e instanceof OrderNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    throw e;
  }
  if (current.status !== status.data) {
    await prisma.orderAudit.create({
      data: { orderId: id, actor: guard.user?.email ?? "admin", action: `Status ${current.status} → ${status.data}` },
    });
  }

  return NextResponse.redirect(new URL(back, req.url));
}
