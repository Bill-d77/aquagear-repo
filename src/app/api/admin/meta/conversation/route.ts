export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, redirectWithError } from "@/lib/admin";
import { refreshDraft } from "@/lib/meta/ingest";
import { DRAFT_STATUSES } from "@/lib/order-status";
import { deliveryFeeFor } from "@/lib/cart";
import { getStoreSettings } from "@/lib/settings";

const schema = z.object({ id: z.string().min(1), intent: z.enum(["detect", "draft", "close"]) });

/** Conversation actions: re-run order detection, start a draft by hand, or close the thread. */
export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  const form = await req.formData();
  const parsed = schema.safeParse({ id: form.get("id"), intent: form.get("intent") });
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { id, intent } = parsed.data;
  const back = `/admin/inbox/${id}`;

  const conv = await prisma.conversation.findUnique({ where: { id } });
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (intent === "detect") {
    const created = await refreshDraft(id);
    return NextResponse.redirect(new URL(created ? `/admin/orders/${created}` : back, req.url));
  }

  if (intent === "close") {
    await prisma.conversation.update({ where: { id }, data: { status: "CLOSED", unreadCount: 0, lastReadAt: new Date() } });
    return NextResponse.redirect(new URL(back, req.url));
  }

  const open = await prisma.order.findFirst({ where: { conversationId: id, status: { in: [...DRAFT_STATUSES] } }, select: { id: true } });
  if (open) return redirectWithError(req, back, "This conversation already has an open draft order.");
  const { shippingFlatRate } = await getStoreSettings();
  const order = await prisma.order.create({
    data: {
      source: conv.channel,
      conversationId: id,
      status: "NEEDS_REVIEW",
      name: conv.name,
      phoneNumber: conv.phone,
      total: deliveryFeeFor(0, shippingFlatRate),
      audits: { create: { actor: guard.user?.email ?? "admin", action: "Draft created manually from conversation" } },
    },
    select: { id: true },
  });
  await prisma.conversation.update({ where: { id }, data: { status: "ORDER_DETECTED" } });
  return NextResponse.redirect(new URL(`/admin/orders/${order.id}`, req.url));
}
