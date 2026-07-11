export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin } from "@/lib/mobile-admin";

const PAGE_SIZE = 50;

/** List users with order stats: ?query=&page=1 */
export async function GET(req: Request) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const url = new URL(req.url);
  const query = url.searchParams.get("query")?.trim() || "";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);

  const where = query
    ? {
        OR: [
          { name: { contains: query, mode: "insensitive" as const } },
          { email: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  try {
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          createdAt: true,
          orders: { where: { status: { in: ["PLACED", "SHIPPED"] } }, select: { total: true } },
        },
      }),
    ]);
    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.createdAt.toISOString(),
        orderCount: u.orders.length,
        totalSpent: u.orders.reduce((sum, o) => sum + o.total, 0),
      })),
      page,
      pageSize: PAGE_SIZE,
      total,
    });
  } catch (e) {
    console.error("GET /api/mobile/admin/users:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
