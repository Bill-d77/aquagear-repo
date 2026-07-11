export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireMobileAdmin, adminOrderInclude, serializeAdminOrder } from "@/lib/mobile-admin";
import { orderStatusSchema } from "@/lib/validation";
import { changeOrderStatus, InsufficientStockError, OrderNotFoundError } from "@/lib/order-transitions";

type Params = { params: Promise<{ id: string }> };

// One PATCH endpoint for all fulfillment updates the web admin supports:
// status (with stock reconciliation), notes, tracking, and "contacted" marking.
const patchSchema = z.object({
  status: orderStatusSchema.optional(),
  notes: z.string().max(2000).optional(),
  trackingNumber: z.string().trim().max(120).optional(),
  carrier: z.string().trim().max(80).optional(),
  markContacted: z.boolean().optional(),
});

export async function GET(req: Request, { params }: Params) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const order = await prisma.order.findUnique({ where: { id }, include: adminOrderInclude });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ order: serializeAdminOrder(order) });
}

export async function PATCH(req: Request, { params }: Params) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }
  const { status, notes, trackingNumber, carrier, markContacted } = parsed.data;

  try {
    if (status) {
      await changeOrderStatus(id, status);
    }

    const fieldUpdate = {
      ...(notes !== undefined ? { notes } : {}),
      ...(trackingNumber !== undefined ? { trackingNumber: trackingNumber || null } : {}),
      ...(carrier !== undefined ? { carrier: carrier || null } : {}),
      ...(markContacted ? { lastContactedAt: new Date() } : {}),
    };
    if (Object.keys(fieldUpdate).length > 0) {
      await prisma.order.update({ where: { id }, data: fieldUpdate });
    }

    const order = await prisma.order.findUnique({ where: { id }, include: adminOrderInclude });
    if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ order: serializeAdminOrder(order) });
  } catch (e) {
    if (e instanceof InsufficientStockError) {
      return NextResponse.json({ error: `Cannot reactivate: insufficient stock for ${e.message}` }, { status: 409 });
    }
    if (e instanceof OrderNotFoundError || (e as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("PATCH /api/mobile/admin/orders/[id]:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
