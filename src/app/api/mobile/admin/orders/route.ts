export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin, adminOrderInclude, serializeAdminOrder } from "@/lib/mobile-admin";
import { orderStatusSchema } from "@/lib/validation";
import { DRAFT_STATUSES } from "@/lib/order-status";

const PAGE_SIZE = 30;

/**
 * List orders: ?status=PLACED&query=&page=1
 * Default (no status) matches the web admin's operator view: everything but
 * PENDING, which are live/abandoned carts.
 */
export async function GET(req: Request) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const url = new URL(req.url);
  const statusParam = orderStatusSchema.safeParse(url.searchParams.get("status"));
  const query = url.searchParams.get("query")?.trim() || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);

  const where = {
    // Meta drafts (NEEDS_REVIEW / PENDING_CONFIRMATION) are reviewed on the web
    // dashboard and would break the app's status decoding, so they're excluded.
    status: statusParam.success ? statusParam.data : { notIn: ["PENDING", ...DRAFT_STATUSES] },
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { phoneNumber: { contains: query } },
            { id: { contains: query } },
          ],
        }
      : {}),
  };

  try {
    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        include: adminOrderInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
    ]);
    return NextResponse.json({
      orders: orders.map(serializeAdminOrder),
      page,
      pageSize: PAGE_SIZE,
      total,
    });
  } catch (e) {
    console.error("GET /api/mobile/admin/orders:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
