#!/usr/bin/env node
// Normalize Order.phoneNumber → Order.phoneE164 and report customers that look
// like duplicates (same number typed differently, several accounts/names, or a
// WhatsApp chat on the same number). Never merges anything — merging is an
// admin decision.
//
//   DATABASE_URL=… node scripts/backfill-phones.mjs           # dry run (default)
//   DATABASE_URL=… node scripts/backfill-phones.mjs --apply   # also write phoneE164
import { PrismaClient } from "@prisma/client";
import { toE164 } from "../src/lib/phone.ts";

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient();
// "+961 3 *** 456" — enough to recognise a customer, not enough to leak the number.
const mask = (p) => (p ? `${p.slice(0, p.length - 6)} *** ${p.slice(-3)}` : "—");

try {
  const orders = await prisma.order.findMany({
    where: { phoneNumber: { not: null }, status: { not: "PENDING" } }, // PENDING = live cart
    select: { id: true, phoneNumber: true, phoneE164: true, name: true, userId: true },
  });
  const conversations = await prisma.conversation.findMany({
    where: { channel: "WHATSAPP", phone: { not: null } },
    select: { phone: true, name: true, contactName: true },
  });
  const chatByPhone = new Map(conversations.map((c) => [c.phone, c]));

  const groups = new Map();
  const unparsable = [];
  const updates = [];
  for (const o of orders) {
    const e164 = toE164(o.phoneNumber);
    if (!e164) {
      unparsable.push(o);
      continue;
    }
    if (o.phoneE164 !== e164) updates.push({ id: o.id, e164 });
    const g = groups.get(e164) ?? { orders: 0, formats: new Set(), names: new Set(), users: new Set() };
    g.orders++;
    g.formats.add(o.phoneNumber.trim());
    if (o.name) g.names.add(o.name.trim().toLowerCase());
    if (o.userId) g.users.add(o.userId);
    groups.set(e164, g);
  }

  const suspicious = [...groups].filter(([, g]) => g.formats.size > 1 || g.names.size > 1 || g.users.size > 1);
  console.log(`Orders with a phone: ${orders.length} · distinct customers by phone: ${groups.size} · unparsable: ${unparsable.length}`);
  console.log(`phoneE164 to write: ${updates.length}${apply ? "" : " (dry run — pass --apply to write)"}`);
  console.log(`\nLikely duplicates (same number, different spelling / names / accounts): ${suspicious.length}`);
  for (const [e164, g] of suspicious) {
    console.log(
      `  ${mask(e164)}  orders=${g.orders}  formats=${g.formats.size}  names=${g.names.size}  accounts=${g.users.size}` +
        (chatByPhone.has(e164) ? "  + WhatsApp chat" : ""),
    );
  }
  if (unparsable.length) console.log(`\nUnparsable phone numbers on orders: ${unparsable.map((o) => o.id).join(", ")}`);

  if (apply) {
    for (const u of updates) await prisma.order.update({ where: { id: u.id }, data: { phoneE164: u.e164 } });
    console.log(`\nWrote phoneE164 on ${updates.length} orders.`);
  }
} finally {
  await prisma.$disconnect();
}
