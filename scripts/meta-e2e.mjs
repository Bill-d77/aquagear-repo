#!/usr/bin/env node
// End-to-end check of the Meta integration against a running app + a LOCAL database:
// signed webhook → conversation/message → draft order → admin review/confirm → stock.
//
//   DATABASE_URL=postgresql://…@localhost:…/db META_APP_SECRET=… META_VERIFY_TOKEN=… \
//   CRON_SECRET=… BASE_URL=http://localhost:3100 node scripts/meta-e2e.mjs
//
// The app must be started with the same META_* / CRON_SECRET values. Refuses to
// run against a non-local database because it creates test products and orders.
import { createHash, createHmac } from "node:crypto";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const { DATABASE_URL = "", META_APP_SECRET, META_VERIFY_TOKEN, CRON_SECRET } = process.env;
const BASE = process.env.BASE_URL ?? "http://localhost:3100";
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(DATABASE_URL)) throw new Error("Refusing to run: DATABASE_URL must point at localhost");
for (const [k, v] of Object.entries({ META_APP_SECRET, META_VERIFY_TOKEN, CRON_SECRET })) if (!v) throw new Error(`${k} is required`);

const prisma = new PrismaClient();
const run = Date.now().toString(36);
const waId = `9617${String(Date.now()).slice(-7)}`;
const igsid = `99${Date.now()}`;
const IG_BUSINESS = "17840000000000001";
let passed = 0;
const step = async (name, fn) => {
  await fn();
  passed++;
  console.log(`  ✓ ${name}`);
};

const sign = (body) => `sha256=${createHmac("sha256", META_APP_SECRET).update(body).digest("hex")}`;
const post = (body, signature = sign(body)) =>
  fetch(`${BASE}/api/webhooks/meta`, { method: "POST", body, headers: { "content-type": "application/json", "x-hub-signature-256": signature } });
let seq = 0;
const AD_ID = `1202${run}`;
const waText = (text, { ad = false, id = `wamid.e2e.${run}.${++seq}` } = {}) =>
  JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ id: "WABA", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "96100000000", phone_number_id: "PNID" },
      contacts: [{ profile: { name: `E2E Diver ${run}` }, wa_id: waId }],
      messages: [{
        from: waId, id, timestamp: String(Math.floor(Date.now() / 1000) + seq), type: "text", text: { body: text },
        // Click-to-WhatsApp ad: only a chat's first message carries the referral.
        ...(ad ? { referral: { source_id: AD_ID, source_type: "ad", source_url: "https://fb.me/e2e", headline: "E2E ad", ctwa_clid: `clid-${run}` } } : {}),
      }],
    } }] }],
  });
const igText = (text, echo = false) =>
  JSON.stringify({
    object: "instagram",
    entry: [{ id: IG_BUSINESS, time: Date.now(), messaging: [{
      sender: { id: echo ? IG_BUSINESS : igsid },
      recipient: { id: echo ? igsid : IG_BUSINESS },
      timestamp: Date.now() + ++seq,
      message: { mid: `ig.e2e.${run}.${seq}`, text, ...(echo ? { is_echo: true } : {}) },
    }] }],
  });

async function until(fn, label, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) throw new Error(`timed out waiting for ${label}`);
    await new Promise((r) => setTimeout(r, 300));
  }
}

// ── Fixtures ────────────────────────────────────────────────────────────────
const category = await prisma.category.upsert({ where: { name: "E2E" }, create: { name: "E2E" }, update: {} });
// Earlier runs' products would make names genuinely ambiguous — archive them (archived = not matchable).
await prisma.product.updateMany({ where: { categoryId: category.id }, data: { isArchived: true } });
const mkProduct = (slug, name, extra = {}) =>
  prisma.product.create({ data: { slug: `${slug}-${run}`, name, description: "e2e", price: 2500, stock: 10, categoryId: category.id, ...extra } });
