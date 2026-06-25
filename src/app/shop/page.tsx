import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import {
  PackageOpen,
  Search,
  Heart,
  Star,
  Waves,
  LifeBuoy,
  Anchor,
  Package,
  Truck,
  ShieldCheck,
  BadgeCheck,
} from "lucide-react";
import { ensureValidImageUrl } from "@/lib/images";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import PriceTag from "@/components/product/PriceTag";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop · AquaGear",
  description: "Browse premium marine, diving, boating, and beach equipment available in Lebanon.",
};

// ponytail: Best Selling needs order data; rating values, brand/color/size filters
// need schema fields that don't exist. Sort offers only what the DB can actually do.
const SORTS: Record<string, { label: string; orderBy: Prisma.ProductOrderByWithRelationInput }> = {
  newest: { label: "Newest", orderBy: { createdAt: "desc" } },
  rated: { label: "Most Reviewed", orderBy: { reviews: { _count: "desc" } } },
  price_asc: { label: "Price: Low to High", orderBy: { price: "asc" } },
  price_desc: { label: "Price: High to Low", orderBy: { price: "desc" } },
  name: { label: "Name: A–Z", orderBy: { name: "asc" } },
};

function categoryIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("life") || n.includes("safety") || n.includes("float")) return LifeBuoy;
  if (n.includes("boat") || n.includes("dive") || n.includes("diving")) return Anchor;
  if (n.includes("bag") || n.includes("waterproof") || n.includes("cooler")) return Package;
  return Waves;
}

function Stars({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center gap-0.5 text-amber-400" aria-hidden="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} size={13} className="fill-current" />
        ))}
      </div>
      <span className="text-xs text-gray-400">
        {count > 0 ? `(${count})` : "No reviews yet"}
      </span>
    </div>
  );
}

