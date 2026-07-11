export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { requireMobileAdmin } from "@/lib/mobile-admin";
import { getDashboardData } from "@/lib/dashboard-data";
import { LOW_STOCK_THRESHOLD } from "@/lib/admin";

export async function GET(req: Request) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;

  try {
    const data = await getDashboardData();
    return NextResponse.json({
      ...data,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      recentOrders: data.recentOrders.map((o) => ({
        ...o,
        createdAt: o.createdAt.toISOString(),
      })),
    });
  } catch (e) {
    console.error("GET /api/mobile/admin/dashboard:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
