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
import { JsonLd } from "@/components/JsonLd";
import { organizationSchema, websiteSchema } from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AquaGear — Premium Marine & Water Sports Gear in Lebanon",
    template: "%s · AquaGear",
  },
  description:
    "Shop premium life jackets, diving gear, floats, waterproof bags, and marine safety equipment. Fast delivery across Lebanon.",
  applicationName: "AquaGear",
  icons: {
    icon: "/logo_trans.png",
    shortcut: "/logo_trans.png",
    apple: "/logo_trans.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    type: "website",
    siteName: "AquaGear",
    title: "AquaGear — Premium Marine & Water Sports Gear in Lebanon",
    description:
      "Life jackets, diving gear, floats, waterproof bags, and marine safety equipment. Fast delivery across Lebanon.",
    url: SITE_URL,
    images: [{ url: "/hero_section1.png", width: 1200, height: 630, alt: "AquaGear marine equipment" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AquaGear — Premium Marine & Water Sports Gear in Lebanon",
    description: "Life jackets, diving gear, floats, and marine safety equipment. Fast delivery across Lebanon.",
    images: ["/hero_section1.png"],
  },
};

export const viewport = {
  themeColor: "#0284c7",
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
        <JsonLd data={[organizationSchema(settings.storeName), websiteSchema(settings.storeName)]} />
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
