import { z } from "zod";
export const roleSchema = z.enum(["USER", "ADMIN"]);
export const orderStatusSchema = z.enum(["PENDING", "PLACED", "SHIPPED", "CANCELED"]);

export const productFormSchema = z.object({
  name: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"),
  description: z.string().trim().min(1),
  // Cents. Upper bounds catch fat-finger typos and stay well inside INT4.
  price: z.coerce.number().int().nonnegative().max(10_000_000, "Price can't exceed $100,000"),
  /** Array of image URLs – at least one is required. The first is treated as primary. */
  imageUrls: z.array(z.string().trim().min(1)).min(1, "At least one image is required"),
  stock: z.coerce.number().int().nonnegative().max(1_000_000),
  categoryId: z.string().trim().min(1),
});

export const productUpdateFormSchema = productFormSchema.extend({
  id: z.string().trim().min(1),
});

export const stockUpdateSchema = z.object({
  id: z.string().trim().min(1),
  stock: z.coerce.number().int().nonnegative().max(1_000_000),
});

export const categoryFormSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const categoryUpdateFormSchema = categoryFormSchema.extend({
  id: z.string().trim().min(1),
});

export const storeSettingsSchema = z.object({
  storeName: z.string().trim().min(1).max(80),
  whatsappNumber: z
    .string()
    .trim()
    .min(8)
    .regex(/^[0-9]+$/, "Digits only (e.g., 96171634379)"),
  shippingFlatRate: z.coerce.number().int().nonnegative().max(100_000, "Delivery fee can't exceed $1,000"),
  businessHours: z.string().trim().max(120),
});

export const orderNotesSchema = z.object({
  id: z.string().trim().min(1),
  notes: z.string().max(2000).optional().default(""),
});

export const orderTrackingSchema = z.object({
  id: z.string().trim().min(1),
  trackingNumber: z.string().trim().max(120).optional().default(""),
  carrier: z.string().trim().max(80).optional().default(""),
});
