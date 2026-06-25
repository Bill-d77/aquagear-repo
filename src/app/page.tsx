import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  Truck,
  MessageCircle,
  BadgeCheck,
  ArrowRight,
  Heart,
  Star,
  Waves,
  LifeBuoy,
  Anchor,
  Package,
  RotateCcw,
  CreditCard,
  MapPin,
  Award,
  Users,
  Headphones,
  ShoppingBag,
} from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ensureValidImageUrl } from "@/lib/images";
import { AddToCartButton } from "@/components/cart/AddToCartButton";
import PriceTag from "@/components/product/PriceTag";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "AquaGear4 — Premium marine equipment in Lebanon",
  description:
    "Shop professional life jackets, diving gear, floats, waterproof bags, and marine safety essentials. Trusted by swimmers, divers, and boat crews across Lebanon.",
};

// ponytail: stats, badges, ratings, and hero/promo photos are placeholders —
// the schema has no rating/badge/isFeatured fields. Swap for real data when added.
const STATS = [
  { icon: ShoppingBag, value: "500+", label: "Products" },
  { icon: ShieldCheck, value: "10+", label: "Trusted Brands" },
  { icon: Users, value: "1000+", label: "Happy Customers" },
  { icon: Headphones, value: "24/7", label: "Support" },
];

const HERO_IMG = "https://images.unsplash.com/photo-1545972154-9bb223aac798?w=1200&q=70";
const STATS_IMG = "https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?w=1600&q=60";
const PROMO_IMG = "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1600&q=60";

function categoryIcon(name: string) {
  const n = name.toLowerCase();
  if (n.includes("life") || n.includes("safety")) return LifeBuoy;
  if (n.includes("boat") || n.includes("dive") || n.includes("diving")) return Anchor;
  if (n.includes("bag") || n.includes("waterproof")) return Package;
  return Waves;
}

function Stars() {
  return (
    <div className="flex items-center gap-0.5 text-amber-400" aria-hidden="true">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} size={14} className="fill-current" />
      ))}
    </div>
  );
}

