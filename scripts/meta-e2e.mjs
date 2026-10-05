#!/usr/bin/env node
// End-to-end check of the Meta integration against a running app + a LOCAL database:
// signed webhook → conversation/message → draft order → admin review/confirm → stock.
//
//   DATABASE_URL=postgresql://…@localhost:…/db META_APP_SECRET=… META_VERIFY_TOKEN=… \
//   CRON_SECRET=… BASE_URL=http://localhost:3100 node scripts/meta-e2e.mjs
//
// The app must be started with the same META_* / CRON_SECRET values. Refuses to
// run against a non-local database because it creates test products and orders.
import { createHmac } from "node:crypto";
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
const waText = (text, id = `wamid.e2e.${run}.${++seq}`) =>
  JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ id: "WABA", changes: [{ field: "messages", value: {
      messaging_product: "whatsapp",
      metadata: { display_phone_number: "96100000000", phone_number_id: "PNID" },
      contacts: [{ profile: { name: `E2E Diver ${run}` }, wa_id: waId }],
      messages: [{ from: waId, id, timestamp: String(Math.floor(Date.now() / 1000) + seq), type: "text", text: { body: text } }],
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

// Coexistence fields share the WhatsApp envelope; only `field` and `value` differ.
const BUSINESS = "96100000000";
const waField = (field, value) =>
  JSON.stringify({
    object: "whatsapp_business_account",
    entry: [{ id: "WABA", changes: [{ field, value: { messaging_product: "whatsapp", metadata: { display_phone_number: BUSINESS, phone_number_id: "PNID" }, ...value } }] }],
  });
const ts = (offsetSec = 0) => String(Math.floor(Date.now() / 1000) + offsetSec);

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
    assert.equal((await post("x".repeat(4 * 1024 * 1024 + 10))).status, 413);
    assert.equal(await prisma.conversation.count({ where: { externalUserId: waId } }), 0, "rejected deliveries store nothing");
  });

  await step("Unsupported event is acknowledged and logged as IGNORED", async () => {
    const body = JSON.stringify({ object: "page", entry: [{ id: "1", changes: [{ field: "feed", value: { run } }] }] });
    assert.equal((await post(body)).status, 200);
    const ev = await until(() => prisma.metaWebhookEvent.findFirst({ where: { eventType: "page", payload: { path: ["entry", "0", "changes", "0", "value", "run"], equals: run } } }), "ignored event");
    assert.equal(ev.status, "IGNORED");
  });

  let draftId;
  await step("WhatsApp: inquiry creates conversation but no order", async () => {
    assert.equal((await post(waText("How much is the Zephyr Pro diving mask?"))).status, 200);
    const conv = await until(() => prisma.conversation.findFirst({ where: { externalUserId: waId }, include: { messages: true } }), "conversation");
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

  await step("Coexistence history: imported as historical, no unread/window/order, re-delivery deduped", async () => {
    const hist = `9613${String(Date.now()).slice(-6)}`;
    const body = waField("history", { history: [{ metadata: { phase: 0, chunk_order: 1, progress: 100 }, threads: [{ id: hist, messages: [
      { from: hist, id: `wamid.h.${run}.1`, timestamp: ts(-7200), type: "text", text: { body: "I want 2 black Zephyr Pro diving masks. Deliver to Tripoli. 70 123 456" } },
      { from: BUSINESS, id: `wamid.h.${run}.2`, timestamp: ts(-7100), type: "media_placeholder" },
    ] }] }] });
    assert.equal((await post(body)).status, 200);
    const conv = await until(async () => {
      const c = await prisma.conversation.findFirst({ where: { externalUserId: hist }, include: { messages: true } });
      return c?.messages.length === 2 ? c : null;
    }, "history conversation");
    assert.ok(conv.messages.every((m) => m.isHistorical));
    assert.equal(conv.unreadCount, 0);
    assert.equal(conv.lastInboundAt, null, "history never opens the API reply window");
    assert.equal(conv.extraction, null, "history never runs order detection");
    assert.equal(await prisma.order.count({ where: { conversationId: conv.id } }), 0);

    // Same chunk again inside a different body: no duplicates.
    assert.equal((await post(body.replace('"progress":100', '"progress":100,"x":1'))).status, 200);
    // Media for the placeholder arrives later under value.messages with the same wamid.
    await post(waField("history", { messages: [{ from: BUSINESS, id: `wamid.h.${run}.2`, timestamp: ts(-7100), type: "image", image: { id: "MEDIA1", mime_type: "image/jpeg", caption: "price list" } }] }));
    const filled = await until(() => prisma.message.findFirst({ where: { externalMessageId: `wamid.h.${run}.2`, type: "IMAGE" } }), "placeholder filled");
    assert.equal(filled.text, "price list");
    assert.equal(await prisma.message.count({ where: { conversationId: conv.id } }), 2);

    // Contact sync: sets contactName only; a contact with no chat stays out of the inbox.
    const stranger = `9617${String(Date.now()).slice(-7)}`;
    await post(waField("smb_app_state_sync", { state_sync: [
      { type: "contact", contact: { full_name: `Rami ${run}`, phone_number: hist }, action: "add", metadata: { timestamp: ts() } },
      { type: "contact", contact: { full_name: `Stranger ${run}`, phone_number: stranger }, action: "add", metadata: { timestamp: ts() } },
    ] }));
    await until(async () => (await prisma.conversation.findFirst({ where: { externalUserId: hist } }))?.contactName === `Rami ${run}`, "contact name");
    const empty = await until(() => prisma.conversation.findFirst({ where: { externalUserId: stranger } }), "contact placeholder");
    assert.equal(await prisma.message.count({ where: { conversationId: empty.id } }), 0);
  });

  await step("Coexistence echo: phone-app reply stored OUTBOUND (no sentBy), no window, clears unread, never creates an order", async () => {
    const cx = `9613${String(Date.now() + 1).slice(-6)}`;
    await post(waField("messages", { contacts: [{ profile: { name: `Echo ${run}` }, wa_id: cx }], messages: [{ from: cx, id: `wamid.cx.${run}.1`, timestamp: ts(-60), type: "text", text: { body: "hello" } }] }));
    const conv = await until(() => prisma.conversation.findFirst({ where: { externalUserId: cx, unreadCount: 1 } }), "inbound");
    const windowOpenedAt = conv.lastInboundAt.getTime();
    await post(waField("smb_message_echoes", { message_echoes: [{ from: BUSINESS, to: cx, id: `wamid.cx.${run}.2`, timestamp: ts(), type: "text", text: { body: "I want 2 Zephyr Pro masks for you? Deliver to Tripoli 70 123 456" } }] }));
    const echo = await until(() => prisma.message.findFirst({ where: { externalMessageId: `wamid.cx.${run}.2` } }), "echo");
    assert.equal(echo.direction, "OUTBOUND");
    assert.equal(echo.sentBy, null, "no sentBy = sent from the phone app");
    assert.equal(echo.isHistorical, false);
    const after = await until(async () => {
      const c = await prisma.conversation.findUnique({ where: { id: conv.id } });
      return c.unreadCount === 0 ? c : null;
    }, "unread cleared");
    assert.equal(after.lastInboundAt.getTime(), windowOpenedAt, "echo never moves the API window");
    await new Promise((r) => setTimeout(r, 1000));
    assert.equal(await prisma.order.count({ where: { conversationId: conv.id } }), 0, "a staff message alone never creates an order");
  });

  await step("BSUID: phone withheld → thread by user id; later message with phone joins the same thread", async () => {
    const bsuid = `LB.${run}${Date.now()}`;
    const phone = `9617${String(Date.now() + 2).slice(-7)}`;
    await post(waField("messages", { contacts: [{ user_id: bsuid, profile: { name: `Anon ${run}` } }], messages: [{ from_user_id: bsuid, id: `wamid.b.${run}.1`, timestamp: ts(-30), type: "text", text: { body: "hi" } }] }));
    const conv = await until(() => prisma.conversation.findFirst({ where: { bsuid } }), "bsuid conversation");
    assert.equal(conv.externalUserId, bsuid);
    assert.equal(conv.phone, null);
    await post(waField("messages", { contacts: [{ user_id: bsuid, wa_id: phone, profile: { name: `Anon ${run}` } }], messages: [{ from: phone, from_user_id: bsuid, id: `wamid.b.${run}.2`, timestamp: ts(), type: "text", text: { body: "still me" } }] }));
    await until(async () => (await prisma.message.count({ where: { conversationId: conv.id } })) === 2, "same thread");
    assert.equal((await prisma.conversation.findUnique({ where: { id: conv.id } })).phone, `+${phone}`);
    assert.equal(await prisma.conversation.count({ where: { OR: [{ bsuid }, { externalUserId: phone }] } }), 1);
  });

  await step("Draft orders store the normalized phone (phoneE164)", async () => {
    assert.equal((await prisma.order.findUnique({ where: { id: draftId } })).phoneE164, "+96170123456");
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
    assert.equal((await fetch(`${BASE}/api/admin/meta/onboard`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ intent: "sync" }) })).status, 403);
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

  await step("Confirm guards: unresolved item blocks; two simultaneous confirms deduct stock once; reject after confirm refused", async () => {
    const draft = await prisma.order.findFirst({ where: { conversation: { externalUserId: waId }, status: { in: ["PENDING_CONFIRMATION", "NEEDS_REVIEW"] } } });
    assert.ok(draft, "second draft exists");
    const form = (intent, extra = []) =>
      new URLSearchParams([
        ["id", draft.id], ["intent", intent], ["name", "E2E Diver"], ["phoneNumber", "70 123 456"], ["location", "Tripoli"],
        ["apartment", ""], ["notes", ""], ["priceReason", ""],
        ["itemKind", "item"], ["itemProductId", blackMask.id], ["itemQuantity", "1"], ["itemPrice", ""],
        ...extra,
      ]);
    const review = (body) => authed("/api/admin/orders/review", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });

    const blocked = await review(form("confirm", [["itemKind", "unresolved"], ["itemText", "blue fins size 42"], ["itemProductId", ""], ["itemQuantity", "1"], ["itemPrice", ""]]));
    assert.ok(new URL(blocked.headers.get("location")).searchParams.get("error")?.includes("blue fins size 42"), blocked.headers.get("location"));
    assert.ok(["PENDING_CONFIRMATION", "NEEDS_REVIEW"].includes((await prisma.order.findUnique({ where: { id: draft.id } })).status), "still a draft");
    assert.equal((await prisma.order.findUnique({ where: { id: draft.id } })).phoneE164, "+96170123456", "saved with normalized phone");

    const stockBefore = (await prisma.product.findUnique({ where: { id: blackMask.id } })).stock;
    const results = await Promise.all([review(form("confirm")), review(form("confirm")), review(form("confirm"))]);
    const errors = results.filter((r) => r.headers.get("location")?.includes("error=")).length;
    assert.equal(errors, 2, "exactly one confirm wins");
    assert.equal((await prisma.order.findUnique({ where: { id: draft.id } })).status, "PLACED");
    assert.equal((await prisma.product.findUnique({ where: { id: blackMask.id } })).stock, stockBefore - 1, "stock taken once");

    const late = await review(form("reject"));
    assert.ok(late.headers.get("location")?.includes("error="));
    assert.equal((await prisma.order.findUnique({ where: { id: draft.id } })).status, "PLACED", "reject can't cancel a placed order");
    assert.equal((await prisma.product.findUnique({ where: { id: blackMask.id } })).stock, stockBefore - 1);
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

  await step("Meta page: coexistence card shows history progress and an offboarding; never exposes secrets", async () => {
    await post(waField("account_update", { event: "ACCOUNT_OFFBOARDED", disconnection_info: { reason: "PRIMARY_INACTIVITY", initiated_by: "SYSTEM" }, run }));
    await until(() => prisma.metaWebhookEvent.findFirst({ where: { eventType: "account", status: "PROCESSED", receivedAt: { gte: new Date(Date.now() - 60_000) } } }), "account event");
    const res = await authed("/admin/meta");
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("Disconnected") && html.includes("phone app not opened for ~14 days"), "offboarding shown");
    assert.ok(/History import:.*100%/.test(html.replace(/<!-- -->/g, "")), "history progress shown");
    assert.ok(!html.includes(META_APP_SECRET) && !html.includes(META_VERIFY_TOKEN));
  });

  await step("Dashboard reply: stored before sending, kept as failed on Meta error; outside window needs a template", async () => {
    const conv = await prisma.conversation.findFirst({ where: { externalUserId: waId } });
    const reply = (fields) => authed("/api/admin/meta/reply", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields) });
    // No WhatsApp credentials in e2e → Meta call fails → the message stays, marked failed.
    const res = await reply({ conversationId: conv.id, text: `hello from dashboard ${run}` });
    assert.ok(res.headers.get("location")?.includes("error="));
    const kept = await prisma.message.findFirst({ where: { conversationId: conv.id, text: `hello from dashboard ${run}` } });
    assert.ok(kept?.status?.startsWith("failed"), kept?.status);
    assert.equal(kept.sentBy, adminEmail);

    await prisma.conversation.update({ where: { id: conv.id }, data: { lastInboundAt: new Date(Date.now() - 25 * 3600_000) } });
    const closed = await reply({ conversationId: conv.id, text: "late reply" });
    assert.match(new URL(closed.headers.get("location")).searchParams.get("error"), /template/);
    const tpl = await reply({ conversationId: conv.id, template: "hello_world|en_US" });
    assert.match(new URL(tpl.headers.get("location")).searchParams.get("error"), /isn't approved/);
    assert.equal(await prisma.message.count({ where: { conversationId: conv.id, text: "late reply" } }), 0, "blocked sends store nothing");
    await prisma.conversation.update({ where: { id: conv.id }, data: { lastInboundAt: new Date() } });
  });

  await step("Onboarding route: JSON only, validated, and stores nothing when META_APP_ID is missing", async () => {
    const call = (body, type = "application/json") => authed("/api/admin/meta/onboard", { method: "POST", headers: { "content-type": type }, body });
    assert.equal((await call("intent=sync", "application/x-www-form-urlencoded")).status, 415, "cross-site forms can't post here");
    assert.equal((await call(JSON.stringify({ intent: "connect", code: "x", wabaId: "abc" }))).status, 400);
    const res = await call(JSON.stringify({ intent: "connect", code: "a".repeat(40), wabaId: "123456789" }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, false);
    assert.match(body.steps[0].detail, /META_APP_ID/);
    assert.equal(await prisma.metaCredential.count({ where: { key: "whatsapp" } }), 0);
  });

  console.log(`\n${passed} passed`);
} finally {
  await prisma.$disconnect();
}
