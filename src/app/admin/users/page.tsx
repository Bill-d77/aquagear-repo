import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export default async function AdminUsers() {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (role !== "ADMIN") return <p>Access denied.</p>;

  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <div className="space-y-3">
        {users.map((u: any) => (
          <div key={u.id} className="card flex items-center justify-between">
            <div>
              <div className="font-medium">{u.name} <span className="text-gray-500">({u.email})</span></div>
              <div className="text-sm text-gray-600">Role: {u.role}</div>
            </div>
            <form action="/api/admin/users/role" method="post" className="flex items-center gap-2">
              <input type="hidden" name="id" value={u.id} />
              <select name="role" className="border rounded px-2 py-1">
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
              <button className="btn-outline">Update</button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
} 