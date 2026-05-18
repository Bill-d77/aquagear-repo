"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface NavLinksProps {
  isAuthed: boolean;
  isAdmin: boolean;
  initialCartCount: number;
}

export function NavLinks({ isAuthed, isAdmin, initialCartCount }: NavLinksProps) {
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(initialCartCount);

  useEffect(() => {
    const handler = (e: Event) => {
      const delta = (e as CustomEvent<{ delta: number }>).detail?.delta ?? 1;
      setCartCount((c) => c + delta);
    };
    window.addEventListener("cart:updated", handler);
    return () => window.removeEventListener("cart:updated", handler);
  }, []);

  const linkClass = (href: string) =>
    `hover:text-sky-700 transition-colors ${
      pathname === href || (href !== "/" && pathname.startsWith(href))
        ? "text-sky-700 font-semibold"
        : ""
    }`;

  return (
    <div className="hidden md:flex items-center gap-6 text-sm font-medium">
      <Link href="/shop" className={linkClass("/shop")}>Shop</Link>
      <Link href="/cart" className={`${linkClass("/cart")} flex items-center gap-1.5`}>
        Cart
        {cartCount > 0 && (
          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-sky-600 text-white text-xs font-semibold">
            {cartCount > 99 ? "99+" : cartCount}
          </span>
        )}
      </Link>
      <Link href="/account" className={linkClass("/account")}>
        {isAuthed ? "Account" : "Sign in"}
      </Link>
      {isAdmin && (
        <Link href="/admin" className="text-white bg-sky-600 hover:bg-sky-700 px-3 py-1.5 rounded-lg transition-colors">
          Dashboard
        </Link>
      )}
    </div>
  );
}
