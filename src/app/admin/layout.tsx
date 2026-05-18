import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { requireAdmin } from "@/lib/admin";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Single gate — children render only for admins. Children must NOT
    // duplicate this check; layouts apply before pages.
    await requireAdmin();

    return (
        <div className="flex min-h-screen bg-gray-50">
            <AdminSidebar />
            <main className="flex-1 p-8 overflow-y-auto">
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
