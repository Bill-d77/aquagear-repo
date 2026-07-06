export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FREE_DELIVERY_THRESHOLD } from "@/lib/cart";

export async function GET() {
  try {
    const settings = await prisma.storeSettings.findUnique({ where: { id: "singleton" } });
    return NextResponse.json({
      storeName: settings?.storeName ?? "AquaGear",
      whatsappNumber: settings?.whatsappNumber ?? "96171634379",
      businessHours: settings?.businessHours ?? "Mon-Sat 9:00-18:00",
      deliveryFee: settings?.shippingFlatRate ?? 400,
      freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
    });
  } catch (e) {
    console.error("GET /api/mobile/settings:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
