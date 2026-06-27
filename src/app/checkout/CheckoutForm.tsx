"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  ShieldCheck,
  User,
  Phone,
  MapPin,
  Map,
  Building2,
  Truck,
  Banknote,
  Lock,
  Loader2,
  type LucideIcon,
} from "lucide-react";
import { DELIVERY_FEE, FREE_DELIVERY_THRESHOLD } from "@/lib/cart";
import { submitOrder } from "./actions";

interface LineItem {
  id: string;
  name: string;
  imageUrl: string;
  quantity: number;
  price: number;
}

interface CheckoutFormProps {
  items: LineItem[];
  subtotal: number;
  deliveryFee: number;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const initialState = { message: "", errors: {} as Record<string, string[] | undefined> };

function Field({
  id,
  label,
  icon: Icon,
  type = "text",
  required,
  error,
  ...rest
}: {
  id: string;
  label: string;
  icon: LucideIcon;
  type?: string;
  required?: boolean;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[15px] font-medium text-slate-700">
        {label} {!required && <span className="text-slate-400">(optional)</span>}
      </label>
      <div className="relative">
        <Icon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          id={id}
          name={id}
          type={type}
          required={required}
          className={`h-14 w-full rounded-xl border bg-white pl-11 pr-3 text-base shadow-sm transition focus:outline-none focus:ring-4 ${
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-100"
              : "border-slate-200 focus:border-sky-500 focus:ring-sky-100"
          }`}
          {...rest}
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function PlaceOrderButton({ total }: { total: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex h-14 flex-1 items-center justify-center gap-2 rounded-[18px] bg-gradient-to-r from-sky-600 to-sky-500 text-base font-semibold text-white shadow-lg transition-transform active:scale-[0.98] disabled:opacity-70"
    >
      {pending ? (
        <Loader2 size={20} className="animate-spin" />
      ) : (
        <>
          <Lock size={18} /> Place Order · {money(total)}
        </>
      )}
    </button>
  );
}

export function CheckoutForm({ items, subtotal, deliveryFee }: CheckoutFormProps) {
  const [state, formAction] = useActionState(submitOrder, initialState);
  const errors = state?.errors ?? {};
  const total = subtotal + deliveryFee;

  return (
    <form action={formAction} className="fade-up mx-auto max-w-md space-y-5 pb-28">
      {/* Header */}
      <div className="relative flex items-center justify-center pt-2">
        <Link href="/cart" aria-label="Back to cart" className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100">
          <ArrowLeft size={20} />
        </Link>
        <div className="text-center">
          <div className="mb-1 flex justify-center text-sky-600"><ShieldCheck size={22} /></div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Checkout</h1>
          <p className="text-sm text-slate-500">Complete your order in less than a minute.</p>
        </div>
      </div>

      {state?.message && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.message}
        </div>
      )}

      {/* Delivery Information */}
      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <MapPin size={18} className="text-sky-600" /> Delivery Information
        </h2>
        <div className="space-y-4">
          <Field id="name" label="Full Name" icon={User} required placeholder="Jane Diver" error={errors.name?.[0]} autoComplete="name" />
          <Field id="phoneNumber" label="Phone Number" icon={Phone} type="tel" required placeholder="+961 71 234 567" error={errors.phoneNumber?.[0]} autoComplete="tel" />
          <Field id="city" label="City" icon={MapPin} required placeholder="Beirut" error={errors.city?.[0]} />
          <Field id="area" label="Area" icon={Map} required placeholder="Hamra" error={errors.area?.[0]} />
          <Field id="apartment" label="Apartment / Building" icon={Building2} placeholder="Bldg 4, 2nd floor" error={errors.apartment?.[0]} />
        </div>
      </section>

      {/* Order Summary */}
      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
          🛍 Order Summary
        </h2>
        <ul className="space-y-3">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-white">
                <Image src={i.imageUrl} alt={i.name} width={56} height={56} className="h-full w-full object-contain p-1" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{i.name}</p>
                <p className="text-xs text-slate-500">Qty ×{i.quantity}</p>
              </div>
              <span className="text-sm font-semibold text-slate-900">{money(i.price * i.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 space-y-2 border-t pt-4 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="tabular-nums">{money(subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span className="flex items-center gap-1.5"><Truck size={15} className="text-orange-500" /> Delivery Charge</span>
            {deliveryFee === 0 ? (
              <span className="flex items-center gap-2">
                <span className="tabular-nums text-slate-400 line-through">{money(DELIVERY_FEE)}</span>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">FREE</span>
              </span>
            ) : (
              <span className="tabular-nums">{money(deliveryFee)}</span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between border-t pt-3">
            <span className="text-base font-semibold text-slate-900">Total</span>
            <span className="text-2xl font-bold tabular-nums text-sky-600">{money(total)}</span>
          </div>
        </div>
      </section>

      {/* Delivery banner */}
      <div className="flex items-start gap-3 rounded-2xl bg-sky-50 p-4">
        <Truck size={20} className="mt-0.5 shrink-0 text-sky-600" />
        <div className="text-sm">
          <p className="font-semibold text-slate-900">Fast Delivery Across Lebanon</p>
          {deliveryFee === 0 ? (
            <p className="font-medium text-emerald-700">You&apos;ve unlocked free delivery! · Estimated 1–3 business days</p>
          ) : (
            <p className="text-slate-600">
              Delivery fee: {money(deliveryFee)} · Add {money(FREE_DELIVERY_THRESHOLD - subtotal)} for free delivery · 1–3 business days
            </p>
          )}
        </div>
      </div>

      {/* Payment */}
      <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
          💳 Payment Method
        </h2>
        {/* Single option now; the label pattern scales to more methods later. */}
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-sky-500 bg-sky-50/60 p-4">
          <input type="radio" name="paymentMode" value="COD" defaultChecked className="h-5 w-5 text-sky-600 focus:ring-sky-500" />
          <Banknote size={22} className="text-sky-600" />
          <span className="flex-1">
            <span className="block font-medium text-slate-900">Cash on Delivery</span>
            <span className="block text-sm text-slate-500">Pay when your order arrives.</span>
          </span>
        </label>
      </section>

      {/* Security */}
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
        <ShieldCheck size={20} className="shrink-0 text-emerald-600" />
        <p className="text-sm text-emerald-800">Your information is securely encrypted. 100% secure checkout.</p>
      </div>

      {/* Sticky bottom checkout bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-md items-center gap-4 px-4 py-3">
          <div className="leading-tight">
            <div className="text-xs text-slate-500">Total</div>
            <div className="text-lg font-bold tabular-nums text-slate-900">{money(total)}</div>
          </div>
          <PlaceOrderButton total={total} />
        </div>
      </div>
    </form>
  );
}
