import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export default async function AdminOrders() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") return <p>Access denied.</p>;

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: true } }, user: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Orders</h1>
      <div className="space-y-3">
        {orders.map((o: any) => (
          <div key={o.id} className="card">
            <div className="flex items-center justify-between">
              <div className="font-medium">Order #{o.id.slice(0,8)}</div>
              <div className="text-sm text-gray-600">{new Date(o.createdAt).toLocaleString()}</div>
            </div>
            <div className="text-sm text-gray-600">{o.user ? o.user.email : "Guest"}</div>
            <div className="mt-2 space-y-1">
              {o.items.map((it: any) => (
                <div key={it.id} className="text-sm">{it.quantity} x {it.product.name} — {(it.price/100).toFixed(2)} USD</div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <div className="font-semibold">Status: {o.status}</div>
              <form action="/api/admin/orders/status" method="post" className="flex items-center gap-2">
                <input type="hidden" name="id" value={o.id} />
                <select name="status" className="border rounded px-2 py-1">
                  <option value="PENDING">PENDING</option>
                  <option value="PAID">PAID</option>
                  <option value="SHIPPED">SHIPPED</option>
                  <option value="CANCELED">CANCELED</option>
                </select>
                <button className="btn-outline">Update</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 