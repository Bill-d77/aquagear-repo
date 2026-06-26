"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";
import {
  Instagram,
  Facebook,
  MessageCircle,
  MapPin,
  Phone,
  Clock,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  BadgeCheck,
  ShieldCheck,
  Truck,
  LifeBuoy,
  Headphones,
  CheckCircle2,
} from "lucide-react";

interface Category {
  id: string;
  name: string;
}

interface SiteFooterProps {
  categories: Category[];
  whatsappNumber: string;
}

const INSTAGRAM_URL = "https://instagram.com/aquagear4";
const TIKTOK_URL = "https://www.tiktok.com/@aqua.gear.lb";
const FACEBOOK_URL = "https://www.facebook.com/profile.php?id=61576671363398";

// Lucide has no TikTok brand glyph — small inline SVG.
function TikTokIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

const TRUST = [
  { icon: Truck, label: "Fast Delivery Across Lebanon" },
  { icon: ShieldCheck, label: "Secure Checkout" },
  { icon: BadgeCheck, label: "Premium Quality Products" },
  { icon: LifeBuoy, label: "Safety-Tested Equipment" },
  { icon: Headphones, label: "Fast Customer Support" },
];

/** Collapsible on mobile (native <details>), always-open on desktop. Zero JS. */
function FooterCol({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details
      open
      className="group border-b border-white/10 py-3 md:border-0 md:py-0 [&_summary::-webkit-details-marker]:hidden"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between font-semibold text-white md:cursor-default md:pointer-events-none">
        {title}
        <ChevronDown size={18} className="text-white/60 transition-transform group-open:rotate-180 md:hidden" />
      </summary>
      <div className="mt-3 space-y-2 text-sm text-slate-300">{children}</div>
    </details>
  );
}

const linkCls =
  "relative inline-block w-fit text-slate-300 transition-colors hover:text-white after:absolute after:left-0 after:-bottom-0.5 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-cyan-400 after:transition-transform hover:after:scale-x-100";

