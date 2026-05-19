import { prisma } from "@/lib/prisma";
import { ProductImageUpload } from "@/components/admin/ProductImageUpload";
import { ProductNameSlug } from "@/components/admin/ProductNameSlug";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  // Auth handled by /admin layout via requireAdmin()
  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  return (
    <form action="/api/admin/products/create" method="post" className="space-y-4 max-w-lg card">
      <h1 className="text-2xl font-semibold">Add product</h1>
      <ProductNameSlug />
      <textarea name="description" placeholder="Description" className="border rounded w-full p-2" required></textarea>
      <input name="price" type="number" placeholder="Price in cents" className="border rounded w-full p-2" required />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Product Images</label>
        <ProductImageUpload name="imageUrls" />
      </div>
      <input name="stock" type="number" placeholder="Stock" className="border rounded w-full p-2" required />
      <select name="categoryId" className="border rounded w-full p-2" required>
        {categories.map((c: { id: string; name: string }) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button className="btn-primary">Create</button>
    </form>
  );
}

