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
            {/* pt-14 on mobile offsets the fixed top bar; removed on md+ where sidebar is inline */}
            <main className="flex-1 p-4 sm:p-8 pt-[4.5rem] md:pt-8 overflow-y-auto">
                <div className="max-w-7xl mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
}