const proMask = await mkProduct("e2e-pro-mask", `Zephyr Pro Diving Mask - Black`, { aliases: [`zephyr black ${run}`] });
await mkProduct("e2e-sport-mask", `Zephyr Sport Diving Mask - Blue`);
const blackMask = await mkProduct("e2e-black-mask", `Quokka Black Mask`);
const adminEmail = `e2e-admin-${run}@test.local`;
await prisma.user.create({ data: { email: adminEmail, name: "E2E Admin", role: "ADMIN", password: await bcrypt.hash("e2e-password-1", 10) } });

console.log(`Meta e2e against ${BASE} (run ${run})`);
try {
  await step("GET verification: correct token echoes challenge, wrong token 403", async () => {
    const ok = await fetch(`${BASE}/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=${encodeURIComponent(META_VERIFY_TOKEN)}&hub.challenge=12345`);
    assert.equal(ok.status, 200);
    assert.equal(await ok.text(), "12345");
    const bad = await fetch(`${BASE}/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=12345`);
    assert.equal(bad.status, 403);
    assert.ok(!(await bad.text()).includes(META_VERIFY_TOKEN));
  });

  await step("POST security: bad signature 401, missing 401, malformed JSON 400, oversized 413", async () => {
    const body = waText("I want 2 masks");
    assert.equal((await post(body, sign(body + "x"))).status, 401);
    assert.equal((await post(body, "")).status, 401);
    assert.equal((await post("{not json")).status, 400);
    assert.equal((await post("x".repeat(1024 * 1024 + 10))).status, 413);
    assert.equal(await prisma.conversation.count({ where: { externalUserId: waId } }), 0, "rejected deliveries store nothing");
  });

  await step("Unsupported event is acknowledged and logged as IGNORED", async () => {
    const body = JSON.stringify({ object: "page", entry: [{ id: "1", changes: [{ field: "feed", value: { run } }] }] });
    assert.equal((await post(body)).status, 200);
    const ev = await until(() => prisma.metaWebhookEvent.findFirst({ where: { eventType: "page", payload: { path: ["entry", "0", "changes", "0", "value", "run"], equals: run } } }), "ignored event");
    assert.equal(ev.status, "IGNORED");
  });

  await step("WhatsApp: chat not started from an ad is discarded — no conversation, payload wiped", async () => {
    const body = waText("Hi, do you have masks?");
    assert.equal((await post(body)).status, 200);
    const eventKey = createHash("sha256").update(body).digest("hex");
    const ev = await until(async () => {
      const e = await prisma.metaWebhookEvent.findUnique({ where: { eventKey } });
      return e?.status === "IGNORED" ? e : null;
    }, "discarded event");
    assert.deepEqual(ev.payload, {});
    assert.equal(await prisma.conversation.count({ where: { externalUserId: waId } }), 0);
  });

  let draftId;
  await step("WhatsApp: inquiry from an ad creates conversation (ad recorded) but no order", async () => {
    assert.equal((await post(waText("How much is the Zephyr Pro diving mask?", { ad: true }))).status, 200);
    const conv = await until(() => prisma.conversation.findFirst({ where: { externalUserId: waId }, include: { messages: true } }), "conversation");
    assert.equal(conv.messages[0].metadata?.ad?.adId, AD_ID);
    assert.equal(conv.name, `E2E Diver ${run}`);
    assert.equal(conv.phone, `+${waId}`);
    await until(async () => (await prisma.conversation.findFirst({ where: { externalUserId: waId } }))?.extraction, "extraction");
    assert.equal(await prisma.order.count({ where: { conversationId: conv.id } }), 0);
  });

  let orderMsg;
  await step("WhatsApp: order intent + delivery + phone → PENDING_CONFIRMATION draft, product matched", async () => {
    orderMsg = waText("I want 2 black Zephyr Pro diving masks. Deliver to Tripoli. My number is 70 123 456");
    assert.equal((await post(orderMsg)).status, 200);
    const draft = await until(
      () => prisma.order.findFirst({ where: { conversation: { externalUserId: waId } }, include: { items: true, audits: true } }),
      "draft order",
    );
    draftId = draft.id;
    assert.equal(draft.source, "WHATSAPP");
    assert.equal(draft.status, "PENDING_CONFIRMATION");
    assert.deepEqual(draft.items.map((i) => [i.productId, i.quantity, i.price]), [[proMask.id, 2, 2500]]);
    assert.equal(draft.phoneNumber, "+96170123456");
    assert.equal(draft.location, "Tripoli");
    assert.equal(draft.audits.length, 1);
    assert.equal((await prisma.product.findUnique({ where: { id: proMask.id } })).stock, 10, "drafts never touch stock");
  });

  await step("Duplicate delivery: same webhook twice → no duplicate message/customer/order/audit", async () => {
    const before = {
      conv: await prisma.conversation.count({ where: { externalUserId: waId } }),
      msgs: await prisma.message.count({ where: { conversation: { externalUserId: waId } } }),
      orders: await prisma.order.count({ where: { conversation: { externalUserId: waId } } }),
      audits: await prisma.orderAudit.count({ where: { orderId: draftId } }),
    };
    assert.equal((await post(orderMsg)).status, 200);
    // Same message id inside a *different* delivery body must also dedupe.
    const sameIdNewBody = orderMsg.replace('"messaging_product":"whatsapp"', '"messaging_product":"whatsapp","x":1');
    assert.equal((await post(sameIdNewBody)).status, 200);
    await new Promise((r) => setTimeout(r, 1500));
    assert.deepEqual(
      {
        conv: await prisma.conversation.count({ where: { externalUserId: waId } }),
        msgs: await prisma.message.count({ where: { conversation: { externalUserId: waId } } }),
        orders: await prisma.order.count({ where: { conversation: { externalUserId: waId } } }),
        audits: await prisma.orderAudit.count({ where: { orderId: draftId } }),
      },
      before,
    );
  });

  await step("Instagram: inquiry → no order; echo stored as outbound; 'send me one' → NEEDS_REVIEW draft without invented phone", async () => {
    await post(igText("Hi, how much is the Quokka black mask?"));
    await post(igText("$25", true));
    await post(igText("Can you deliver to Jounieh?"));
    const conv = await until(() => prisma.conversation.findFirst({ where: { channel: "INSTAGRAM", externalUserId: igsid } }), "ig conversation");
    await until(async () => (await prisma.message.count({ where: { conversationId: conv.id } })) === 3, "3 ig messages");
    assert.equal(await prisma.message.count({ where: { conversationId: conv.id, direction: "OUTBOUND" } }), 1);
    assert.equal(await prisma.order.count({ where: { conversationId: conv.id } }), 0);
    await post(igText("Okay send me one."));
    const draft = await until(() => prisma.order.findFirst({ where: { conversationId: conv.id }, include: { items: true } }), "ig draft");
    assert.equal(draft.source, "INSTAGRAM");
    assert.equal(draft.status, "NEEDS_REVIEW");
    assert.equal(draft.phoneNumber, null);
    assert.deepEqual(draft.items.map((i) => [i.productId, i.quantity]), [[blackMask.id, 1]]);
  });

  await step("Unauthenticated: admin pages redirect, admin APIs 403, media 403", async () => {
    const page = await fetch(`${BASE}/admin/inbox`, { redirect: "manual" });
    assert.ok([302, 303, 307, 308].includes(page.status), `inbox status ${page.status}`);
    const review = await fetch(`${BASE}/api/admin/orders/review`, { method: "POST", body: new URLSearchParams({ id: draftId, intent: "confirm" }) });
    assert.equal(review.status, 403);
    assert.equal((await fetch(`${BASE}/api/admin/meta/media/x`)).status, 403);
    assert.equal((await fetch(`${BASE}/api/admin/meta/reply`, { method: "POST", body: new URLSearchParams({ conversationId: "x", text: "hi" }) })).status, 403);
  });

  // ── Admin session ──────────────────────────────────────────────────────────
  const jar = new Map();
  const keep = (res) => {
    for (const c of res.headers.getSetCookie()) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return res;
  };
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const authed = (path, init = {}) => fetch(`${BASE}${path}`, { redirect: "manual", ...init, headers: { ...init.headers, cookie: cookie() } }).then(keep);

  await step("Admin login works (credentials)", async () => {
    const { csrfToken } = await authed("/api/auth/csrf").then((r) => r.json());
    await authed("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken, email: adminEmail, password: "e2e-password-1", callbackUrl: `${BASE}/admin` }),
    });
    const res = await authed("/admin/inbox");
    assert.equal(res.status, 200);
    assert.ok((await res.text()).includes(`E2E Diver ${run}`));
  });

  await step("Non-admin user is rejected from admin APIs", async () => {
    // A signed-in USER gets the same 403 as anonymous (role check, not just auth).
    const userEmail = `e2e-user-${run}@test.local`;
    await prisma.user.create({ data: { email: userEmail, name: "U", role: "USER", password: await bcrypt.hash("e2e-password-2", 10) } });
    const ujar = new Map();
    const ukeep = (res) => { for (const c of res.headers.getSetCookie()) { const [p] = c.split(";"); const i = p.indexOf("="); ujar.set(p.slice(0, i), p.slice(i + 1)); } return res; };
    const ucookie = () => [...ujar].map(([k, v]) => `${k}=${v}`).join("; ");
    const { csrfToken } = await fetch(`${BASE}/api/auth/csrf`).then(ukeep).then((r) => r.json());
    await fetch(`${BASE}/api/auth/callback/credentials`, {
      method: "POST", redirect: "manual",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie: ucookie() },
      body: new URLSearchParams({ csrfToken, email: userEmail, password: "e2e-password-2" }),
    }).then(ukeep);
    const res = await fetch(`${BASE}/api/admin/orders/review`, { method: "POST", headers: { cookie: ucookie() }, body: new URLSearchParams({ id: draftId, intent: "confirm" }) });
    assert.equal(res.status, 403);
  });

  await step("XSS: a <script> DM renders as escaped text in the dashboard", async () => {
    await post(waText('<script>alert("x")</script><img src=x onerror=alert(1)>'));
    const conv = await prisma.conversation.findFirst({ where: { externalUserId: waId } });
    await until(async () => (await prisma.message.count({ where: { conversationId: conv.id, text: { contains: "<script>" } } })) === 1, "xss message");
    const html = await authed(`/admin/inbox/${conv.id}`).then((r) => r.text());
    assert.ok(html.includes("&lt;script&gt;alert"), "escaped");
    assert.ok(!html.includes('<script>alert("x")'), "never raw");
    assert.ok(!html.includes("<img src=x onerror"), "never raw");
  });

  await step("Admin edits + confirms draft → PLACED via normal workflow, stock reserved once, audited", async () => {
    const res = await authed("/api/admin/orders/review", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams([
        ["id", draftId], ["intent", "confirm"], ["name", "E2E Diver"], ["phoneNumber", "+96170123456"],
        ["location", "Tripoli, Mina"], ["apartment", "Bldg 4, 2nd floor"], ["notes", ""], ["priceReason", "agreed in chat"],
        ["itemProductId", proMask.id], ["itemQuantity", "3"], ["itemPrice", "20.00"],
        ["itemProductId", ""], ["itemQuantity", "1"], ["itemPrice", ""],
      ]),
    });
    assert.equal(res.status, 307, `review status ${res.status}`);
    assert.ok(!res.headers.get("location")?.includes("error="), res.headers.get("location"));
    const order = await prisma.order.findUnique({ where: { id: draftId }, include: { items: true, audits: true } });
    assert.equal(order.status, "PLACED");
    assert.ok(order.placedAt);
    assert.deepEqual(order.items.map((i) => [i.quantity, i.price]), [[3, 2000]]);
    assert.equal((await prisma.product.findUnique({ where: { id: proMask.id } })).stock, 7);
    const actions = order.audits.map((a) => a.action);
    assert.ok(actions.includes("Draft edited") && actions.some((a) => a.startsWith("Draft confirmed")), actions.join(" | "));
    assert.ok(order.audits.find((a) => a.action === "Draft edited").detail.includes("reason: agreed in chat"));
    // Confirming again is refused — no double stock decrement.
    await authed("/api/admin/orders/review", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ id: draftId, intent: "confirm" }) });
    assert.equal((await prisma.product.findUnique({ where: { id: proMask.id } })).stock, 7);
  });

  await step("New messages after confirmation start a fresh draft (no merge into the placed order)", async () => {
    await post(waText("I want one Quokka black mask too. Deliver to Tripoli. 70 123 456"));
    await until(async () => (await prisma.order.count({ where: { conversation: { externalUserId: waId } } })) === 2, "second order");
    const placed = await prisma.order.findUnique({ where: { id: draftId }, include: { items: true } });
    assert.equal(placed.items.length, 1);
  });

  await step("Draft status can't be bypassed through the generic status route", async () => {
    const ig = await prisma.order.findFirst({ where: { conversation: { externalUserId: igsid } } });
    const res = await authed("/api/admin/orders/status", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ id: ig.id, status: "PLACED" }) });
    assert.ok(res.headers.get("location")?.includes("error="));
    assert.equal((await prisma.order.findUnique({ where: { id: ig.id } })).status, "NEEDS_REVIEW");
  });

  await step("Failed event is retried by the cron (auth required)", async () => {
    const payload = JSON.parse(waText("retry me please"));
    const ev = await prisma.metaWebhookEvent.create({
      data: { eventKey: `e2e-retry-${run}`, channel: "WHATSAPP", eventType: "message", payload, status: "FAILED", retryCount: 1, error: "simulated", nextRetryAt: new Date(Date.now() - 1000) },
    });
    assert.equal((await fetch(`${BASE}/api/cron/meta`)).status, 401);
    assert.equal((await fetch(`${BASE}/api/cron/meta`, { headers: { authorization: "Bearer wrong" } })).status, 401);
    const res = await fetch(`${BASE}/api/cron/meta`, { headers: { authorization: `Bearer ${CRON_SECRET}` } });
    assert.equal(res.status, 200);
    assert.equal((await prisma.metaWebhookEvent.findUnique({ where: { id: ev.id } })).status, "PROCESSED");
    assert.equal(await prisma.message.count({ where: { text: "retry me please", conversation: { externalUserId: waId } } }), 1);
  });

  await step("Website regression: add-to-cart still creates a PENDING cart tagged WEBSITE", async () => {
    const form = new FormData();
    form.set("productId", blackMask.id);
    form.set("quantity", "1");
    const res = await fetch(`${BASE}/api/cart/add`, { method: "POST", body: form });
    assert.equal(res.status, 200);
    const cartId = res.headers.getSetCookie().find((c) => c.startsWith("cartId="))?.split(";")[0].split("=")[1];
    const cart = await prisma.order.findUnique({ where: { id: cartId } });
    assert.equal(cart.status, "PENDING");
    assert.equal(cart.source, "WEBSITE");
  });

  await step("Meta page never exposes secrets", async () => {
    const html = await authed("/admin/meta").then((r) => r.text());
    assert.ok(!html.includes(META_APP_SECRET) && !html.includes(META_VERIFY_TOKEN));
  });

  console.log(`\n${passed} passed`);
} finally {
  await prisma.$disconnect();
}
