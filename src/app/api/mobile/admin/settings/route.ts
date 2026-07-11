export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin } from "@/lib/mobile-admin";
import { storeSettingsSchema } from "@/lib/validation";

const serialize = (s: {
  storeName: string;
  whatsappNumber: string;
  shippingFlatRate: number;
  businessHours: string;
}) => ({
  storeName: s.storeName,
  whatsappNumber: s.whatsappNumber,
  shippingFlatRate: s.shippingFlatRate,
  businessHours: s.businessHours,
});

export async function GET(req: Request) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const settings = await prisma.storeSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  return NextResponse.json({ settings: serialize(settings) });
}

export async function PATCH(req: Request) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;

  const parsed = storeSettingsSchema.partial().safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const settings = await prisma.storeSettings.upsert({
    where: { id: "singleton" },
    update: parsed.data,
    create: { id: "singleton", ...parsed.data },
  });
  return NextResponse.json({ settings: serialize(settings) });
}
