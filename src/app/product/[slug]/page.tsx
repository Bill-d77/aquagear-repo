import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ensureValidImageUrl } from "@/lib/images";
import { auth } from "@/lib/auth";
import { ProductQuantitySelector } from "@/components/cart/ProductQuantitySelector";
import { getStoreSettings } from "@/lib/settings";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await prisma.product.findUnique({
    where: { slug },
    select: { name: true, description: true },
  });
  if (!product) return { title: "Product not found" };
  return {
    title: `${product.name} · AquaGear`,
    description: product.description.slice(0, 160),
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [product, session, settings] = await Promise.all([
    prisma.product.findUnique({ where: { slug } }),
    auth(),
    getStoreSettings(),
  ]);
  if (!product || product.isArchived) return notFound();
  const isAuthed = !!session?.user;
  return (
    <div className="grid md:grid-cols-2 gap-10">
      <div className="card overflow-hidden">
        <Image src={ensureValidImageUrl(product.imageUrl)} alt={product.name} width={800} height={600} className="w-full h-80 object-contain bg-white" />
      </div>
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
        <div className="text-xl">{(product.price / 100).toFixed(2)} USD</div>
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