export default async function Shop({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; sort?: string; instock?: string }>;
}) {
  const { category, q, sort, instock } = await searchParams;
  const sortKey = sort && SORTS[sort] ? sort : "newest";

  const where: Prisma.ProductWhereInput = {
    isArchived: false,
    ...(category ? { categoryId: category } : {}),
    ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    ...(instock ? { stock: { gt: 0 } } : {}),
  };

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: SORTS[sortKey].orderBy,
      select: {
        id: true,
        slug: true,
        imageUrl: true,
        name: true,
        description: true,
        price: true,
        stock: true,
        createdAt: true,
        _count: { select: { reviews: true } },
      },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, _count: { select: { products: true } } },
    }),
  ]);

  const now = Date.now();
  const isNew = (d: Date) => now - d.getTime() < 14 * 24 * 60 * 60 * 1000;

  return (
    <div className="space-y-12 sm:space-y-16 py-6 sm:py-10">
      {/* ───────── Hero ───────── */}
      <section className="fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br from-sky-600 via-blue-700 to-blue-900 px-6 sm:px-10 py-12 sm:py-16 text-white">
        <Waves className="absolute -right-6 -bottom-6 opacity-10" size={220} aria-hidden="true" />
        <div className="relative max-w-2xl space-y-4">
          <h1 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold tracking-tight">
            Shop Marine Equipment
          </h1>
          <p className="text-white/85 text-base sm:text-lg">
            Everything you need for boating, diving, paddleboarding, swimming, and outdoor
            adventures — trusted by professionals across Lebanon.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <a href="#products" className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 font-semibold text-blue-800 hover:bg-sky-50 transition">
              Browse Products
            </a>
            <a href="#categories" className="inline-flex items-center justify-center rounded-lg border border-white/50 bg-white/10 backdrop-blur px-6 py-3 font-medium text-white hover:bg-white/20 transition">
              Explore Categories
            </a>
          </div>
        </div>
      </section>

      {/* ───────── Search + filter bar (sticky, native GET form — no client JS) ───────── */}
      <form
        method="get"
        action="/shop"
        className="sticky top-20 z-30 rounded-3xl border bg-white/90 backdrop-blur shadow-lg p-4 sm:p-5 grid gap-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
      >
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Search by product…"
            className="w-full rounded-xl border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <select name="category" defaultValue={category ?? ""} className="rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select name="sort" defaultValue={sortKey} className="rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500">
          {Object.entries(SORTS).map(([key, { label }]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm text-gray-600 whitespace-nowrap">
            <input type="checkbox" name="instock" value="1" defaultChecked={!!instock} className="rounded border-gray-300 text-sky-600 focus:ring-sky-500" />
            In Stock
          </label>
          <button type="submit" className="btn-primary px-5 py-2.5 text-sm">Apply</button>
        </div>
      </form>

      {/* ───────── Category cards ───────── */}
      {categories.length > 0 && (
        <section id="categories">
          <h2 className="section-title">Shop by Category</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 -mt-2">
            <Link
              href="/shop"
              className={`group shrink-0 w-40 rounded-2xl border p-5 text-center transition-all hover:-translate-y-1 hover:shadow-lg ${!category ? "border-sky-500 bg-sky-50" : "bg-white hover:border-sky-200"}`}
            >
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 text-white">
                <Waves size={22} />
              </div>
              <div className="font-semibold text-gray-900 text-sm">All Products</div>
              <div className="text-xs text-gray-500 mt-0.5">{products.length} items</div>
            </Link>
            {categories.map((c) => {
              const Icon = categoryIcon(c.name);
              const active = category === c.id;
              return (
                <Link
                  key={c.id}
                  href={`/shop?category=${c.id}`}
                  className={`group shrink-0 w-40 rounded-2xl border p-5 text-center transition-all hover:-translate-y-1 hover:shadow-lg ${active ? "border-sky-500 bg-sky-50" : "bg-white hover:border-sky-200"}`}
                >
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-500 to-blue-700 text-white transition-transform group-hover:scale-105">
                    <Icon size={22} />
                  </div>
                  <div className="font-semibold text-gray-900 text-sm line-clamp-1">{c.name}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{c._count.products} items</div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ───────── Product count ───────── */}
      <section id="products" className="!mt-10">
        <p className="text-sm text-gray-500 mb-6">
          Showing <span className="font-semibold text-gray-900">{products.length}</span> premium
          marine product{products.length !== 1 ? "s" : ""}
          {q ? <> for “<span className="font-medium text-gray-700">{q}</span>”</> : null}
        </p>

        {/* ───────── Empty state ───────── */}
        {products.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <PackageOpen size={48} className="text-gray-300" aria-hidden="true" />
            <h2 className="text-lg font-semibold text-gray-700">No products match your filters</h2>
            <p className="text-sm text-gray-500">Try a different search, or reset to browse everything.</p>
            <Link href="/shop" className="btn-primary">Reset filters</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 lg:gap-8">
            {products.map((p) => (
              <div key={p.id} className="card group relative flex flex-col hover:shadow-lg hover:-translate-y-1 hover:border-sky-300 transition-all duration-300">
                {/* Badge */}
                <span className={`absolute top-3 left-3 z-10 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide text-white ${isNew(p.createdAt) ? "bg-emerald-500" : "bg-sky-600"}`}>
                  {isNew(p.createdAt) ? "NEW" : "SALE"}
                </span>
                {/* Wishlist — ponytail: decorative, no wishlist backend exists */}
                <button type="button" aria-label="Add to wishlist" className="absolute top-3 right-3 z-10 icon-action text-gray-500 hover:text-rose-500">
                  <Heart size={16} />
                </button>

                <Link href={`/product/${p.slug}`} className="block">
                  <div className="overflow-hidden rounded-xl bg-white mb-3">
                    <Image
                      src={ensureValidImageUrl(p.imageUrl)}
                      alt={p.name}
                      width={320}
                      height={320}
                      className="w-full h-44 object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <h2 className="font-medium text-gray-900 text-sm leading-snug line-clamp-2 min-h-[2.5rem]">{p.name}</h2>
                </Link>

                <div className="mt-1.5"><Stars count={p._count.reviews} /></div>
                <PriceTag priceCents={p.price} />

                {/* Stock / urgency */}
                <div className="mt-2 text-xs">
                  {p.stock === 0 ? (
                    <span className="text-gray-400">Out of stock</span>
                  ) : p.stock <= 5 ? (
                    <span className="font-medium text-amber-600">Only {p.stock} left</span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-emerald-600">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> In Stock
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  {p.stock === 0 ? (
                    <button disabled className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-400 cursor-not-allowed">
                      Out of stock
                    </button>
                  ) : (
                    <AddToCartButton productId={p.id} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ───────── Trust section ───────── */}
      <section className="grid gap-6 md:grid-cols-3 border-t pt-12">
        {[
          { icon: Truck, title: "Fast Delivery", desc: "Quick shipping and local pickup across Lebanon." },
          { icon: ShieldCheck, title: "Secure Payments", desc: "Safe, protected checkout on every order." },
          { icon: BadgeCheck, title: "Premium Quality", desc: "Trusted, genuine marine equipment." },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="card flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Icon size={20} />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-600 mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
