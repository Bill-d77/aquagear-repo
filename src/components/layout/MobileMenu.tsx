"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

export function MobileMenu({ isAuthed, isAdmin }: { isAuthed: boolean; isAdmin: boolean }) {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-gray-700">
                {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            {isOpen && (
                <div className="absolute top-16 left-0 right-0 bg-white border-b shadow-lg z-50 p-4 space-y-4 flex flex-col items-center">
                    <Link href="/shop" className="text-lg font-medium hover:text-sky-700" onClick={() => setIsOpen(false)}>Shop</Link>
                    <Link href="/cart" className="text-lg font-medium hover:text-sky-700" onClick={() => setIsOpen(false)}>Cart</Link>
                    <Link href="/account" className="text-lg font-medium hover:text-sky-700" onClick={() => setIsOpen(false)}>{isAuthed ? "Account" : "Sign in"}</Link>
                    {isAdmin && (
                        <Link href="/admin" className="text-white bg-sky-600 hover:bg-sky-700 px-4 py-2 rounded-lg w-full text-center" onClick={() => setIsOpen(false)}>Dashboard</Link>
                    )}
                </div>
            )}
        </div>
    );
}
