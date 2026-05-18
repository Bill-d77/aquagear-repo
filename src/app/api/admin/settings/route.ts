export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { storeSettingsSchema } from "@/lib/validation";
import { updateStoreSettings } from "@/lib/settings";

export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  const form = await req.formData();
  const parsed = storeSettingsSchema.safeParse({
    storeName: form.get("storeName"),
    whatsappNumber: form.get("whatsappNumber"),
    shippingFlatRate: form.get("shippingFlatRate"),
    businessHours: form.get("businessHours"),
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await updateStoreSettings(parsed.data);
  return NextResponse.redirect(new URL("/admin/settings", req.url));
}
