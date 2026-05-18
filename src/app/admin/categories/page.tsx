import { prisma } from "@/lib/prisma";
import { Tag, Plus } from "lucide-react";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Categories · AquaGear Admin",
};

export default async function AdminCategories() {
  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Categories</h1>
      </div>

      {/* Create */}
      <form
        action="/api/admin/categories/create"
        method="post"
        className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-2 items-end"
      >
        <div className="flex-1">
          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">New category</label>
          <input
            name="name"
            placeholder="e.g. Snorkels"
            required
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
          />
        </div>
        <button type="submit" className="btn-primary text-sm inline-flex items-center gap-1">
          <Plus className="w-4 h-4" /> Add
        </button>
      </form>

      {/* List */}
      {categories.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
          <Tag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No categories yet</h3>
          <p className="text-gray-500">Use the form above to add your first category.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap items-center gap-3">
              <Tag className="w-4 h-4 text-gray-400 shrink-0" />
              <form
                action="/api/admin/categories/update"
                method="post"
                className="flex items-center gap-2 flex-1 min-w-0"
              >
                <input type="hidden" name="id" value={c.id} />
                <input
                  name="name"
                  defaultValue={c.name}
                  className="flex-1 min-w-0 border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:border-sky-500 focus:ring-sky-500"
                />
                <button type="submit" className="text-xs px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors">
                  Rename
                </button>
              </form>
              <span className="text-xs text-gray-500 shrink-0">
                {c._count.products} product{c._count.products === 1 ? "" : "s"}
              </span>
              <form action="/api/admin/categories/delete" method="post" className="shrink-0">
                <input type="hidden" name="id" value={c.id} />
                <button
                  type="submit"
                  className="text-xs px-3 py-1.5 rounded-md border border-red-200 text-red-700 hover:bg-red-50 transition-colors"
                  disabled={c._count.products > 0}
                  title={c._count.products > 0 ? "Move products to another category before deleting" : "Delete"}
                >
                  Delete
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
