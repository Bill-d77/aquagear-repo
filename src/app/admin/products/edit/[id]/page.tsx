import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";

export default async function AdminEditProduct({ params }: { params: { id: string } }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") return <p>Access denied.</p>;

  const product = await prisma.product.findUnique({ where: { id: params.id } });
  if (!product) return notFound();

  const categories = await prisma.category.findMany({ select: { id: true, name: true } });

  return (
    <form action="/api/admin/products/update" method="post" className="space-y-4 max-w-lg card">
      <h1 className="text-2xl font-semibold">Edit product</h1>
      <input type="hidden" name="id" value={product.id} />
      <input name="name" defaultValue={product.name} className="border rounded w-full p-2" required />
      <input name="slug" defaultValue={product.slug} className="border rounded w-full p-2" required />
      <textarea name="description" defaultValue={product.description} className="border rounded w-full p-2" required></textarea>
      <input name="price" type="number" defaultValue={product.price} className="border rounded w-full p-2" required />
      <input name="imageUrl" defaultValue={product.imageUrl} className="border rounded w-full p-2" required />
      <input name="stock" type="number" defaultValue={product.stock} className="border rounded w-full p-2" required />
      <select name="categoryId" className="border rounded w-full p-2" defaultValue={product.categoryId} required>
        {categories.map((c: { id: string; name: string }) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
      <button className="btn-primary">Save</button>
    </form>
  );
} 