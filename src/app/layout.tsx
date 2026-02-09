import "./globals.css";
import Link from "next/link";
import { ReactNode } from "react";
import { Providers } from "./providers";
import { auth } from "@/lib/auth";
import { Toaster } from "sonner";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { MobileMenu } from "@/components/layout/MobileMenu";
import Image from "next/image";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AquaGear4",
  description: "Sea gear, floats, and safety for Lebanon",
  icons: {
    icon: "/logo.png",
    shortcut: "/logo.png",
    apple: "/logo.png",
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  const isAuthed = !!session?.user;
  const isAdmin = role === "ADMIN";

  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-sky-50 to-white text-gray-900">
        <Providers>
          <header className="sticky top-0 z-40 backdrop-blur bg-white/70 border-b">
            <nav className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2 font-extrabold tracking-tight text-xl">
                <Image src="/logo.png" alt="AquaGear4 Logo" width={40} height={40} className="w-10 h-10 object-contain" />
                <span>AquaGear4</span>
              </Link>
              <div className="hidden md:flex items-center gap-6 text-sm font-medium">
                <Link href="/shop" className="hover:text-sky-700">Shop</Link>
                <Link href="/cart" className="hover:text-sky-700">Cart</Link>
                <Link href="/account" className="hover:text-sky-700">{isAuthed ? "Account" : "Sign in"}</Link>
                {isAdmin && (
                  <Link href="/admin" className="text-white bg-sky-600 hover:bg-sky-700 px-3 py-1.5 rounded-lg">Dashboard</Link>
                )}
              </div>
              <MobileMenu isAuthed={isAuthed} isAdmin={isAdmin} />
            </nav>
          </header>
          <main className="mx-auto max-w-7xl px-6 py-10">{children}</main>
          <footer className="border-t mt-24">
            <div className="mx-auto max-w-7xl px-6 py-10 grid md:grid-cols-3 gap-6 text-sm text-gray-600">
              <div>
                <div className="flex items-center gap-2 font-semibold text-gray-900 mb-2">
                  <Image src="/logo.png" alt="AquaGear4 Logo" width={32} height={32} className="w-8 h-8 object-contain" />
                  <span>AquaGear4</span>
                </div>
                <p>Quality sea gear, floats, and safety equipment.</p>
              </div>
              <div>
                <div className="font-semibold text-gray-900">Links</div>
                <div className="mt-2 space-y-1">
                  <Link href="/shop" className="block hover:text-sky-700">Shop</Link>
                  <Link href="/account" className="block hover:text-sky-700">Account</Link>
                </div>
              </div>
              <div>
                <div className="font-semibold text-gray-900">Contact</div>
                <p className="mt-2">WhatsApp available for quick support.</p>
                <div className="mt-2 space-y-1">
                  <a href="https://instagram.com/aquagear4" target="_blank" rel="noopener noreferrer" className="hover:text-sky-700">Instagram @aquagear4</a>
                  <a href="https://www.facebook.com/share/1EBsXWNqQz/" target="_blank" rel="noopener noreferrer" className="hover:text-sky-700">Facebook page</a>
                </div>
              </div>
            </div>
            <div className="mx-auto max-w-7xl px-6 pb-8 text-xs text-gray-500">© {new Date().getFullYear()} AquaGear4</div>
          </footer>
          <Toaster position="bottom-right" richColors />
          <WhatsAppButton />
        </Providers>
      </body>
    </html>
  );
}
