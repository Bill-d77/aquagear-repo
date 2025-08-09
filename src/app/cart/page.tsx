import Link from "next/link";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import Image from "next/image";

export default async function CartPage() {
  const cartId = cookies().get("cartId")?.value;
  const items = cartId ? await prisma.orderItem.findMany({
    where: { orderId: cartId },
    include: { product: true }
  }) : [] as Array<{ id: string; product: { name: string; imageUrl: string; slug?: string }; price: number; quantity: number }>;
  const total = items.reduce((s: number, i: { price: number; quantity: number }) => s + i.price * i.quantity, 0);

  const whatsappMessage = encodeURIComponent(
    `Hello, I'd like to order:\n` +
    items.map((i: any) => `- ${i.product.name} x ${i.quantity}`).join("\n") +
    (items.length ? `\nTotal: ${(total/100).toFixed(2)} USD` : "")
  );
  const whatsappLink = `https://wa.me/96171634379?text=${whatsappMessage}`;

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight mb-6">Your cart</h1>
      {items.length === 0 ? <p>Your cart is empty.</p> : (
        <div className="space-y-3">
          {items.map((i: any) => (
            <div key={i.id} className="flex items-center justify-between card">
              <div className="flex items-center gap-4">
                <div className="overflow-hidden rounded-xl">
                  <Image src={i.product.imageUrl} className="w-16 h-16 object-cover" alt={i.product.name} width={64} height={64} />
                </div>
                <div>
                  <div className="font-medium">{i.product.name}</div>
                  <div className="text-sm text-gray-600">{i.quantity} x {(i.price/100).toFixed(2)} USD</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`https://wa.me/96171634376?text=${encodeURIComponent(`Hello, I have a question about ${i.product.name}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline"
                >
                  WhatsApp
                </a>
                <form action="/api/cart/remove" method="post">
                  <input type="hidden" name="id" value={i.id} />
                  <button className="btn-outline">Remove</button>
                </form>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-3">
            <div className="font-semibold">Total</div>
            <div>{(total/100).toFixed(2)} USD</div>
          </div>
          <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="btn-primary inline-block">Checkout via WhatsApp</a>
        </div>
      )}
    </div>
  );
}
