import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { MapPin, Phone, User, CreditCard, Package } from "lucide-react";

export default async function AdminOrders() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") return <p>Access denied.</p>;

  const orders = await prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: { include: { product: true } }, user: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">Orders</h1>
      <div className="grid gap-6">
        {orders.map((o) => (
          <div key={o.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header */}
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-lg">Order #{o.id.slice(0, 8).toUpperCase()}</div>
                <div className="text-sm text-gray-500">{new Date(o.createdAt).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${o.status === 'PAID' ? 'bg-green-100 text-green-700' :
                    o.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                      o.status === 'SHIPPED' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                  }`}>
                  {o.status}
                </span>
                <form action="/api/admin/orders/status" method="post" className="flex items-center gap-2">
                  <input type="hidden" name="id" value={o.id} />
                  <select name="status" defaultValue={o.status} className="text-sm border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500">
                    <option value="PENDING">PENDING</option>
                    <option value="PAID">PAID</option>
                    <option value="SHIPPED">SHIPPED</option>
                    <option value="CANCELED">CANCELED</option>
                  </select>
                  <button className="text-sm bg-white border border-gray-300 hover:bg-gray-50 px-3 py-1.5 rounded-md font-medium transition-colors">
                    Update
                  </button>
                </form>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 grid md:grid-cols-2 gap-8">
              {/* Customer Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <User className="w-4 h-4" /> Customer Details
                </h3>
                <div className="bg-gray-50 rounded-lg p-4 space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <User className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div>
                      <span className="block font-medium text-gray-900">{o.name || "Guest"}</span>
                      <span className="text-gray-500">{o.user?.email || "No email provided"}</span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="text-gray-700">{o.phoneNumber || "No phone number"}</span>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <div className="text-gray-700">
                      <div>{o.location || "No location"}</div>
                      {o.apartment && <div className="text-gray-500">{o.apartment}</div>}
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CreditCard className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span className="text-gray-700">Payment: <span className="font-medium">{o.paymentMode}</span></span>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <Package className="w-4 h-4" /> Order Items
                </h3>
                <div className="border rounded-lg divide-y">
                  {o.items.map((item) => (
                    <div key={item.id} className="p-3 flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-xs font-bold text-gray-500">
                          {item.quantity}x
                        </div>
                        <span className="font-medium text-gray-900">{item.product.name}</span>
                      </div>
                      <div className="text-gray-600">
                        ${(item.price / 100).toFixed(2)}
                      </div>
                    </div>
                  ))}
                  <div className="p-3 bg-gray-50 flex justify-between font-bold text-gray-900">
                    <span>Total</span>
                    <span>${(o.items.reduce((acc: number, item: any) => acc + item.price * item.quantity, 0) / 100).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
        {orders.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
            <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No orders yet</h3>
            <p className="text-gray-500">When you receive orders, they will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}