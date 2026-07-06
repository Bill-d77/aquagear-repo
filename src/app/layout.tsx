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
import { SITE_URL } from "@/lib/site";
import { getStoreSettings } from "@/lib/settings";
import { cookies } from "next/headers";
import { CART_COOKIE_NAME } from "@/lib/cart";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "AquaGear4",
  description: "Sea gear, floats, and safety for Lebanon",
  icons: {
    icon: "/logo_trans.png",
    shortcut: "/logo_trans.png",
    apple: "/logo_trans.png",
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

  const footer = <SiteFooter whatsappNumber={settings.whatsappNumber} />;

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
