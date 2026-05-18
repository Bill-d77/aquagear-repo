import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { PackageOpen, MessageCircle } from "lucide-react";
import { ensureValidImageUrl } from "@/lib/images";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import { getStoreSettings } from "@/lib/settings";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop · AquaGear",
  description: "Browse all AquaGear sea gear and safety equipment available in Lebanon.",
};

export default async function Shop({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;

  const [products, categories, settings] = await Promise.all([
    prisma.product.findMany({
      where: {
        isArchived: false,
        ...(category ? { categoryId: category } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, slug: true, imageUrl: true, name: true, price: true, categoryId: true },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    getStoreSettings(),
  ]);

  return (
    <div className="page-wrapper">
      <h1 className="section-title">Shop</h1>

      {/* Category filter pills */}
      <div className="flex gap-2 flex-wrap -mt-6 mb-2">
        <Link
          href="/shop"
          className={`pill ${!category ? "pill-active" : ""}`}
        >
          All
        </Link>
        {categories.map((c) => (
          <Link
            key={c.id}
            href={`/shop?category=${c.id}`}
            className={`pill ${category === c.id ? "pill-active" : ""}`}
          >
            {c.name}
          </Link>
        ))}
      </div>

      {/* Product count */}
      <p className="text-sm text-gray-500 mb-4">
        Showing {products.length} product{products.length !== 1 ? "s" : ""}
      </p>

      {/* Empty state */}
      {products.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <PackageOpen size={48} className="text-gray-300" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-gray-700">No products in this category yet</h2>
          <Link href="/shop" className="btn-primary">Browse all products</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
          {products.map((p) => {
            const waLink = `https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(
              `Hello, I'm interested in ${p.name} (${p.slug}).`
            )}`;
            return (
              <div key={p.id} className="product-card group">
                {/* WhatsApp icon — top right overlay */}
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="icon-action absolute top-2 right-2 text-green-600 z-10"
                  aria-label={`Ask about ${p.name} on WhatsApp`}
                >
                  <MessageCircle size={16} />
                </a>

                <Link href={`/product/${p.slug}`} className="block">
                  <div className="overflow-hidden rounded-xl bg-white mb-3">
                    <Image
                      src={ensureValidImageUrl(p.imageUrl)}
                      alt={p.name}
                      width={320}
                      height={320}
                      className="w-full h-40 object-contain p-2 group-hover:opacity-90 transition-opacity"
                    />
                  </div>
                  <h2 className="mt-1 font-medium text-gray-900 text-sm leading-snug">{p.name}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{(p.price / 100).toFixed(2)} USD</p>
                </Link>

                <div className="mt-3">
                  <AddToCartButton productId={p.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
