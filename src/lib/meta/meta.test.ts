// Run with: node --test src/lib/meta/meta.test.ts   (Node >=22.18 strips TS types)
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import { verifyMetaSignature, safeEqual } from "./signature.ts";
import { normalizeWebhook } from "./normalize.ts";
import { extractOrder, normalizePhone, type CatalogProduct, type ChatLine } from "./extract.ts";

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const sign = (body: string, secret: string) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
const chat = (...lines: [("C" | "A"), string][]): ChatLine[] =>
  lines.map(([who, text]) => ({ direction: who === "C" ? "INBOUND" : "OUTBOUND", text }));
const p = (id: string, name: string, extra: Partial<CatalogProduct> = {}): CatalogProduct => ({
  id, name, price: 2500, stock: 10, aliases: [], ...extra,
});

// ── Signature ───────────────────────────────────────────────────────────────

test("signature: valid, wrong secret, tampered, malformed, multi-secret", () => {
  const body = fixture("whatsapp-message.json");
  assert.equal(verifyMetaSignature(body, sign(body, "s3cret"), ["s3cret"]), true);
  assert.equal(verifyMetaSignature(body, sign(body, "other"), ["s3cret"]), false);
  assert.equal(verifyMetaSignature(body + " ", sign(body, "s3cret"), ["s3cret"]), false);
  assert.equal(verifyMetaSignature(body, null, ["s3cret"]), false);
  assert.equal(verifyMetaSignature(body, "sha256=zz", ["s3cret"]), false);
  assert.equal(verifyMetaSignature(body, "sha1=abc", ["s3cret"]), false);
  assert.equal(verifyMetaSignature(body, sign(body, "ig-secret"), ["meta-secret", "ig-secret"]), true);
  assert.equal(verifyMetaSignature(body, sign(body, "x"), []), false);
  assert.equal(safeEqual("token", "token"), true);
  assert.equal(safeEqual("token", "token2"), false);
});

// ── Normalization ───────────────────────────────────────────────────────────

test("whatsapp: text, image, location, reaction, interactive", () => {
  const ev = normalizeWebhook(JSON.parse(fixture("whatsapp-message.json")));
  assert.equal(ev.channel, "WHATSAPP");
  assert.equal(ev.eventType, "message");
  assert.deepEqual(ev.messages.map((m) => m.type), ["TEXT", "IMAGE", "LOCATION", "REACTION", "INTERACTIVE"]);
  const [text, image, loc, , btn] = ev.messages;
  assert.equal(text.customerId, "96170111222");
  assert.equal(text.customerPhone, "+96170111222");
  assert.equal(text.customerName, "Test Diver");
  assert.equal(text.text, "I need 2 diving masks.");
  assert.equal(text.direction, "INBOUND");
  assert.equal(text.timestamp.toISOString(), new Date(1790000000 * 1000).toISOString());
  assert.equal(image.metadata?.mediaId, "media-1");
  assert.equal(image.text, "this one");
  assert.deepEqual(loc.metadata, { latitude: 34.4367, longitude: 35.8497 });
  assert.equal(btn.text, "Yes");
});

test("whatsapp: Click-to-WhatsApp ad referral → fromAd + ad metadata; plain chat is not fromAd", () => {
  const wa = (extra: object) =>
    normalizeWebhook({
      object: "whatsapp_business_account",
      entry: [{ changes: [{ field: "messages", value: { messages: [
        { from: "96170111222", id: "wamid.AD", timestamp: "1790000000", type: "text", text: { body: "I want 2 masks" }, ...extra },
      ] } }] }],
    }).messages[0];

  const fromAd = wa({
    referral: { source_url: "https://fb.me/x", source_id: "120200000000", source_type: "ad", headline: "Diving masks", ctwa_clid: "clid-1" },
  });
  assert.equal(fromAd.fromAd, true);
  assert.equal(fromAd.text, "I want 2 masks");
  assert.deepEqual(fromAd.metadata?.ad, {
    sourceType: "ad", adId: "120200000000", url: "https://fb.me/x", headline: "Diving masks", ctwaClid: "clid-1",
  });

  const plain = wa({});
  assert.equal(plain.fromAd, undefined);
  assert.equal(plain.metadata, null);
});

test("whatsapp: delivery statuses incl. failure reason", () => {
  const ev = normalizeWebhook(JSON.parse(fixture("whatsapp-status.json")));
  assert.equal(ev.eventType, "status");
  assert.equal(ev.messages.length, 0);
  assert.deepEqual(ev.statuses, [
    { externalMessageId: "wamid.OUT_1", status: "delivered" },
    { externalMessageId: "wamid.OUT_2", status: "failed", error: "Re-engagement message" },
  ]);
});

