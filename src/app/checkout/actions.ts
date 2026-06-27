"use server";

import { z } from "zod";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CART_COOKIE_NAME, deliveryFeeFor } from "@/lib/cart";
import { PLACED_ORDER_STATUS } from "@/lib/order-status";
import { notifyNewOrder } from "@/lib/telegram";

const checkoutSchema = z.object({
  name: z.string().min(1, "Name is required"),
  city: z.string().min(1, "City is required"),
  area: z.string().min(1, "Area is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  apartment: z.string().optional(),
  paymentMode: z.enum(["COD"]),
});

export async function submitOrder(prevState: any, formData: FormData) {
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE_NAME)?.value;

  if (!cartId) {
    return { message: "Cart is empty" };
  }

  const rawData = {
    name: formData.get("name"),
    city: formData.get("city"),
    area: formData.get("area"),
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

  const { name, city, area, phoneNumber, apartment, paymentMode } = validatedFields.data;
  const location = `${city}, ${area}`;

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: cartId, status: "PENDING" },
        include: { items: { include: { product: true } } },
      });

      if (!order || order.items.length === 0) {
        throw new Error("Cart is empty");
      }

      for (const item of order.items) {
        if (item.product.isArchived || item.product.stock < item.quantity) {
          throw new Error(`Insufficient stock for ${item.product.name}`);
        }
      }

      const subtotal = order.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const total = subtotal + deliveryFeeFor(subtotal);

      await tx.order.update({
        where: { id: cartId },
        data: {
          name,
          location,
          phoneNumber,
          apartment,
          paymentMode,
          status: PLACED_ORDER_STATUS,
          total,
        },
      });

      for (const item of order.items) {
        const updated = await tx.product.updateMany({
          where: {
            id: item.productId,
            isArchived: false,
            stock: { gte: item.quantity },
          },
          data: { stock: { decrement: item.quantity } }
        });
        if (updated.count !== 1) {
          throw new Error(`Insufficient stock for ${item.product.name}`);
        }
      }
    });

    cookieStore.set(CART_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });

    // Fire the Telegram admin alert after the response is sent — never delays
    // or breaks checkout. `cartId` is the order id (notifyNewOrder is non-throwing).
    after(() => notifyNewOrder(cartId));

  } catch (e) {
    console.error(e);
    return { message: e instanceof Error ? e.message : "Failed to submit order" };
  }

  redirect(`/checkout/success?order=${cartId}`);
}
