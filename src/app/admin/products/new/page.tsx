import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { ProductImageUpload } from "@/components/admin/ProductImageUpload";

export default async function NewProductPage() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") return <p>Access denied.</p>;

  const categories = await prisma.category.findMany({ select: { id: true, name: true } });
  return (
    <form action="/api/admin/products/create" method="post" className="space-y-4 max-w-lg card">
      <h1 className="text-2xl font-semibold">Add product</h1>
      <input name="name" placeholder="Name" className="border rounded w-full p-2" required />
      <input name="slug" placeholder="Slug" className="border rounded w-full p-2" required />
      <textarea name="description" placeholder="Description" className="border rounded w-full p-2" required></textarea>
      <input name="price" type="number" placeholder="Price in cents" className="border rounded w-full p-2" required />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Product Image</label>
        <ProductImageUpload name="imageUrl" />
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


