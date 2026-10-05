export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, redirectWithError } from "@/lib/admin";
import { DRAFT_STATUSES, isDraftStatus } from "@/lib/order-status";
import { changeOrderStatus, InsufficientStockError, OrderChangedError } from "@/lib/order-transitions";
import { deliveryFeeFor, MAX_CART_QUANTITY } from "@/lib/cart";
import { getStoreSettings } from "@/lib/settings";
import { toE164 } from "@/lib/phone";

const text = (max: number) => z.string().trim().max(max).transform((v) => v || null);
const schema = z.object({
  id: z.string().min(1),
  intent: z.enum(["save", "confirm", "reject"]),
  name: text(100),
  phoneNumber: text(40),
  location: text(200),
  apartment: text(200),
  notes: text(2000),
  priceReason: text(200),
  items: z
    .array(
      z.object({
        productId: z.string().min(1),
        quantity: z.coerce.number().int().min(1).max(MAX_CART_QUANTITY),
        // Dollars in the form; stored as cents. Blank = catalog price.
        price: z.union([
          z.literal("").transform(() => null),
          z.coerce.number().min(0).max(100_000).transform((d) => Math.round(d * 100)),
        ]),
      }),
    )
    .max(50),
});

const money = (c: number) => `$${(c / 100).toFixed(2)}`;

/**
 * Review a draft order created from a WhatsApp/Instagram conversation: save
 * edits, confirm (→ PLACED, reserving stock through the normal order
 * workflow), or reject (→ CANCELED). Every change lands in the audit log.
 */
