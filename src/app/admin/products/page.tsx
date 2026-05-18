import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { ensureValidImageUrl } from "@/lib/images";
import { DeleteProductButton } from "@/components/admin/DeleteProductButton";
import { Search, Package, AlertTriangle, Archive } from "lucide-react";
import { LOW_STOCK_THRESHOLD } from "@/lib/admin";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Products · AquaGear Admin",
};

type SearchParams = Promise<{ q?: string; category?: string; archived?: string; lowStock?: string }>;

export default async function AdminProducts({ searchParams }: { searchParams: SearchParams }) {
  // Auth handled by /admin layout
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const categoryFilter = sp.category || "";
  const showArchived = sp.archived === "1";
  const lowStockOnly = sp.lowStock === "1";

  const where: Prisma.ProductWhereInput = {
    isArchived: showArchived,
  };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }
  if (categoryFilter) {
    where.categoryId = categoryFilter;
  }
  if (lowStockOnly) {
    where.stock = { lt: LOW_STOCK_THRESHOLD };
  }

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: lowStockOnly ? { stock: "asc" } : { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        price: true,
        stock: true,
        category: { select: { name: true } },
      },
      take: 200,
    }),
    prisma.category.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const heading = lowStockOnly
    ? "Low stock"
    : showArchived
    ? "Archived products"
    : "Products";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{heading}</h1>
        <Link href="/admin/products/new" className="btn-primary">Add product</Link>
      </div>

      {/* Filter bar */}
      <form className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 grid gap-3 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name or slug…"
            className="w-full border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
          />
        </div>
        <select
          name="category"
          defaultValue={categoryFilter}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="lowStock" value="1" defaultChecked={lowStockOnly} className="rounded" />
            Low stock
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="archived" value="1" defaultChecked={showArchived} className="rounded" />
            Archived
          </label>
        </div>
        <div className="md:col-span-4 flex gap-2">
          <button type="submit" className="btn-primary text-sm">Apply</button>
          <Link href="/admin/products" className="btn-outline text-sm">Reset</Link>
        </div>
      </form>

      {/* List */}
      {products.length === 0 ? (
        <EmptyProducts />
      ) : (
        <div className="space-y-3">
          {products.map((p) => {
            const isLow = p.stock < LOW_STOCK_THRESHOLD;
            return (
              <div
                key={p.id}
                className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <div className="p-4 flex flex-wrap items-center gap-4">
                  <Image
                    src={ensureValidImageUrl(p.imageUrl)}
                    className="w-14 h-14 object-cover rounded-lg shrink-0"
                    alt={p.name}
                    width={56}
                    height={56}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">{p.name}</div>
                    <div className="text-sm text-gray-500 truncate">
                      {p.category?.name} · ${(p.price / 100).toFixed(2)}
                    </div>
                  </div>

                  {/* Inline stock editor */}
                  <form
                    action="/api/admin/products/stock"
                    method="post"
                    className={`flex items-center gap-2 shrink-0 ${isLow ? "text-red-700" : ""}`}
                  >
                    <input type="hidden" name="id" value={p.id} />
                    {isLow && <AlertTriangle className="w-4 h-4" />}
                    <label className="text-xs font-medium text-gray-500">Stock</label>
                    <input
                      type="number"
                      name="stock"
                      defaultValue={p.stock}
                      min={0}
                      className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm focus:border-sky-500 focus:ring-sky-500"
                    />
                    <button
                      type="submit"
                      className="text-xs px-2 py-1 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors"
                    >
                      Save
                    </button>
                  </form>

                  <div className="flex gap-2 shrink-0">
                    <Link href={`/admin/products/edit/${p.id}`} className="btn-outline">Edit</Link>
                    <DeleteProductButton id={p.id} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyProducts() {
  return (
    <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
      <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
      <h3 className="text-lg font-medium text-gray-900">No products found</h3>
      <p className="text-gray-500 mb-4">Try adjusting your filters, or add a new product.</p>
      <Link href="/admin/products/new" className="btn-primary">Add product</Link>
    </div>
  );
}
