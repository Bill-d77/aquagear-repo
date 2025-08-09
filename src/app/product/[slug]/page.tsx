import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ensureValidImageUrl } from "@/lib/images";
import { auth } from "@/lib/auth";

export default async function ProductPage({ params }: { params: { slug: string } }) {
  const product = await prisma.product.findUnique({ where: { slug: params.slug } });
  if (!product) return notFound();
  const session = await auth();
  const isAuthed = !!session?.user;
  return (
    <div className="grid md:grid-cols-2 gap-10">
      <div className="card overflow-hidden">
        <Image src={ensureValidImageUrl(product.imageUrl)} alt={product.name} width={800} height={600} className="w-full h-80 object-cover" />
      </div>
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">{product.name}</h1>
        <div className="text-xl">{(product.price/100).toFixed(2)} USD</div>
        <p className="text-gray-700">{product.description}</p>
        <form action={`/api/cart/add?redirect=/product/${product.slug}`} method="post" className="flex items-center gap-3">
          <input type="hidden" name="productId" value={product.id} />
          <input type="number" name="quantity" min="1" defaultValue="1" className="border rounded px-3 py-2 w-24" />
          <button className="btn-primary" type="submit">Add to cart</button>
          {isAuthed && <Link href="/cart" className="btn-outline">Go to cart</Link>}
        </form>
        <a
          href={`https://wa.me/96171634379?text=${encodeURIComponent(`Hello, I'm interested in ${product.name} (${product.slug}).`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-outline inline-flex justify-center"
        >
          WhatsApp
        </a>
      </div>
    </div>
  );
}
