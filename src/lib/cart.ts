export const CART_COOKIE_NAME = "cartId";
export const MAX_CART_QUANTITY = 99;

/** Flat delivery fee in cents. Waived once the subtotal reaches the free-delivery threshold. */
export const DELIVERY_FEE = 400;
export const FREE_DELIVERY_THRESHOLD = 7000; // $70 subtotal

/** Delivery fee for a given subtotal (cents) — free at or above the threshold. */
export const deliveryFeeFor = (subtotalCents: number) =>
  subtotalCents >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE;

export const cartCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;