test("instagram: DM, echo (business reply), attachment, read receipt", () => {
  const ev = normalizeWebhook(JSON.parse(fixture("instagram-message.json")));
  assert.equal(ev.channel, "INSTAGRAM");
  assert.equal(ev.eventType, "message+echo+status");
  const [dm, echo, img] = ev.messages;
  assert.equal(dm.customerId, "990000000000001");
  assert.equal(dm.direction, "INBOUND");
  assert.equal(echo.direction, "OUTBOUND");
  assert.equal(echo.customerId, "990000000000001", "echo is filed under the customer, not the business");
  assert.equal(img.type, "IMAGE");
  assert.deepEqual(ev.statuses, [{ externalMessageId: "aWdfZAG1TEST_IG_2", status: "read" }]);
});

test("unsupported / malformed payloads are ignored, never thrown", () => {
  const ev = normalizeWebhook(JSON.parse(fixture("invalid-event.json")));
  assert.equal(ev.channel, "UNKNOWN");
  assert.equal(ev.messages.length, 0);
  assert.equal(normalizeWebhook(null).eventType, "invalid");
  assert.equal(normalizeWebhook({ object: "instagram" }).eventType, "invalid");
  assert.equal(normalizeWebhook({ object: "instagram", entry: [{ id: "1", messaging: [{ sender: {} }] }] }).messages.length, 0);
  assert.equal(normalizeWebhook({ object: "whatsapp_business_account", entry: [{ changes: [{ field: "messages", value: { messages: [{ type: "text" }] } }] }] }).messages.length, 0);
});

test("message text is stored verbatim (HTML is escaped at render, not here) and clipped", () => {
  const xss = '<script>alert("x")</script>';
  const ev = normalizeWebhook({
    object: "instagram",
    entry: [{ id: "B", messaging: [{ sender: { id: "C" }, recipient: { id: "B" }, timestamp: 1, message: { mid: "m1", text: xss + "a".repeat(5000) } }] }],
  });
  assert.ok(ev.messages[0].text!.startsWith(xss));
  assert.equal(ev.messages[0].text!.length, 4096);
});

// ── Product matching ────────────────────────────────────────────────────────

const catalog = [
  p("mask-pro-blk", "AquaGear Pro Diving Mask - Black", { mpn: "MASK-BLK-001" }),
  p("mask-sport-blu", "AquaGear Sport Diving Mask - Blue"),
  p("fins", "Diving Fins"),
  p("snorkel", "Dry Snorkel", { aliases: ["breathing tube"] }),
  p("vest", "Life Jacket"),
];

test("matching: exact, SKU, alias, fuzzy (plural), unknown", () => {
  const exact = extractOrder(chat(["C", "I want one Life Jacket"]), catalog);
  assert.equal(exact.items[0].productId, "vest");

  const sku = extractOrder(chat(["C", "I want 2 of MASK-BLK-001"]), catalog);
  assert.equal(sku.items[0].productId, "mask-pro-blk");
  assert.equal(sku.items[0].matchedBy, "sku");
  assert.equal(sku.items[0].quantity, 2);

  const alias = extractOrder(chat(["C", "send me a breathing tube please"]), catalog);
  assert.equal(alias.items[0].productId, "snorkel");
  assert.equal(alias.items[0].matchedBy, "alias");

  const fuzzy = extractOrder(chat(["C", "I need fins"]), catalog);
  assert.equal(fuzzy.items[0].productId, "fins");

  const unknown = extractOrder(chat(["C", "I want a surfboard"]), catalog);
  assert.equal(unknown.items.length, 0);
  assert.equal(unknown.confidence, "LOW", "intent without a known product stays a potential order");
});

test("matching: ambiguous product → candidates, never a silent pick (spec §89)", () => {
  const masks = [p("m1", "Black Mask"), p("m2", "Black Pro Mask"), p("m3", "Black Sport Mask")];
  const ex = extractOrder(chat(["C", "I want the black mask."]), masks);
  assert.equal(ex.isOrder, true);
  assert.equal(ex.items[0].productId, null);
  assert.deepEqual(ex.items[0].candidates.map((c) => c.productId).sort(), ["m1", "m2", "m3"]);
  assert.equal(ex.confidence, "MEDIUM");
  assert.ok(ex.missingFields.includes("product_selection"));
});

test("matching: best match wins when it only lacks an unstated colour", () => {
  const ex = extractOrder(chat(["C", "How much is the Pro diving mask? I want 2"]), catalog);
  assert.equal(ex.items[0].productId, "mask-pro-blk");
  assert.equal(ex.items[0].quantity, 2);
});

