"use client";

import Link from "next/link";
import Image from "next/image";
import { Instagram, Facebook, MessageCircle, ArrowUp } from "lucide-react";
import { openCookieSettings } from "@/components/cookies/ConsentProvider";

interface SiteFooterProps {
  whatsappNumber: string;
}

const INSTAGRAM_URL = "https://instagram.com/aquagear4";
const TIKTOK_URL = "https://www.tiktok.com/@aqua.gear.lb";
const FACEBOOK_URL = "https://www.facebook.com/profile.php?id=61576671363398";

// Lucide has no TikTok brand glyph — small inline SVG.
function TikTokIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

export function SiteFooter({ whatsappNumber }: SiteFooterProps) {
  const wa = `https://wa.me/${whatsappNumber}`;

  const social = [
    { href: INSTAGRAM_URL, label: "Instagram", Icon: Instagram },
    { href: TIKTOK_URL, label: "TikTok", Icon: TikTokIcon },
    { href: FACEBOOK_URL, label: "Facebook", Icon: Facebook },
    { href: wa, label: "WhatsApp", Icon: MessageCircle },
  ].filter((s) => s.href);

  return (
    <footer className="mt-24 border-t border-gray-200">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo_trans.png" alt="AquaGear" width={32} height={32} className="h-8 w-8 object-contain" />
            <span className="font-bold text-gray-900">AquaGear</span>
          </Link>

          {/* Essential links */}
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-gray-600">
            <Link href="/" className="hover:text-sky-700 transition-colors">Home</Link>
            <Link href="/shop" className="hover:text-sky-700 transition-colors">Shop</Link>
            <Link href="/account" className="hover:text-sky-700 transition-colors">Account</Link>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="hover:text-sky-700 transition-colors">Contact</a>
            <Link href="/cookie-policy" className="hover:text-sky-700 transition-colors">Cookie Policy</Link>
            <button
              type="button"
              onClick={openCookieSettings}
              className="hover:text-sky-700 transition-colors"
            >
              Cookie Settings
            </button>
          </nav>

          {/* Social */}
          <div className="flex items-center gap-2">
            {social.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                title={label}
                className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-sky-50 hover:text-sky-700"
              >
                <Icon size={18} />
              </a>
            ))}
          </div>
        </div>

        {/* Bottom line */}
        <div className="mt-8 flex flex-col items-center gap-3 border-t border-gray-100 pt-6 text-xs text-gray-500 sm:flex-row sm:justify-between">
          <span>© {new Date().getFullYear()} AquaGear. All rights reserved.</span>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-sky-700"
          >
            Back to top <ArrowUp size={14} />
          </button>
        </div>
      </div>
    </footer>
  );
}
