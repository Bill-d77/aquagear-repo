export const CART_COOKIE_NAME = "cartId";
export const MAX_CART_QUANTITY = 99;

/** Flat delivery fee in cents, added to every order's total. */
export const DELIVERY_FEE = 400;

export const cartCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;
