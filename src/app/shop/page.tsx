import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { ensureValidImageUrl } from "@/lib/images";
import { AddToCartButton } from "@/components/cart/AddToCartButton";

export default async function Shop() {
  const products = await prisma.product.findMany({
    where: { isArchived: false },
    orderBy: { createdAt: "desc" },
    select: { id: true, slug: true, imageUrl: true, name: true, price: true },
  });
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-6">Shop</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {products.map((p: { id: string; slug: string; imageUrl: string; name: string; price: number }) => (
          <div key={p.id} className="card group">
            <Link href={`/product/${p.slug}`} className="block">
              <div className="overflow-hidden rounded-xl">
                <Image src={ensureValidImageUrl(p.imageUrl)} alt={p.name} width={600} height={400} className="w-full h-40 object-contain bg-white p-2 group-hover:scale-105 transition" />
              </div>
              <div className="mt-3 font-medium">{p.name}</div>
              <div className="text-sm text-gray-600">{(p.price / 100).toFixed(2)} USD</div>
            </Link>
            <div className="mt-3">
              <AddToCartButton productId={p.id} />
            </div>
            <a
              href={`https://wa.me/96171634379?text=${encodeURIComponent(`Hello, I'm interested in ${p.name} (${p.slug}).`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary w-full mt-2 inline-flex justify-center"
            >
              WhatsApp
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