export default async function Home() {
  const [featured, categories] = await Promise.all([
    prisma.product.findMany({
      where: { isArchived: false },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: { id: true, slug: true, imageUrl: true, name: true, description: true, price: true },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  const badges = ["BEST SELLER", "NEW", "SALE", "SALE"];

  return (
    <div className="space-y-16 sm:space-y-24 py-6 sm:py-10">
      {/* ───────── Hero ───────── */}
      <section className="fade-up relative overflow-hidden rounded-3xl shadow-xl min-h-[520px] sm:min-h-[560px] lg:min-h-[600px] flex items-center">
        {/* Full-bleed background photo (object-cover keeps it sharp & responsive).
            ponytail: to use your exact asset, drop it in /public and set HERO_IMG = "/hero.jpg". */}
        <Image
          src={HERO_IMG}
          alt="Paddler exploring crystal-clear water at golden hour with AquaGear equipment"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        {/* Dark gradient — heavy on the left for text contrast, clear on the right to show the photo */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-950/85 via-blue-950/55 to-transparent" />

        {/* Overlaid content (HTML/CSS, not baked into the image) */}
        <div className="relative w-full px-6 sm:px-10 lg:px-14 py-12 text-white">
          <div className="max-w-xl space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/10 backdrop-blur px-4 py-1.5 text-sm font-medium shadow-sm">
              🇱🇧 Trusted Marine Equipment in Lebanon
            </span>
            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold tracking-tight leading-[1.05] drop-shadow-sm">
              Everything You Need for{" "}
              <span className="bg-gradient-to-r from-sky-300 to-sky-500 bg-clip-text text-transparent">
                Life on the Water
              </span>
            </h1>
            <p className="text-white/85 text-base sm:text-lg max-w-lg">
              Discover professional life jackets, diving gear, floats, dry bags, kickboards, safety
              equipment, and boating essentials — trusted by swimmers, boat owners, and professionals
              across Lebanon.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/shop" className="btn-primary px-6 py-3 text-base group">
                Shop Collection
                <ArrowRight size={18} className="ml-2 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/shop"
                className="inline-flex items-center justify-center rounded-lg border border-white/50 bg-white/5 backdrop-blur px-6 py-3 text-base font-medium text-white hover:bg-white/15 transition group"
              >
                Browse Categories
                <ArrowRight size={18} className="ml-2 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-3 pt-2 text-sm text-white/90">
              <span className="inline-flex items-center gap-2"><ShieldCheck size={16} className="text-sky-300" /> Secure Checkout</span>
              <span className="inline-flex items-center gap-2"><Truck size={16} className="text-sky-300" /> Fast Delivery Across Lebanon</span>
              <span className="inline-flex items-center gap-2"><MessageCircle size={16} className="text-sky-300" /> WhatsApp Support</span>
              <span className="inline-flex items-center gap-2"><BadgeCheck size={16} className="text-sky-300" /> Genuine Products</span>
            </div>
          </div>
        </div>

        {/* Floating glass metrics card — hidden on small screens to avoid covering the photo subject */}
        <div className="glass absolute bottom-6 right-6 hidden md:grid grid-cols-4 gap-3 rounded-2xl p-4 text-white max-w-md">
          {[
            { icon: Star, label: "Rated by Customers" },
            { icon: Truck, label: "Fast Delivery" },
            { icon: ShieldCheck, label: "Marine Quality" },
            { icon: Award, label: "Trusted by Professionals" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex flex-col items-center text-center gap-1">
              <Icon size={20} className="drop-shadow" />
              <span className="text-[11px] leading-tight font-medium drop-shadow">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── Category pills ───────── */}
      {categories.length > 0 && (
        <section className="-mt-6 sm:-mt-12">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {categories.map((c) => {
              const Icon = categoryIcon(c.name);
              return (
                <Link
                  key={c.id}
                  href={`/shop?category=${c.id}`}
                  className="shrink-0 inline-flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium shadow-sm hover:bg-sky-50 hover:border-sky-200 transition"
                >
                  <Icon size={16} className="text-sky-600" />
                  {c.name}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ───────── Feature cards ───────── */}
      <section className="grid gap-6 md:grid-cols-3">
        {[
          { icon: Truck, title: "Fast Delivery", desc: "Delivering across Lebanon with quick shipping and local pickup." },
          { icon: ShieldCheck, title: "Verified Marine Quality", desc: "Carefully selected products built for safety and durability." },
          { icon: Headphones, title: "Customer Support", desc: "Fast assistance via WhatsApp before and after your purchase." },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="card hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sky-50 text-sky-600 mb-4">
              <Icon size={22} />
            </div>
            <h3 className="font-semibold text-gray-900 text-lg">{title}</h3>
            <p className="text-gray-600 mt-1 text-sm">{desc}</p>
            <div className="mt-4 inline-flex items-center justify-center w-9 h-9 rounded-full border text-sky-600 hover:bg-sky-50 transition">
              <ArrowRight size={16} />
            </div>
          </div>
        ))}
      </section>

      {/* ───────── Statistics banner ───────── */}
      <section className="relative overflow-hidden rounded-3xl">
        <Image src={STATS_IMG} alt="" fill sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-blue-900/80" />
        <div className="relative grid grid-cols-2 md:grid-cols-4 gap-8 px-6 py-10 sm:py-12 text-white">
          {STATS.map(({ icon: Icon, value, label }) => (
            <div key={label} className="flex flex-col items-center text-center gap-1 md:border-r md:border-white/20 md:last:border-r-0">
              <Icon size={26} className="mb-1 opacity-90" />
              <span className="text-3xl sm:text-4xl font-extrabold">{value}</span>
              <span className="text-sm text-white/80">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ───────── Featured products ───────── */}
      {featured.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="section-title mb-0">Featured Products</h2>
            <Link href="/shop" className="text-sm font-medium text-sky-700 hover:underline inline-flex items-center gap-1">
              See all products <ArrowRight size={15} />
            </Link>
          </div>
          <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
            {featured.map((p, i) => (
              <div key={p.id} className="card group relative flex flex-col hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <span className="absolute top-3 left-3 z-10 rounded-full bg-sky-600 px-2.5 py-1 text-[10px] font-bold tracking-wide text-white">
                  {badges[i] ?? "SALE"}
                </span>
                <button
                  type="button"
                  aria-label="Add to wishlist"
                  className="absolute top-3 right-3 z-10 icon-action text-gray-500 hover:text-rose-500"
                >
                  {/* ponytail: decorative — no wishlist backend exists yet */}
                  <Heart size={16} />
                </button>

                <Link href={`/product/${p.slug}`} className="block">
                  <div className="overflow-hidden rounded-xl bg-white mb-3">
                    <Image
                      src={ensureValidImageUrl(p.imageUrl)}
                      alt={p.name}
                      width={320}
                      height={320}
                      className="w-full h-40 object-contain p-2 transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <h3 className="font-medium text-gray-900 text-sm leading-snug line-clamp-1">{p.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{p.description}</p>
                </Link>

                <div className="flex items-center gap-1.5 mt-2">
                  <Stars />
                  <span className="text-xs text-gray-400">(128)</span>
                </div>

                <PriceTag priceCents={p.price} />

                <div className="mt-3">
                  <AddToCartButton productId={p.id} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ───────── Promotional banner ───────── */}
      <section className="relative overflow-hidden rounded-3xl">
        <Image src={PROMO_IMG} alt="" fill sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-blue-900/90 to-blue-900/50" />
        <div className="relative px-6 sm:px-10 py-12 sm:py-16 max-w-xl text-white">
          <span className="inline-flex items-center gap-2 text-amber-300 text-sm font-semibold mb-3">
            ☀ New Summer Collection
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold">Ready for Your Next Adventure?</h2>
          <p className="mt-2 text-white/80">
            Explore our newest gear built for performance, comfort, and safety — in and out of the water.
          </p>
          <Link href="/shop" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-semibold text-blue-900 hover:bg-sky-50 transition">
            Explore Collection <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* ───────── Benefits strip ───────── */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-6 border-t pt-10">
        {[
          { icon: Truck, title: "Free Delivery", desc: "On orders over $50" },
          { icon: RotateCcw, title: "Easy Returns", desc: "30-day return policy" },
          { icon: CreditCard, title: "Secure Payments", desc: "100% protected checkout" },
          { icon: MapPin, title: "Local Support", desc: "We're here to help" },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="flex items-center gap-3">
            <Icon size={22} className="text-sky-600 shrink-0" />
            <div>
              <div className="font-semibold text-gray-900 text-sm">{title}</div>
              <div className="text-xs text-gray-500">{desc}</div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
