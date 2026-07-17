"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Home, Store, LayoutGrid, MessageCircle, User, ShoppingCart } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

interface MobileMenuProps {
  isAuthed: boolean;
  isAdmin: boolean;
  cartCount?: number;
  whatsappNumber: string;
}

export function MobileMenu({ isAuthed, isAdmin, cartCount = 0, whatsappNumber }: MobileMenuProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const prefersReduced = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);

  // Portal target — the header has backdrop-blur, which would otherwise make
  // `fixed` children position relative to it instead of the viewport.
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  // Focus trap: move focus into the dialog on open, keep Tab cycling inside it.
  useEffect(() => {
    if (!isOpen) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusables = () =>
      panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])');
    focusables()[0]?.focus();

    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const els = focusables();
      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => document.removeEventListener("keydown", trap);
  }, [isOpen]);

  // Lock body scroll while the drawer is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const transition = prefersReduced ? { duration: 0 } : { type: "tween" as const, duration: 0.25, ease: "easeOut" as const };

  const items = [
    { href: "/", label: "Home", icon: Home, external: false },
    { href: "/shop", label: "Shop", icon: Store, external: false },
    { href: "/shop#categories", label: "Categories", icon: LayoutGrid, external: false },
    { href: `https://wa.me/${whatsappNumber}`, label: "Contact", icon: MessageCircle, external: true },
    { href: "/account", label: isAuthed ? "Account" : "Sign in", icon: User, external: false },
    { href: "/cart", label: "Cart", icon: ShoppingCart, external: false, badge: cartCount },
  ];

  const isActive = (href: string) => {
    const base = href.split("#")[0];
    return base === "/" ? pathname === "/" : pathname.startsWith(base);
  };

  return (
    <div className="md:hidden flex items-center gap-1">
      {/* Cart icon in the top row */}
      <Link href="/cart" aria-label="Cart" className="relative p-2 text-gray-700 rounded-md focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2">
        <ShoppingCart size={22} />
        {cartCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-700 px-1 text-[10px] font-semibold text-white">
            {cartCount > 99 ? "99+" : cartCount}
          </span>
        )}
      </Link>

      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-gray-700 rounded-md focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
        aria-label="Open menu"
        aria-expanded={isOpen}
      >
        <Menu size={24} />
      </button>

      {mounted && createPortal(
        <AnimatePresence>
          {isOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: prefersReduced ? 0 : 0.2 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            {/* Right slide-in panel, full height */}
            <motion.div
              key="panel"
              ref={panelRef}
              role="dialog"
              aria-modal="true"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={transition}
              className="fixed top-0 right-0 z-50 flex h-full w-[80%] max-w-xs flex-col bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b px-5 h-[72px]">
                <span className="font-bold tracking-wide text-sky-700">AquaGear</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-2 -mr-2 text-gray-700 rounded-md focus-visible:ring-2 focus-visible:ring-sky-500"
                  aria-label="Close menu"
                >
                  <X size={24} />
                </button>
              </div>

              <nav className="flex flex-col gap-1 p-4">
                {items.map(({ href, label, icon: Icon, external, badge }) => {
                  const active = !external && isActive(href);
                  const cls = `flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium transition-colors ${
                    active ? "bg-sky-50 text-sky-700" : "text-gray-800 hover:bg-gray-50"
                  }`;
                  const inner = (
                    <>
                      <Icon size={20} className={active ? "text-sky-600" : "text-gray-400"} />
                      <span className="flex-1">{label}</span>
                      {typeof badge === "number" && badge > 0 && (
                        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-sky-700 px-1 text-xs font-semibold text-white">
                          {badge > 99 ? "99+" : badge}
                        </span>
                      )}
                    </>
                  );
                  return external ? (
                    <a key={label} href={href} target="_blank" rel="noopener noreferrer" className={cls} onClick={() => setIsOpen(false)}>
                      {inner}
                    </a>
                  ) : (
                    <Link key={label} href={href} className={cls} onClick={() => setIsOpen(false)}>
                      {inner}
                    </Link>
                  );
                })}

                {isAdmin && (
                  <Link
                    href="/admin"
                    className="mt-2 rounded-xl bg-sky-700 px-4 py-3 text-center font-medium text-white transition-colors hover:bg-sky-800"
                    onClick={() => setIsOpen(false)}
                  >
                    Dashboard
                  </Link>
                )}
              </nav>
            </motion.div>
          </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
