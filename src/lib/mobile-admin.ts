// Shared helpers for the /api/mobile/admin/* routes consumed by the admin apps.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileUser, type MobileUser } from "@/lib/mobile";
import type { Prisma } from "@prisma/client";

/**
 * Bearer-token admin gate. Mobile tokens live 90 days with no revocation, so
 * the role claim can be stale — always re-check the DB role (see mobile.ts).
 *
 * Pattern:
 *   const guard = await requireMobileAdmin(req);
 *   if (guard instanceof NextResponse) return guard;
 */
export async function requireMobileAdmin(req: Request): Promise<MobileUser | NextResponse> {
  const user = await getMobileUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const fresh = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } });
  if (fresh?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return { ...user, role: "ADMIN" };
}

export const adminProductInclude = {
  category: { select: { id: true, name: true } },
  images: { orderBy: { order: "asc" as const }, select: { url: true } },
} satisfies Prisma.ProductInclude;

type AdminProduct = Prisma.ProductGetPayload<{ include: typeof adminProductInclude }>;

/** Prices are integer cents. Unlike the storefront shape, includes admin-only fields. */
export function serializeAdminProduct(p: AdminProduct) {
  const gallery = [p.imageUrl, ...p.images.map((i) => i.url)].filter(Boolean);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    price: p.price,
    stock: p.stock,
    isArchived: p.isArchived,
    images: [...new Set(gallery)],
    categoryId: p.category.id,
    categoryName: p.category.name,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export const adminOrderInclude = {
  items: { include: { product: { select: { id: true, name: true, imageUrl: true, slug: true } } } },
  user: { select: { id: true, email: true, name: true } },
} satisfies Prisma.OrderInclude;

type AdminOrder = Prisma.OrderGetPayload<{ include: typeof adminOrderInclude }>;

export function serializeAdminOrder(o: AdminOrder) {
  return {
    id: o.id,
    total: o.total,
    status: o.status,
    name: o.name,
    location: o.location,
    phoneNumber: o.phoneNumber,
    apartment: o.apartment,
    paymentMode: o.paymentMode,
    notes: o.notes,
    trackingNumber: o.trackingNumber,
    carrier: o.carrier,
    createdAt: o.createdAt.toISOString(),
    placedAt: o.placedAt?.toISOString() ?? null,
    shippedAt: o.shippedAt?.toISOString() ?? null,
    canceledAt: o.canceledAt?.toISOString() ?? null,
    lastContactedAt: o.lastContactedAt?.toISOString() ?? null,
    customer: o.user ? { id: o.user.id, email: o.user.email, name: o.user.name } : null,
    items: o.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.product.name,
      productImageUrl: i.product.imageUrl,
      quantity: i.quantity,
      price: i.price,
    })),
  };
}
