"use client";

interface RoleFormProps {
  userId: string;
  currentRole: string;
}

/** Role selector that asks for confirmation before granting ADMIN. */
export function RoleForm({ userId, currentRole }: RoleFormProps) {
  return (
    <form
      action="/api/admin/users/role"
      method="post"
      className="flex items-center gap-2 shrink-0"
      onSubmit={(e) => {
        const select = e.currentTarget.elements.namedItem("role") as HTMLSelectElement | null;
        if (
          select?.value === "ADMIN" &&
          currentRole !== "ADMIN" &&
          !window.confirm("Grant ADMIN access to this user? They will have full control of the store.")
        ) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={userId} />
      <select name="role" defaultValue={currentRole} className="text-sm border border-gray-300 rounded-md px-2 py-1">
        <option value="USER">USER</option>
        <option value="ADMIN">ADMIN</option>
      </select>
      <button type="submit" className="text-xs px-3 py-1.5 rounded-md border border-gray-300 hover:bg-gray-50 transition-colors">
        Update
      </button>
    </form>
  );
}
