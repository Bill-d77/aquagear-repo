// Run with: node --test src/lib/apns.test.ts   (Node >=23 strips TS types)
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { makeApnsJwt, buildPushPayload } from "./apns.ts";

test("APNs JWT is ES256-signed and verifiable", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  const jwt = makeApnsJwt(pem, "KEY123", "TEAM456");
  const [h, p, s] = jwt.split(".");

  const header = JSON.parse(Buffer.from(h, "base64url").toString());
  assert.equal(header.alg, "ES256");
  assert.equal(header.kid, "KEY123");

  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  assert.equal(payload.iss, "TEAM456");
  assert.ok(Math.abs(payload.iat - Date.now() / 1000) < 60, "iat is current");

  const ok = verify(
    "sha256",
    Buffer.from(`${h}.${p}`),
    { key: publicKey, dsaEncoding: "ieee-p1363" },
    Buffer.from(s, "base64url"),
  );
  assert.ok(ok, "signature verifies with the public key");
});

test("push payload matches the app's notification wording", () => {
  const raw = buildPushPayload({ id: "clx123456789abcd", name: "Jad", total: 4500, itemCount: 2 });
  const p = JSON.parse(raw);
  assert.equal(p.aps.alert.title, "New order — $45.00");
  assert.equal(p.aps.alert.body, "Jad · 2 items · #6789ABCD");
  assert.equal(p.aps.sound, "default");
  assert.equal(p.orderId, "clx123456789abcd");

  const guest = JSON.parse(buildPushPayload({ id: "x", name: null, total: 100, itemCount: 1 }));
  assert.equal(guest.aps.alert.body, "Guest · 1 item · #X");
});
