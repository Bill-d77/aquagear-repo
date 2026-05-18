import { prisma } from "@/lib/prisma";
import { cache } from "react";

const SINGLETON_ID = "singleton";

/**
 * Read the store settings singleton row. Creates it with defaults on first
 * access — the @default values in schema.prisma mean we never see a missing
 * row in practice, but upsert keeps the call idempotent.
 *
 * `cache()` dedupes calls within a single request so the dashboard layout
 * (header) and the page (body) only hit the DB once.
 */
export const getStoreSettings = cache(async () => {
  return prisma.storeSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
  });
});

export interface StoreSettingsUpdate {
  storeName?: string;
  whatsappNumber?: string;
  shippingFlatRate?: number;
  businessHours?: string;
}

export async function updateStoreSettings(patch: StoreSettingsUpdate) {
  return prisma.storeSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...patch },
    update: patch,
  });
}
