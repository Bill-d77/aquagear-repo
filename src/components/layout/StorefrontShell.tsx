"use client";

/**
 * Renders the storefront header, main wrapper, and footer only on non-admin
 * routes. Admin pages have their own layout (AdminSidebar + full-page shell)
 * and must not inherit the storefront chrome.
 */
import { usePathname } from "next/navigation";
import { ReactNode } from "react";

interface StorefrontShellProps {
  header: ReactNode;
  footer: ReactNode;
  whatsapp: ReactNode;
  children: ReactNode;
}

export function StorefrontShell({
  header,
  footer,
  whatsapp,
  children,
}: StorefrontShellProps) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");

  if (isAdmin) {
    // Admin has its own full-page layout — render children only, no wrapper padding
    return <>{children}</>;
  }

  return (
    <>
      {header}
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        {children}
      </main>
      {footer}
      {/* Hide the floating WhatsApp button on checkout — it would overlap the sticky Place Order bar. */}
      {!pathname.startsWith("/checkout") && whatsapp}
    </>
  );
}
