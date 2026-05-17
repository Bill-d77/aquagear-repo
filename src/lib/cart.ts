export const CART_COOKIE_NAME = "cartId";
export const MAX_CART_QUANTITY = 99;

export const cartCookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  path: "/",
} as const;
