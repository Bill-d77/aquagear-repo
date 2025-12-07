import Link from "next/link";
import {
    LayoutDashboard,
    Package,
    ShoppingCart,
    Users,
    Settings,
    LogOut
} from "lucide-react";

const navItems = [
    { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/products", label: "Products", icon: Package },
    { href: "/admin/orders", label: "Orders", icon: ShoppingCart },
    { href: "/admin/users", label: "Customers", icon: Users },
    { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminSidebar() {
    return (
        <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-white min-h-screen">
            <div className="p-6 border-b border-slate-800">
                <h1 className="text-xl font-bold tracking-wider">AQUAGEAR</h1>
                <p className="text-xs text-slate-400 mt-1">Admin Console</p>
            </div>

            <nav className="flex-1 p-4 space-y-2">
                {navItems.map((item) => (
                    <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                    >
                        <item.icon className="w-5 h-5" />
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-800">
                <form action="/api/auth/signout" method="POST">
                    <button className="flex items-center gap-3 px-4 py-3 w-full rounded-lg text-red-400 hover:bg-slate-800 transition-colors">
                        <LogOut className="w-5 h-5" />
                        <span>Sign Out</span>
                    </button>
                </form>
            </div>
        </aside>
    );
}
