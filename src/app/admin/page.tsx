import { auth } from "@/lib/auth";
import Link from "next/link";

export default async function AdminHome() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") {
    return <p>Access denied.</p>;
  }
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Link className="card hover:shadow transition" href="/admin/products">
          <div className="font-semibold">Manage products</div>
          <div className="text-sm text-gray-600 mt-1">Create, edit, and delete products</div>
        </Link>
        <Link className="card hover:shadow transition" href="/admin/orders">
          <div className="font-semibold">Orders</div>
          <div className="text-sm text-gray-600 mt-1">View and update order status</div>
        </Link>
        <Link className="card hover:shadow transition" href="/admin/users">
          <div className="font-semibold">Users</div>
          <div className="text-sm text-gray-600 mt-1">View users and manage roles</div>
        </Link>
      </div>
    </div>
  );
}
