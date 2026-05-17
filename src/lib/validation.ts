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
  price: z.coerce.number().int().nonnegative(),
  imageUrl: z.string().trim().min(1),
  stock: z.coerce.number().int().nonnegative(),
  categoryId: z.string().trim().min(1),
});

export const productUpdateFormSchema = productFormSchema.extend({
  id: z.string().trim().min(1),
});
