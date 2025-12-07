"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const checkoutSchema = z.object({
  name: z.string().min(1, "Name is required"),
  location: z.string().min(1, "Location is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  apartment: z.string().optional(),
  paymentMode: z.enum(["COD"]),
});

export async function submitOrder(prevState: any, formData: FormData) {
  const cartId = cookies().get("cartId")?.value;

  if (!cartId) {
    return { message: "Cart is empty" };
  }

  const rawData = {
    name: formData.get("name"),
    location: formData.get("location"),
    phoneNumber: formData.get("phoneNumber"),
    apartment: formData.get("apartment"),
    paymentMode: formData.get("paymentMode"),
  };

  const validatedFields = checkoutSchema.safeParse(rawData);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Please fix the errors below",
    };
  }

  const { name, location, phoneNumber, apartment, paymentMode } = validatedFields.data;

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Update order details
      await tx.order.update({
        where: { id: cartId },
        data: {
          name,
          location,
          phoneNumber,
          apartment,
          paymentMode,
          status: "PLACED",
        },
      });

      // 2. Get items to decrement stock
      const orderItems = await tx.orderItem.findMany({
        where: { orderId: cartId },
        select: { productId: true, quantity: true }
      });

      // 3. Decrement stock
      for (const item of orderItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } }
        });
      }
    });

    // Clear cart cookie
    cookies().delete("cartId");

  } catch (e) {
    console.error(e);
    return { message: "Failed to submit order" };
  }

  redirect("/checkout/success");
}
