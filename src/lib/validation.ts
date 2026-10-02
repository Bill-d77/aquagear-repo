import { z } from "zod";
/**
 * Case-insensitive email match for Prisma. On Postgres, `mode: "insensitive"`
 * compiles to ILIKE, where `_` and `%` are wildcards (a login for "a_min@x"
 * would match "admin@x") — so escape them. Oldest row wins if legacy data has
 * case-variant duplicates, keeping the result deterministic.
 */
export const emailWhere = (email: string) => ({
  where: { email: { equals: email.trim().replace(/[\\%_]/g, "\\$&"), mode: "insensitive" as const } },
  orderBy: { createdAt: "asc" as const },
});

/** Delivery details shared by web checkout and /api/mobile/orders. */
export const shippingFieldsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name is too long"),
  city: z.string().trim().min(1, "City is required").max(80, "City is too long"),
  area: z.string().trim().min(1, "Area is required").max(120, "Area is too long"),
  phoneNumber: z
    .string()
    .trim()
    .min(1, "Phone number is required")
    .max(30, "Phone number is too long")
    .regex(/^[0-9+()\-\s]+$/, "Use digits, spaces, + or -"),
  apartment: z.string().trim().max(200, "Address details are too long").optional(),
  paymentMode: z.enum(["COD"]),
});

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
  // Google Merchant Center — all optional. Empty strings coerce to undefined.
  brand: z.string().trim().max(70).optional().or(z.literal("").transform(() => undefined)),
  gtin: z.string().trim().max(14).regex(/^[0-9]*$/, "GTIN is digits only").optional().or(z.literal("").transform(() => undefined)),
  mpn: z.string().trim().max(70).optional().or(z.literal("").transform(() => undefined)),
  condition: z.enum(["new", "refurbished", "used"]).default("new"),
  googleProductCategory: z.string().trim().max(120).optional().or(z.literal("").transform(() => undefined)),
  // Comma-separated phrases customers use in DMs ("black mask, mask black"); used by the Meta order extractor.
  aliases: z
    .string()
    .max(1000)
    .optional()
    .transform((v) => [...new Set((v ?? "").split(",").map((a) => a.trim().toLowerCase()).filter((a) => a.length >= 2 && a.length <= 60))].slice(0, 30)),
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
