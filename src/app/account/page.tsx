import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureValidImageUrl } from "@/lib/images";
import { AuthForm } from "./AuthForm";
import { SignOutButton } from "./SignOutButton";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Account · AquaGear" };

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const STATUS_STYLES: Record<string, string> = {
  PLACED: "bg-sky-100 text-sky-700",
  SHIPPED: "bg-emerald-100 text-emerald-700",
  CANCELED: "bg-red-100 text-red-600",
};

export default async function Account() {
  const session = await auth();

  if (!session?.user) {
    return (
      <Suspense fallback={<div className="max-w-xl card">Loading...</div>}>
        <AuthForm />
      </Suspense>
    );
  }

  const orders = await prisma.order.findMany({
    where: { userId: session.user.id, status: { not: "PENDING" } },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      items: {
        include: { product: { select: { name: true, slug: true, imageUrl: true } } },
      },
    },
  });

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hello {session.user.name}</h1>
          <p className="text-sm text-gray-500">{session.user.email}</p>
        </div>
        <SignOutButton />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-4">Your Orders</h2>
        {orders.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 py-10 text-center">
            <Package size={36} className="text-gray-300" />
            <p className="text-gray-600">No orders yet.</p>
            <Link href="/shop" className="btn-primary">Start shopping</Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((o) => (
              <div key={o.id} className="card space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-mono text-gray-500">#{o.id.slice(-8).toUpperCase()}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[o.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {o.status}
                  </span>
                  <span className="text-gray-500">{o.createdAt.toLocaleDateString("en-GB")}</span>
                  <span className="font-semibold">{money(o.total)}</span>
                </div>
                <ul className="space-y-2">
                  {o.items.map((i) => (
                    <li key={i.id} className="flex items-center gap-3 text-sm">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg border bg-white">
                        <Image
                          src={ensureValidImageUrl(i.product.imageUrl)}
                          alt={i.product.name}
                          width={40}
                          height={40}
                          className="h-full w-full object-contain p-0.5"
                        />
                      </div>
                      <Link href={`/product/${i.product.slug}`} className="flex-1 truncate hover:text-sky-700">
                        {i.product.name}
                      </Link>
                      <span className="text-gray-500">×{i.quantity}</span>
                      <span className="tabular-nums">{money(i.price * i.quantity)}</span>
                    </li>
                  ))}
                </ul>
                {o.trackingNumber && (
                  <p className="text-xs text-gray-500">
                    Tracking: {o.carrier ? `${o.carrier} · ` : ""}{o.trackingNumber}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
