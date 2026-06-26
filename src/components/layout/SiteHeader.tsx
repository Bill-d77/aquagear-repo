"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Outfit } from "next/font/google";
import { MobileMenu } from "./MobileMenu";

// Premium brand wordmark font (self-hosted by next/font, no runtime cost).
const brand = Outfit({ subsets: ["latin"], weight: ["600", "700"] });

interface SiteHeaderProps {
  isAuthed: boolean;
  isAdmin: boolean;
  cartCount: number;
  whatsappNumber: string;
}

// Categories → the shop's category section; Contact → WhatsApp (no /about or /contact pages exist).
const NAV = [
  { href: "/", label: "Home" },
  { href: "/shop", label: "Shop" },
  { href: "/shop#categories", label: "Categories" },
];

export function SiteHeader({ isAuthed, isAdmin, cartCount: initialCartCount, whatsappNumber }: SiteHeaderProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [cartCount, setCartCount] = useState(initialCartCount);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const delta = (e as CustomEvent<{ delta: number }>).detail?.delta ?? 1;
      setCartCount((c) => c + delta);
    };
    window.addEventListener("cart:updated", handler);
    return () => window.removeEventListener("cart:updated", handler);
  }, []);

  const isActive = (href: string) => {
    const base = href.split("#")[0];
    return base === "/" ? pathname === "/" : pathname.startsWith(base);
  };

  // Animated underline that grows from the left; filled when active.
  const navLink = (active: boolean) =>
    `relative py-1 text-sm font-medium transition-colors hover:text-sky-700 ${active ? "text-sky-700" : "text-gray-700"} ` +
    `after:absolute after:left-0 after:-bottom-0.5 after:h-0.5 after:w-full after:origin-left after:bg-sky-600 after:transition-transform after:duration-200 ` +
    `${active ? "after:scale-x-100" : "after:scale-x-0 hover:after:scale-x-100"}`;

  return (
    <header
      className={`sticky top-0 z-40 border-b bg-white/80 backdrop-blur transition-shadow duration-300 ${scrolled ? "shadow-md" : "shadow-none"}`}
    >
      <div className="mx-auto grid h-[72px] max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-6 lg:px-8">
        {/* Left — logo */}
        <div className="flex justify-start">
          <Link href="/" aria-label="AquaGear home" className="inline-flex items-center transition-transform duration-200 hover:scale-[1.03]">
            <Image src="/logo.png" alt="AquaGear" width={48} height={48} priority className="h-11 w-11 rounded-xl object-contain" />
          </Link>
        </div>

        {/* Center — brand wordmark (truly centered via the symmetric 1fr columns) */}
        <Link
          href="/"
          className={`${brand.className} justify-self-center bg-gradient-to-r from-sky-600 to-cyan-500 bg-clip-text text-transparent font-bold tracking-wide text-xl sm:text-2xl lg:text-3xl transition-opacity hover:opacity-80`}
        >
          AquaGear
        </Link>

        {/* Right — desktop nav + mobile controls */}
        <div className="flex items-center justify-end gap-5 lg:gap-6">
          <nav className="hidden md:flex items-center gap-5 lg:gap-6">
            {NAV.map((item) => (
              <Link key={item.label} href={item.href} className={navLink(isActive(item.href))}>
                {item.label}
              </Link>
            ))}
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              className={navLink(false)}
            >
              Contact
            </a>
            <Link href="/cart" className={`${navLink(isActive("/cart"))} flex items-center gap-1.5`}>
              Cart
              {cartCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-600 px-1 text-xs font-semibold text-white">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>
            <Link href="/account" className={navLink(isActive("/account"))}>
              {isAuthed ? "Account" : "Sign in"}
            </Link>
            {isAdmin && (
              <Link href="/admin" className="rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-sky-700">
                Dashboard
              </Link>
            )}
          </nav>

          {/* Mobile — cart icon + hamburger */}
          <MobileMenu isAuthed={isAuthed} isAdmin={isAdmin} cartCount={cartCount} whatsappNumber={whatsappNumber} />
        </div>
      </div>
    </header>
  );
}
