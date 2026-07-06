export const CART_COOKIE_NAME = "cartId";
export const MAX_CART_QUANTITY = 99;

export const FREE_DELIVERY_THRESHOLD = 7000; // $70 subtotal

/**
 * Delivery fee for a given subtotal (cents) — free at or above the threshold.
 * The flat rate comes from StoreSettings.shippingFlatRate (admin-configurable).
 */
export const deliveryFeeFor = (subtotalCents: number, flatRateCents: number) =>
  subtotalCents >= FREE_DELIVERY_THRESHOLD ? 0 : flatRateCents;

export const cartCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;
