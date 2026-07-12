import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { ProductQuantitySelector } from "@/components/cart/ProductQuantitySelector";
import { ProductImageGallery } from "@/components/product/ProductImageGallery";
import { getStoreSettings } from "@/lib/settings";
import { ensureValidImageUrl } from "@/lib/images";
import { JsonLd } from "@/components/JsonLd";
import { productSchema, breadcrumbSchema } from "@/lib/seo";
import type { Metadata } from "next";
import PriceTag from "@/components/product/PriceTag";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug },
    select: { name: true, description: true, imageUrl: true, isArchived: true },
  });
  if (!product || product.isArchived) return { title: "Product not found", robots: { index: false } };
  const description = product.description.replace(/\s+/g, " ").trim().slice(0, 160);
  const image = ensureValidImageUrl(product.imageUrl);
  return {
    title: product.name,
    description,
    alternates: { canonical: `/product/${slug}` },
    openGraph: {
      title: `${product.name} · AquaGear`,
      description,
      url: `/product/${slug}`,
      images: image ? [{ url: image, alt: product.name }] : undefined,
    },
    twitter: { card: "summary_large_image", title: product.name, description, images: image ? [image] : undefined },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, session, settings] = await Promise.all([
    prisma.product.findUnique({
      where: { slug },
      include: {
        images: { orderBy: { order: "asc" } },
        category: { select: { name: true } },
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 5,
          select: { rating: true, comment: true, createdAt: true, user: { select: { name: true } } },
        },
        _count: { select: { reviews: true } },
      },
    }),
    auth(),
    getStoreSettings(),
  ]);
  if (!product || product.isArchived) return notFound();
  const isAuthed = !!session?.user;

  // Real ratings only — never fabricate an aggregate for products with no reviews.
  const ratingAgg = product._count.reviews > 0
    ? await prisma.review.aggregate({ where: { productId: product.id }, _avg: { rating: true } })
    : null;
  const gallery = [product.imageUrl, ...product.images.map((i) => i.url)]
    .map((u) => ensureValidImageUrl(u))
    .filter(Boolean);

  const jsonLd = [
    productSchema({
      name: product.name,
      slug: product.slug,
      description: product.description,
      priceCents: product.price,
      inStock: product.stock > 0,
      images: [...new Set(gallery)],
      categoryName: product.category.name,
      sku: product.id,
      brand: product.brand,
      gtin: product.gtin,
      mpn: product.mpn,
      ratingAverage: ratingAgg?._avg.rating ?? undefined,
      ratingCount: product._count.reviews,
      reviews: product.reviews.map((r) => ({
        author: r.user.name,
        rating: r.rating,
        body: r.comment,
        date: r.createdAt.toISOString().slice(0, 10),
      })),
    }),
    breadcrumbSchema([
      { name: "Home", path: "/" },
      { name: "Shop", path: "/shop" },
      { name: product.category.name, path: `/shop?category=${product.categoryId}` },
      { name: product.name, path: `/product/${product.slug}` },
    ]),
  ];

  return (
    <div className="grid md:grid-cols-2 gap-10">
      <JsonLd data={jsonLd} />
      <ProductImageGallery
        name={product.name}
        imageUrl={product.imageUrl}
        images={product.images}
      />
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
        <PriceTag priceCents={product.price} size="lg" />
        <p className="text-gray-700">{product.description}</p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          <ProductQuantitySelector productId={product.id} />
          {isAuthed && <Link href="/cart" className="btn-outline h-12 px-6 flex items-center justify-center w-full sm:w-auto">Go to cart</Link>}
        </div>

        <a
          href={`https://wa.me/${settings.whatsappNumber}?text=${encodeURIComponent(`Hello, I'm interested in ${product.name} (${product.slug}).`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline inline-flex justify-center w-full sm:w-auto"
        >
          WhatsApp
        </a>
      </div>
    </div>
  );
}
