// Telegram order notifications — server-only. Credentials come from env and are
// never exposed to the client (no NEXT_PUBLIC_ prefix). Sending must never break
// checkout, so every public entry point swallows its own errors.
// `prisma` is imported lazily inside notifyNewOrder so the pure helpers above stay
// importable (and unit-testable) without pulling in the DB client.

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const MAX_RETRIES = 3;

export interface OrderLine {
  name: string;
  quantity: number;
  price: number; // unit price in cents
}

export interface OrderNotification {
  id: string;
  name: string;
  phone: string;
  address: string;
  paymentMode: string;
  status: string;
  createdAt: Date;
  items: OrderLine[];
  subtotal: number; // cents
  discount: number; // cents
  shipping: number; // cents
  total: number; // cents
  dashboardUrl: string;
}

const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;

// Telegram HTML parse mode only needs these three characters escaped.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const LINE = "━━━━━━━━━━━━━━━━━━";

/** Pure: build the Telegram HTML message. Kept side-effect-free so it's testable. */
export function buildOrderMessage(o: OrderNotification): string {
  const products = o.items
    .map((i) => `• ${esc(i.name)} × ${i.quantity}\n  ${money(i.price * i.quantity)}`)
    .join("\n");

  const d = o.createdAt;
  const date = d.toISOString().slice(0, 10);
  const time = d.toISOString().slice(11, 16) + " UTC";

  return [
    "🛒 <b>NEW AQUAGEAR ORDER</b>",
    LINE,
    `📦 <b>Order</b> #${esc(o.id)}`,
    LINE,
    `👤 <b>Customer</b>\n${esc(o.name)}`,
    `📞 <b>Phone</b>\n${esc(o.phone)}`,
    `📍 <b>Address</b>\n${esc(o.address)}`,
    LINE,
    `🛍 <b>Products</b>\n${products}`,
    LINE,
    "💰 <b>Summary</b>",
    `Subtotal: ${money(o.subtotal)}`,
    `Shipping: ${money(o.shipping)}`,
    `Discount: ${money(o.discount)}`,
    `<b>Total: ${money(o.total)}</b>`,
    LINE,
    `<b>Payment</b>\n${esc(o.paymentMode)}`,
    LINE,
    `<b>Status</b>\n🟡 ${esc(o.status)}`,
    LINE,
    `<b>Created</b>\n${date} ${time}`,
    LINE,
    `<a href="${esc(o.dashboardUrl)}">Open in Admin Dashboard</a>`,
  ].join("\n");
}

/** Send a message with up to MAX_RETRIES attempts (exponential backoff). Returns success. */
async function postTelegram(text: string): Promise<boolean> {
  if (!TOKEN || !CHAT_ID) {
    console.warn("[telegram] TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not set — skipping notification");
    return false;
  }
  const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: CHAT_ID,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      });
      if (res.ok) return true;
      const body = await res.text();
      console.error(`[telegram] attempt ${attempt}/${MAX_RETRIES} failed: ${res.status} ${body}`);
      // 4xx = bad token/chat/payload — retrying won't help.
      if (res.status >= 400 && res.status < 500) return false;
    } catch (err) {
      console.error(`[telegram] attempt ${attempt}/${MAX_RETRIES} network error:`, err);
    }
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1))); // 500ms, 1s
    }
  }
  return false;
}

/**
 * Notify the admin about a placed order. Idempotent and non-throwing:
 * - claims the order via `notifiedAt` so a duplicate request sends nothing;
 * - releases the claim if delivery ultimately fails, so it can be retried later.
 */
export async function notifyNewOrder(orderId: string): Promise<void> {
  try {
    const { prisma } = await import("@/lib/prisma");
    // Atomic claim — duplicate protection keyed on order id. count===1 means we won the claim.
    const claim = await prisma.order.updateMany({
      where: { id: orderId, notifiedAt: null },
      data: { notifiedAt: new Date() },
    });
    if (claim.count !== 1) return; // already notified or claimed elsewhere

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });
    if (!order) return;

    const subtotal = order.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const base = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "";

    const text = buildOrderMessage({
      id: order.id,
      name: order.name ?? "—",
      phone: order.phoneNumber ?? "—",
      address: [order.location, order.apartment].filter(Boolean).join(", ") || "—",
      paymentMode: order.paymentMode,
      status: order.status,
      createdAt: order.createdAt,
      items: order.items.map((i) => ({ name: i.product.name, quantity: i.quantity, price: i.price })),
      subtotal,
      discount: 0, // sale "old price" is display-only; the charged price has no real discount
      shipping: 0, // no shipping model yet
      total: order.total,
      dashboardUrl: base ? `${base}/admin/orders/${order.id}` : `/admin/orders/${order.id}`,
    });

    const ok = await postTelegram(text);
    if (!ok) {
      // Release the claim so the notification isn't lost permanently.
      await prisma.order.updateMany({ where: { id: orderId }, data: { notifiedAt: null } });
    }
  } catch (err) {
    console.error("[telegram] notifyNewOrder failed:", err);
  }
}
