// Run with: node --test src/lib/telegram.test.ts   (Node >=23 strips TS types)
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildOrderMessage, type OrderNotification } from "./telegram.ts";

const base: OrderNotification = {
  id: "ord_123",
  name: "Jane Diver",
  phone: "+96170123456",
  address: "Beirut, Apt 4",
  paymentMode: "COD",
  status: "PLACED",
  createdAt: new Date("2026-06-26T09:30:00Z"),
  items: [{ name: "Life Jacket", quantity: 2, price: 3500 }],
  subtotal: 7000,
  discount: 0,
  shipping: 0,
  total: 7000,
  dashboardUrl: "https://shop.test/admin/orders/ord_123",
};

test("formats money in dollars and multiplies line totals", () => {
  const msg = buildOrderMessage(base);
  assert.match(msg, /Life Jacket × 2/);
  assert.match(msg, /\$70\.00/); // 2 × $35.00
  assert.match(msg, /Total: \$70\.00/);
});

test("renders every product line", () => {
  const msg = buildOrderMessage({
    ...base,
    items: [
      { name: "Mask", quantity: 1, price: 2000 },
      { name: "Fins", quantity: 3, price: 1500 },
    ],
  });
  assert.match(msg, /Mask × 1/);
  assert.match(msg, /Fins × 3/);
  assert.match(msg, /\$45\.00/); // 3 × $15.00
});

test("escapes HTML-significant characters in user data", () => {
  const msg = buildOrderMessage({ ...base, name: "A & B <script>" });
  assert.match(msg, /A &amp; B &lt;script&gt;/);
  assert.doesNotMatch(msg, /<script>/);
});
