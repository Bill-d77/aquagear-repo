import Link from "next/link";
import Image from "next/image";
import { Truck, ShieldCheck, MessageCircle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ensureValidImageUrl } from "@/lib/images";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AquaGear4 — Sea gear for Lebanon",
  description: "Shop life jackets, fenders, floats, kickboards, and more. Built for beach days and boat crews.",
};

export default async function Home() {
  const featured = await prisma.product.findMany({
    where: { isArchived: false },
    orderBy: { createdAt: "desc" },
    take: 4,
    select: { id: true, slug: true, imageUrl: true, name: true, price: true },
  });

  return (
    <div className="page-wrapper">
      {/* Hero */}
      <div className="grid md:grid-cols-2 gap-8 lg:gap-12 items-center">
        <div className="space-y-5">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-extrabold tracking-tight leading-tight">
            Sea gear, floats, and safety for Lebanon
          </h1>
          <p className="text-gray-600 text-base sm:text-lg">
            Shop life jackets, fenders, floats, kickboards, and more. Built for beach days and boat crews.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/shop" className="btn-primary px-6 py-3 text-base">
              Browse products
            </Link>
            <Link href="/account" className="btn-outline px-6 py-3 text-base">
              Sign in
            </Link>
          </div>
        </div>

        {/* Hero visual — branded gradient */}
        <div className="rounded-2xl min-h-[240px] md:min-h-[320px] bg-gradient-to-br from-sky-400 via-sky-500 to-blue-700 flex items-end p-6 shadow-md">
          <span className="text-white font-bold text-lg drop-shadow-sm">Ocean-ready gear for every trip</span>
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="card">
          <Truck className="text-sky-600 mb-3" size={24} aria-hidden="true" />
          <h2 className="font-semibold text-gray-900">Fast pickup</h2>
          <p className="text-gray-600 mt-1 text-sm">Local delivery or pickup in Lebanon.</p>
        </div>
        <div className="card">
          <ShieldCheck className="text-sky-600 mb-3" size={24} aria-hidden="true" />
          <h2 className="font-semibold text-gray-900">Verified safety</h2>
          <p className="text-gray-600 mt-1 text-sm">We stock reliable brands for the sea.</p>
        </div>
        <div className="card">
          <MessageCircle className="text-sky-600 mb-3" size={24} aria-hidden="true" />
          <h2 className="font-semibold text-gray-900">Support</h2>
          <p className="text-gray-600 mt-1 text-sm">WhatsApp for quick answers.</p>
        </div>
      </div>

      {/* Featured products strip */}
      {featured.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="section-title mb-0">Featured products</h2>
            <Link href="/shop" className="text-sm text-sky-700 hover:underline font-medium">
              See all →
            </Link>
          </div>

          {/* Mobile: horizontal scroll strip / Desktop: 4-column grid */}
          <div className="flex gap-4 overflow-x-auto pb-2 sm:pb-0 lg:grid lg:grid-cols-4 lg:overflow-visible">
            {featured.map((p) => (
              <Link
                key={p.id}
                href={`/product/${p.slug}`}
                className="card shrink-0 w-48 sm:w-56 lg:w-auto hover:shadow-md transition-shadow group"
              >
                <div className="overflow-hidden rounded-xl bg-white mb-3">
                  <Image
                    src={ensureValidImageUrl(p.imageUrl)}
                    alt={p.name}
                    width={240}
                    height={240}
                    className="w-full h-32 object-contain p-2 group-hover:opacity-90 transition-opacity"
                  />
                </div>
                <p className="font-medium text-sm text-gray-900 line-clamp-2">{p.name}</p>
                <p className="text-xs text-gray-500 mt-1">{(p.price / 100).toFixed(2)} USD</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
