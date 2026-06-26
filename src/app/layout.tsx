import "./globals.css";
import Link from "next/link";
import { ReactNode } from "react";
import { Providers } from "./providers";
import { auth } from "@/lib/auth";
import { Toaster } from "sonner";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { StorefrontShell } from "@/components/layout/StorefrontShell";
import Image from "next/image";
import { Metadata } from "next";
import { getStoreSettings } from "@/lib/settings";
import { cookies } from "next/headers";
import { CART_COOKIE_NAME } from "@/lib/cart";
import { prisma } from "@/lib/prisma";

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
  const cookieStore = await cookies();
  const cartId = cookieStore.get(CART_COOKIE_NAME)?.value;

  const [session, settings, cartCount] = await Promise.all([
    auth(),
    getStoreSettings(),
    cartId
      ? prisma.orderItem.count({ where: { orderId: cartId, order: { status: "PENDING" } } })
      : Promise.resolve(0),
  ]);

  const isAuthed = !!session?.user;
  const isAdmin = session?.user?.role === "ADMIN";

  const header = (
    <SiteHeader
      isAuthed={isAuthed}
      isAdmin={isAdmin}
      cartCount={cartCount}
      whatsappNumber={settings.whatsappNumber}
    />
  );

  const footer = (
    <footer className="border-t mt-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10 grid md:grid-cols-3 gap-6 text-sm text-gray-600">
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-8 text-xs text-gray-500">© {new Date().getFullYear()} AquaGear4</div>
    </footer>
  );

  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-b from-sky-50 to-white text-gray-900">
        <Providers>
          <StorefrontShell
            header={header}
            footer={footer}
            whatsapp={<WhatsAppButton number={settings.whatsappNumber} />}
          >
            {children}
          </StorefrontShell>
          <Toaster position="bottom-right" richColors />
        </Providers>
      </body>
    </html>
  );
}
