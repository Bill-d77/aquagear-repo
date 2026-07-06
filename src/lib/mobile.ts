// Shared helpers for the /api/mobile/* routes consumed by the iOS app.
import { SignJWT, jwtVerify } from "jose";
import type { Prisma } from "@prisma/client";

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    (process.env.NODE_ENV === "development" ? "dev-secret-change-me" : "")
);

const AUDIENCE = "aquagear-mobile";

export interface MobileUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export async function signMobileToken(user: MobileUser): Promise<string> {
  return new SignJWT({ email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.id)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("90d")
    .sign(secret);
}

/** Resolve the Bearer token on a request to a user, or null. */
export async function getMobileUser(req: Request): Promise<MobileUser | null> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  try {
    const { payload } = await jwtVerify(header.slice(7), secret, { audience: AUDIENCE });
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: String(payload.email ?? ""),
      name: String(payload.name ?? ""),
      role: String(payload.role ?? "USER"),
    };
  } catch {
    return null;
  }
}

export const productInclude = {
  category: { select: { id: true, name: true } },
  images: { orderBy: { order: "asc" as const }, select: { url: true } },
  reviews: { select: { rating: true } },
} satisfies Prisma.ProductInclude;

type ProductWithRels = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/** Flat JSON shape the app decodes. Prices are integer cents (USD). */
export function serializeProduct(p: ProductWithRels) {
  const gallery = [p.imageUrl, ...p.images.map((i) => i.url)].filter(Boolean);
  const images = [...new Set(gallery)];
  const ratings = p.reviews.map((r) => r.rating);
  const rating = ratings.length
    ? ratings.reduce((a, b) => a + b, 0) / ratings.length
    : 0;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: p.price,
    stock: p.stock,
    images,
    categoryId: p.category.id,
    categoryName: p.category.name,
    rating: Math.round(rating * 10) / 10,
    reviewCount: ratings.length,
    createdAt: p.createdAt.toISOString(),
  };
}
