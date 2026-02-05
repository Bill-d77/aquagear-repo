import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { auth } from "@/lib/auth";
import Image from "next/image";
import { ensureValidImageUrl } from "@/lib/images";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";

export default async function AdminProducts() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") return <p>Access denied.</p>;

  const products = await prisma.product.findMany({
    where: { isArchived: false },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, imageUrl: true, price: true, stock: true },
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Products</h1>
        <Link href="/admin/products/new" className="btn-primary">Add product</Link>
      </div>
      <div className="space-y-2">
        {products.map((p: { id: string; name: string; imageUrl: string; price: number; stock: number }) => (
          <div key={p.id} className="flex items-center justify-between card">
            <div className="flex items-center gap-3">
              <Image src={ensureValidImageUrl(p.imageUrl)} className="w-12 h-12 object-cover rounded" alt={p.name} width={48} height={48} />
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-sm text-gray-600">{(p.price / 100).toFixed(2)} USD, stock {p.stock}</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Link href={`/admin/products/edit/${p.id}`} className="btn-outline">Edit</Link>
              <DeleteProductButton id={p.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