export function SiteFooter({ categories, whatsappNumber }: SiteFooterProps) {
  const [email, setEmail] = useState("");
  const wa = `https://wa.me/${whatsappNumber}`;

  function subscribe(e: React.FormEvent) {
    e.preventDefault();
    // ponytail: no newsletter backend — give the user feedback and clear.
    // Wire to your email provider (or a /api/subscribe route) when one exists.
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      toast.error("Please enter a valid email address");
      return;
    }
    toast.success("Thanks! We'll keep you posted on new arrivals.");
    setEmail("");
  }

  return (
    <footer className="relative mt-24 text-slate-300">
      {/* Animated wave divider */}
      <div className="pointer-events-none absolute inset-x-0 -top-px overflow-hidden leading-[0]" aria-hidden="true">
        <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="h-12 w-full">
          <path
            d="M0,40 C300,120 900,-40 1200,40 L1200,120 L0,120 Z"
            className="fill-[#041C32]"
          />
        </svg>
      </div>

      <div className="bg-gradient-to-b from-[#041C32] to-[#020f1d]">
        {/* Soft glow accent */}
        <div className="pointer-events-none absolute left-1/2 top-24 h-64 w-[36rem] max-w-full -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" aria-hidden="true" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Newsletter */}
          <div className="rounded-3xl bg-gradient-to-r from-sky-600 to-cyan-500 p-6 sm:p-10 -translate-y-10 shadow-xl">
            <div className="grid items-center gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-2xl font-bold text-white">Stay Ready for Summer</h3>
                <p className="mt-2 text-white/85">
                  Get notified about new arrivals, exclusive discounts, and the latest AquaGear
                  products before everyone else.
                </p>
              </div>
              <form onSubmit={subscribe} className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  aria-label="Email address"
                  className="w-full rounded-xl border border-white/30 bg-white/95 px-4 py-3 text-slate-900 placeholder:text-slate-400 transition focus:outline-none focus:ring-2 focus:ring-white"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#041C32] px-6 py-3 font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95"
                >
                  Subscribe <ArrowRight size={18} />
                </button>
              </form>
            </div>
          </div>

          {/* Columns */}
          <div className="grid gap-x-8 gap-y-2 pb-10 md:grid-cols-4 md:gap-y-10">
            {/* Brand */}
            <div className="md:pr-4">
              <Link href="/" className="flex items-center gap-2">
                <Image src="/logo_trans.png" alt="AquaGear" width={40} height={40} className="h-10 w-10 object-contain" />
                <span className="text-lg font-bold text-white">AquaGear</span>
              </Link>
              <p className="mt-4 text-sm text-slate-300">
                Lebanon&apos;s destination for premium sea gear, beach essentials, inflatable water
                toys, and water sports equipment. Everything you need for unforgettable summer
                adventures.
              </p>
              <ul className="mt-4 space-y-2 text-sm">
                {["Premium Quality", "Secure Shopping", "Delivery Across Lebanon"].map((t) => (
                  <li key={t} className="flex items-center gap-2 text-slate-300">
                    <CheckCircle2 size={16} className="text-cyan-400" /> {t}
                  </li>
                ))}
              </ul>
            </div>

            {/* Shop by Category — real collections */}
            <FooterCol title="Shop by Category">
              {categories.length === 0 && <span className="text-slate-400">Coming soon</span>}
              {categories.map((c) => (
                <Link key={c.id} href={`/shop?category=${c.id}`} className={`block ${linkCls}`}>
                  {c.name}
                </Link>
              ))}
              <Link href="/shop" className="mt-3 inline-flex items-center gap-1.5 font-medium text-cyan-400 hover:text-cyan-300">
                View All Products <ArrowRight size={15} />
              </Link>
            </FooterCol>

            {/* Quick links — only routes that exist */}
            <FooterCol title="Quick Links">
              <Link href="/" className={`block ${linkCls}`}>Home</Link>
              <Link href="/shop" className={`block ${linkCls}`}>Shop</Link>
              <Link href="/account" className={`block ${linkCls}`}>My Account</Link>
              <Link href="/account" className={`block ${linkCls}`}>Order Tracking</Link>
              <Link href="/cart" className={`block ${linkCls}`}>Cart</Link>
              <a href={wa} target="_blank" rel="noopener noreferrer" className={`block ${linkCls}`}>Contact Us</a>
            </FooterCol>

            {/* Contact */}
            <FooterCol title="Contact Us">
              <p className="flex items-center gap-2"><MapPin size={16} className="text-cyan-400" /> Lebanon</p>
              <a href={`tel:+${whatsappNumber}`} className="flex items-center gap-2 hover:text-white">
                <Phone size={16} className="text-cyan-400" /> +{whatsappNumber}
              </a>
              <p className="flex items-center gap-2"><Clock size={16} className="text-cyan-400" /> Mon–Sat, 9:00 AM – 6:00 PM</p>
              <a
                href={wa}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 font-semibold text-white transition-transform hover:scale-[1.03] active:scale-95"
              >
                <MessageCircle size={18} /> Contact us on WhatsApp
              </a>
            </FooterCol>
          </div>

          {/* Social */}
          <div className="flex flex-col items-center gap-4 border-t border-white/10 py-8">
            <span className="text-sm font-semibold text-white">Follow AquaGear</span>
            <div className="flex flex-wrap justify-center gap-3">
              {[
                { href: INSTAGRAM_URL, label: "Instagram", Icon: Instagram, hover: "hover:bg-pink-600" },
                { href: TIKTOK_URL, label: "TikTok", Icon: TikTokIcon, hover: "hover:bg-black" },
                { href: FACEBOOK_URL, label: "Facebook", Icon: Facebook, hover: "hover:bg-blue-600" },
                { href: wa, label: "WhatsApp", Icon: MessageCircle, hover: "hover:bg-emerald-500" },
              ]
                // Hide any platform without a configured URL.
                .filter((s) => s.href)
                .map(({ href, label, Icon, hover }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className={`group/social relative flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white transition-all hover:scale-110 hover:shadow-[0_0_16px_rgba(56,189,248,0.6)] ${hover}`}
                  >
                    <Icon size={20} />
                    {/* Tooltip */}
                    <span className="pointer-events-none absolute -top-9 whitespace-nowrap rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-900 opacity-0 shadow transition-opacity group-hover/social:opacity-100">
                      {label}
                    </span>
                  </a>
                ))}
            </div>
          </div>

          {/* Trust badges */}
          <div className="grid grid-cols-2 gap-4 border-t border-white/10 py-8 text-center sm:grid-cols-3 lg:grid-cols-5">
            {TRUST.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2">
                <Icon size={22} className="text-cyan-400" />
                <span className="text-xs text-slate-300">{label}</span>
              </div>
            ))}
          </div>

          {/* Payments — store is COD-only */}
          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 py-6 text-sm text-slate-300">
            <span className="text-slate-400">We accept:</span>
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 font-medium text-white">
              <Truck size={15} className="text-cyan-400" /> Cash on Delivery
            </span>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 bg-[#020f1d]">
          <div className="mx-auto flex max-w-7xl flex-col items-center gap-3 px-4 py-5 text-xs text-slate-400 sm:flex-row sm:justify-between">
            <span>© {new Date().getFullYear()} AquaGear. All Rights Reserved.</span>
            <span>Made for Summer Adventures in Lebanon 🌊</span>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            >
              Back to Top <ArrowUp size={14} />
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
