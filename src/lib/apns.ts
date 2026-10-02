// APNs "new order" pushes to the admin iOS app — server-only. Mirrors
// telegram.ts: credentials come from env, and the public entry point swallows
// its own errors so a notification failure can never break checkout.
// Uses node:http2 + node:crypto directly (APNs requires HTTP/2, which
// fetch/undici doesn't speak) — no dependencies.
//
// Required env (skip-if-unset): APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY
// (the .p8 file contents; literal "\n" escapes are fine). Optional:
// APNS_TOPIC (defaults to the admin app bundle id), APNS_USE_SANDBOX=1 for
// debug builds installed from Xcode.

import { createPrivateKey, sign } from "node:crypto";
import http2 from "node:http2";

const KEY_ID = process.env.APNS_KEY_ID;
const TEAM_ID = process.env.APNS_TEAM_ID;
const PRIVATE_KEY = process.env.APNS_PRIVATE_KEY;
const TOPIC = process.env.APNS_TOPIC ?? "aquagear.aquagear-admin-ios";
const HOST = process.env.APNS_USE_SANDBOX
  ? "https://api.sandbox.push.apple.com"
  : "https://api.push.apple.com";

/** Pure: provider-authentication JWT (ES256, per Apple's spec). Exported for tests. */
export function makeApnsJwt(privateKeyPem: string, keyId: string, teamId: string): string {
  const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");
  const header = b64(JSON.stringify({ alg: "ES256", kid: keyId }));
  const payload = b64(JSON.stringify({ iss: teamId, iat: Math.floor(Date.now() / 1000) }));
  const key = createPrivateKey(privateKeyPem.replace(/\\n/g, "\n"));
  // JWT ES256 wants the raw r||s signature, not ASN.1 DER.
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), {
    key,
    dsaEncoding: "ieee-p1363",
  });
  return `${header}.${payload}.${b64(signature)}`;
}

/** Pure: the notification JSON, matching the app's local-notification wording. */
export function buildPushPayload(order: {
  id: string;
  name: string | null;
  total: number; // cents
  itemCount: number;
}): string {
  const money = `$${(order.total / 100).toFixed(2)}`;
  const items = `${order.itemCount} item${order.itemCount === 1 ? "" : "s"}`;
  const shortId = order.id.slice(-8).toUpperCase();
  return JSON.stringify({
    aps: {
      alert: {
        title: `New order — ${money}`,
        body: `${order.name ?? "Guest"} · ${items} · #${shortId}`,
      },
      sound: "default",
    },
    orderId: order.id,
  });
}

/** POST one alert to one device. Resolves to the HTTP status (0 on stream error). */
function push(
  client: http2.ClientHttp2Session,
  jwt: string,
  deviceToken: string,
  payload: string,
): Promise<number> {
  return new Promise((resolve) => {
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      "apns-topic": TOPIC,
      "apns-push-type": "alert",
      "apns-priority": "10",
    });
    req.on("response", (headers) => resolve(Number(headers[":status"] ?? 0)));
    req.on("error", () => resolve(0));
    req.end(payload);
  });
}

// ponytail: in-memory dedupe, same rationale as telegram.ts — checkout flips an
// order PENDING→PLACED exactly once before firing this; the Set only guards
// against a double-invoke within one instance.
const pushed = new Set<string>();

/** Push a new-order alert to every admin device. Non-throwing — never affects checkout. */
export async function notifyAdminApps(orderId: string): Promise<void> {
  try {
    if (!KEY_ID || !TEAM_ID || !PRIVATE_KEY) return; // APNs not configured — skip quietly
    if (pushed.has(orderId)) return;
    pushed.add(orderId);

    const { prisma } = await import("@/lib/prisma");
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, name: true, total: true, _count: { select: { items: true } } },
    });
    if (!order) return;

    const admins = await prisma.user.findMany({
      where: { role: "ADMIN", NOT: { pushTokens: { isEmpty: true } } },
      select: { id: true, pushTokens: true },
    });
    if (admins.length === 0) return;

    const payload = buildPushPayload({ ...order, itemCount: order._count.items });
    const jwt = makeApnsJwt(PRIVATE_KEY, KEY_ID, TEAM_ID);
    const client = http2.connect(HOST);
    client.on("error", (err) => console.error("[apns] connection error:", err));

    // 410 Unregistered = the app was deleted; drop the token so we stop sending.
    // (400 can also mean a config mistake, so only 410 prunes.)
    const dead = new Map<string, string[]>();
    for (const admin of admins) {
      for (const token of admin.pushTokens) {
        const status = await push(client, jwt, token, payload);
        if (status === 410) dead.set(admin.id, [...(dead.get(admin.id) ?? []), token]);
        else if (status !== 200) console.error(`[apns] push failed with status ${status}`);
      }
    }
    client.close();

    for (const [userId, tokens] of dead) {
      const current = admins.find((a) => a.id === userId)!.pushTokens;
      await prisma.user.update({
        where: { id: userId },
        data: { pushTokens: current.filter((t) => !tokens.includes(t)) },
      });
    }
  } catch (err) {
    console.error("[apns] notifyAdminApps failed:", err);
  }
}
