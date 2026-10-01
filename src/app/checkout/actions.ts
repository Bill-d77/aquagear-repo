"use server";

import { z } from "zod";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { cookies, headers } from "next/headers";
import { rateLimit, getClientIpFromHeaders } from "@/lib/rate-limit";
import { redirect } from "next/navigation";
import { CART_COOKIE_NAME, deliveryFeeFor } from "@/lib/cart";
import { getStoreSettings } from "@/lib/settings";
import { auth } from "@/lib/auth";
import { PLACED_ORDER_STATUS } from "@/lib/order-status";
import { notifyNewOrder } from "@/lib/telegram";

const checkoutSchema = z.object({
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

  // Same budget as the app's /api/mobile/orders: 10 orders per IP per 15 minutes.
  // Counted after validation so a customer fixing typos isn't locked out.
  const limit = rateLimit({ key: `order:ip:${getClientIpFromHeaders(await headers())}`, max: 10, windowMs: 15 * 60 * 1000 });
  if (!limit.ok) {
    return { message: "Too many orders. Please try again later." };
  }

  const { name, city, area, phoneNumber, apartment, paymentMode } = validatedFields.data;
  const location = `${city}, ${area}`;
  // Attach the order to the signed-in customer so it shows in their account history.
  const session = await auth();
  const userId = session?.user?.id || undefined;

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

      // Charge today's price, not the price when the item was added to the cart,
      // and record it on the line items so the order shows what was charged.
      for (const item of order.items) {
        if (item.price !== item.product.price) {
          await tx.orderItem.update({ where: { id: item.id }, data: { price: item.product.price } });
        }
      }
      const subtotal = order.items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
      const { shippingFlatRate } = await getStoreSettings();
      const total = subtotal + deliveryFeeFor(subtotal, shippingFlatRate);

      await tx.order.update({
        where: { id: cartId },
        data: {
          userId,
          name,
          location,
          phoneNumber,
          apartment,
          paymentMode,
          status: PLACED_ORDER_STATUS,
          placedAt: new Date(),
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

    // Short-lived proof-of-purchase: the success page only reveals order
    // details (name/address) when this cookie matches the order id, so a
    // shared/guessed URL can't leak another customer's PII.
    cookieStore.set("justOrdered", cartId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/checkout",
      maxAge: 60 * 15,
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
