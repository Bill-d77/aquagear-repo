"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

interface MobileMenuProps {
  isAuthed: boolean;
  isAdmin: boolean;
  cartCount?: number;
}

export function MobileMenu({ isAuthed, isAdmin, cartCount = 0 }: MobileMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const prefersReduced = useReducedMotion();

  // Close on route change / escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  const transition = prefersReduced ? { duration: 0 } : { duration: 0.15 };

  return (
    <div className="md:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-700 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 rounded-md"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={transition}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              onClick={() => setIsOpen(false)}
              aria-hidden="true"
            />
            {/* Menu panel */}
            <motion.div
              key="menu"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={transition}
              className="absolute top-16 left-0 right-0 bg-white border-b shadow-lg z-50 p-4 flex flex-col gap-1"
            >
              <Link
                href="/shop"
                className="py-3 px-4 text-base font-medium hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors"
                onClick={() => setIsOpen(false)}
              >
                Shop
              </Link>
              <Link
                href="/cart"
                className="py-3 px-4 text-base font-medium hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors flex items-center justify-between"
                onClick={() => setIsOpen(false)}
              >
                Cart
                {cartCount > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-5 px-1 rounded-full bg-sky-600 text-white text-xs font-semibold">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </Link>
              <Link
                href="/account"
                className="py-3 px-4 text-base font-medium hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {isAuthed ? "Account" : "Sign in"}
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="mt-2 text-white bg-sky-600 hover:bg-sky-700 px-4 py-3 rounded-lg text-center font-medium transition-colors"
                  onClick={() => setIsOpen(false)}
                >
                  Dashboard
                </Link>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