export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;
  const actor = guard.user?.email ?? "admin";

  const form = await req.formData();
  const ids = form.getAll("itemProductId").map(String);
  const qtys = form.getAll("itemQuantity").map(String);
  const prices = form.getAll("itemPrice").map(String);
  // Rows the detector couldn't match ("pick the product") that still have a
  // quantity but no product: confirming would silently drop them.
  const kinds = form.getAll("itemKind").map(String);
  const unresolvedTexts = form.getAll("itemText").map(String);
  let u = 0;
  const unresolved = kinds.flatMap((kind, i) => {
    if (kind !== "unresolved") return [];
    const text = unresolvedTexts[u++] ?? "an item";
    return !ids[i] && Number(qtys[i]) > 0 ? [text] : [];
  });
  const parsed = schema.safeParse({
    id: form.get("id"),
    intent: form.get("intent"),
    name: form.get("name") ?? "",
    phoneNumber: form.get("phoneNumber") ?? "",
    location: form.get("location") ?? "",
    apartment: form.get("apartment") ?? "",
    notes: form.get("notes") ?? "",
    priceReason: form.get("priceReason") ?? "",
    // Blank rows / quantity 0 mean "no item here" (that's how an item is removed).
    items: ids
      .map((productId, i) => ({ productId, quantity: qtys[i], price: prices[i] ?? "" }))
      .filter((r) => r.productId && Number(r.quantity) > 0),
  });
  if (!parsed.success) {
    const id = String(form.get("id") ?? "");
    return redirectWithError(req, `/admin/orders/${id}`, "Some fields are invalid — check quantities (1–99) and prices.");
  }
  const { id, intent, items: rows, priceReason, ...fields } = parsed.data;
  const back = `/admin/orders/${id}`;

  const order = await prisma.order.findUnique({ where: { id }, include: { items: { include: { product: { select: { name: true } } } } } });
  if (!order) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!isDraftStatus(order.status)) return redirectWithError(req, back, "This order has already been reviewed.");

  const alreadyReviewed = () => redirectWithError(req, back, "This order has already been reviewed.");

  if (intent === "reject") {
    try {
      await changeOrderStatus(id, "CANCELED", DRAFT_STATUSES);
    } catch (e) {
      if (e instanceof OrderChangedError) return alreadyReviewed();
      throw e;
    }
    await prisma.orderAudit.create({ data: { orderId: id, actor, action: `Draft rejected (${order.status} → CANCELED)` } });
    if (order.conversationId) await prisma.conversation.update({ where: { id: order.conversationId }, data: { status: "OPEN" } });
    return NextResponse.redirect(new URL(back, req.url));
  }

  // Never trust submitted product ids — they must exist and be sellable.
  const products = await prisma.product.findMany({
    where: { id: { in: rows.map((i) => i.productId) }, isArchived: false },
    select: { id: true, name: true, price: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  if (rows.some((i) => !byId.has(i.productId))) return redirectWithError(req, back, "A selected product no longer exists or is archived.");
  const items = rows.map((i) => ({ ...i, price: i.price ?? byId.get(i.productId)!.price }));

  // Audit trail: field and item diffs, plus why a price differs from the catalog.
  const changes: string[] = [];
  for (const [k, v] of Object.entries(fields) as [keyof typeof fields, string | null][]) {
    if ((order[k] ?? null) !== v) changes.push(`${k}: "${order[k] ?? ""}" → "${v ?? ""}"`);
  }
  const before = order.items.map((i) => `${i.quantity} × ${i.product.name} @ ${money(i.price)}`).sort().join(", ");
  const after = items.map((i) => `${i.quantity} × ${byId.get(i.productId)!.name} @ ${money(i.price)}`).sort().join(", ");
  if (before !== after) changes.push(`items: [${before || "none"}] → [${after || "none"}]`);
  const repriced = items.filter((i) => i.price !== byId.get(i.productId)!.price);
  if (repriced.length && before !== after) {
    changes.push(
      `price override: ${repriced.map((i) => `${byId.get(i.productId)!.name} ${money(i.price)} (catalog ${money(byId.get(i.productId)!.price)})`).join(", ")}` +
        (priceReason ? ` — reason: ${priceReason}` : " — no reason given"),
    );
  }

  const { shippingFlatRate } = await getStoreSettings();
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  try {
    await prisma.$transaction(async (tx) => {
      // Status-guarded: row-locks the draft, and refuses if another admin confirmed/rejected it meanwhile.
      const claimed = await tx.order.updateMany({
        where: { id, status: { in: [...DRAFT_STATUSES] } },
        data: { ...fields, phoneE164: toE164(fields.phoneNumber), total: subtotal + deliveryFeeFor(subtotal, shippingFlatRate) },
      });
      if (claimed.count !== 1) throw new OrderChangedError();
      await tx.orderItem.deleteMany({ where: { orderId: id } });
      await tx.orderItem.createMany({ data: items.map((i) => ({ ...i, orderId: id })) });
      if (changes.length) await tx.orderAudit.create({ data: { orderId: id, actor, action: "Draft edited", detail: changes.join("\n").slice(0, 4000) } });
    });
  } catch (e) {
    if (e instanceof OrderChangedError) return alreadyReviewed();
    throw e;
  }

  if (intent === "confirm") {
    const missing = [!items.length && "at least one item", !fields.phoneNumber && "phone", !fields.location && "delivery location"].filter(Boolean);
    if (missing.length) return redirectWithError(req, back, `Saved. To confirm, add: ${missing.join(", ")}.`);
    if (unresolved.length) {
      return redirectWithError(req, back, `Saved. To confirm, pick a product (or set quantity 0) for: ${unresolved.map((t) => `“${t.slice(0, 60)}”`).join(", ")}.`);
    }
    try {
      // Same transition website orders use: validates and decrements stock atomically, once.
      await changeOrderStatus(id, "PLACED", DRAFT_STATUSES);
    } catch (e) {
      if (e instanceof InsufficientStockError) return redirectWithError(req, back, `Saved, but not confirmed: insufficient stock for ${e.message}.`);
      if (e instanceof OrderChangedError) return alreadyReviewed();
      throw e;
    }
    await prisma.orderAudit.create({ data: { orderId: id, actor, action: `Draft confirmed (${order.status} → PLACED)`, detail: `Total ${money(subtotal + deliveryFeeFor(subtotal, shippingFlatRate))}` } });
    if (order.conversationId) await prisma.conversation.update({ where: { id: order.conversationId }, data: { status: "ORDER_CONFIRMED" } });
  }

  return NextResponse.redirect(new URL(back, req.url));
}
