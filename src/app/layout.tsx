import "./globals.css";
import { ReactNode } from "react";
import { Providers } from "./providers";
import { auth } from "@/lib/auth";
import { Toaster } from "sonner";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { StorefrontShell } from "@/components/layout/StorefrontShell";
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

  const [session, settings, cartCount, categories] = await Promise.all([
    auth(),
    getStoreSettings(),
    cartId
      ? prisma.orderItem.count({ where: { orderId: cartId, order: { status: "PENDING" } } })
      : Promise.resolve(0),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
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

  const footer = <SiteFooter categories={categories} whatsappNumber={settings.whatsappNumber} />;

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
