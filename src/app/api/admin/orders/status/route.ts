export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { requireAdminApi, redirectWithError } from "@/lib/admin";
import { orderStatusSchema } from "@/lib/validation";
import { changeOrderStatus, InsufficientStockError, OrderNotFoundError } from "@/lib/order-transitions";

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

  return NextResponse.redirect(new URL(back, req.url));
}