test("matching: color alone never identifies a product", () => {
  const ex = extractOrder(chat(["C", "I want the black one"]), catalog);
  assert.equal(ex.items.length, 0);
});

// ── Order detection (spec §86: no false orders) ─────────────────────────────

test("non-orders: inquiries, availability, pictures, hedges, chit-chat", () => {
  for (const msg of [
    "How much is the diving mask?",
    "Do you have the black diving mask?",
    "Can you send me pictures of the fins?",
    "Maybe I'll take one.",
    "I'll let you know.",
    "How much is this?",
    "Hi, good morning!",
    "Where is my order?",
    "How do I order?",
  ]) {
    const ex = extractOrder(chat(["C", msg]), catalog);
    assert.equal(ex.isOrder, false, msg);
    assert.equal(ex.confidence, "NONE", msg);
  }
});

test("intent: 'I want two black diving masks' → draft-worthy, quantity parsed", () => {
  const ex = extractOrder(chat(["C", "I want two black Pro diving masks."]), catalog);
  assert.equal(ex.isOrder, true);
  assert.equal(ex.items[0].productId, "mask-pro-blk");
  assert.equal(ex.items[0].quantity, 2);
  assert.equal(ex.confidence, "MEDIUM", "no phone yet → needs review");
});

test("multiple products + size + delivery in one message", () => {
  const ex = extractOrder(
    chat(["C", "I want 2 black pro diving masks and one pair of fins size 42. Deliver to Tripoli."]),
    catalog,
  );
  assert.deepEqual(
    ex.items.map((i) => [i.productId, i.quantity, i.variant]),
    [["mask-pro-blk", 2, null], ["fins", 1, "size 42"]],
  );
  assert.equal(ex.location, "Tripoli");
  assert.ok(ex.missingFields.includes("phone"));
});

test("spec §87 WhatsApp example: context narrows product, phone + area captured", () => {
  const ex = extractOrder(
    chat(
      ["C", "Hi"],
      ["A", "Hello! How can we help?"],
      ["C", "I need 2 diving masks."],
      ["A", "Which model?"],
      ["C", "The black Pro ones."],
      ["A", "Sure. Where should we deliver?"],
      ["C", "Tripoli Mina. My number is 03 123456."],
      ["C", "Yes, I want them."],
    ),
    catalog,
  );
  assert.equal(ex.items.length, 1);
  assert.equal(ex.items[0].productId, "mask-pro-blk");
  assert.equal(ex.items[0].quantity, 2);
  assert.equal(ex.location, "Tripoli Mina");
  assert.equal(ex.phone, "+9613123456");
  assert.equal(ex.customerConfirmed, true);
  assert.equal(ex.confidence, "HIGH");
});

test("spec §88 Instagram example: quantity from 'send me one', no invented phone", () => {
  const ex = extractOrder(
    chat(
      ["C", "Hi, how much is the black mask?"],
      ["A", "$25"],
      ["C", "Can you deliver to Jounieh?"],
      ["A", "Yes."],
      ["C", "Okay send me one."],
    ),
    [p("bm", "Black Mask"), p("fins", "Diving Fins")],
  );
  assert.equal(ex.isOrder, true);
  assert.deepEqual(ex.items.map((i) => [i.productId, i.quantity]), [["bm", 1]]);
  assert.equal(ex.location, "Jounieh");
  assert.equal(ex.phone, null);
  assert.equal(ex.confidence, "MEDIUM");
  assert.ok(ex.missingFields.includes("phone"));
});

test("missing address is reported, location pin is captured", () => {
  const ex = extractOrder(
    [
      { direction: "INBOUND", text: "I want the life jacket" },
      { direction: "INBOUND", text: "Mina Port", location: { latitude: 34.43, longitude: 35.84 } },
    ],
    catalog,
  );
  assert.equal(ex.pin, "https://maps.google.com/?q=34.43,35.84");
  assert.equal(ex.location, "Mina");
});

test("Arabizi intent + building details", () => {
  const ex = extractOrder(chat(["C", "badde 3 life jackets, building Nour 2nd floor, Jounieh. 71 234 567"]), catalog);
  assert.equal(ex.items[0].quantity, 3);
  assert.equal(ex.phone, "+96171234567");
  assert.match(ex.addressDetails ?? "", /building Nour 2nd floor/);
});

test("phone normalization", () => {
  assert.equal(normalizePhone("03 123 456"), "+9613123456");
  assert.equal(normalizePhone("70123456"), "+96170123456");
  assert.equal(normalizePhone("+961 70 123 456"), "+96170123456");
  assert.equal(normalizePhone("00961 3 123456"), "+9613123456");
});
