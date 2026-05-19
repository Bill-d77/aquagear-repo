import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ProductImageUpload } from "@/components/admin/ProductImageUpload";
import { ProductNameSlug } from "@/components/admin/ProductNameSlug";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";

export const dynamic = "force-dynamic";

export default async function AdminEditProduct({ params }: { params: Promise<{ id: string }> }) {
  // Auth handled by /admin layout via requireAdmin()
  const { id } = await params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: { images: { orderBy: { order: "asc" } } },
  });
  if (!product) return notFound();

  const categories = await prisma.category.findMany({ select: { id: true, name: true } });

  return (
    <form action="/api/admin/products/update" method="post" className="space-y-4 max-w-lg card">
      <h1 className="text-2xl font-semibold">Edit product</h1>
      <input type="hidden" name="id" value={id} />
      <ProductNameSlug defaultName={product.name} defaultSlug={product.slug} />
      <textarea name="description" defaultValue={product.description} className="border rounded w-full p-2" required></textarea>
      <input name="price" type="number" defaultValue={product.price} className="border rounded w-full p-2" required />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Product Images</label>
        <ProductImageUpload
          name="imageUrls"
          defaultValues={
            product.images.length > 0
              ? product.images.map((img) => img.url)
              : product.imageUrl
              ? [product.imageUrl]
              : []
          }
        />
      </div>
      <input name="stock" type="number" defaultValue={product.stock} className="border rounded w-full p-2" required />
      <select name="categoryId" className="border rounded w-full p-2" defaultValue={product.categoryId} required>
        {categories.map((c: { id: string; name: string }) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <div className="flex justify-between items-center">
        <button className="btn-primary">Save</button>
        <DeleteProductButton id={product.id} />
      </div>
    </form>
  );
}
