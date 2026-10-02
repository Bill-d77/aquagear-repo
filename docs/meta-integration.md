# WhatsApp + Instagram DM orders (Meta integration)

Customer DMs on WhatsApp Business and Instagram arrive through a Meta webhook,
are stored as conversations, and — when a message reads like an order — become
**draft orders** in the normal AquaGear Orders list. An admin reviews and
confirms each draft; confirming uses the same status transition as website
orders, so stock, totals, delivery fee, Telegram alerts and the dashboard all
work the same regardless of where the order came from.

Graph API version: **v26.0** (verified against Meta's changelog on 2026-10-01;
override with `META_GRAPH_API_VERSION`).

Sections: [Architecture](#architecture) · [Data model](#data-model) ·
[Webhooks](#webhooks) · [WhatsApp setup](#whatsapp-setup) ·
[Instagram setup](#instagram-setup) · [Order processing](#order-processing) ·
[Admin workflow](#admin-workflow) · [Security](#security) ·
[Privacy & retention](#privacy--retention) · [Local development](#local-development) ·
[Testing](#testing) · [Troubleshooting](#troubleshooting) · [Limits](#known-limits)

---

## Architecture

```
Meta (WhatsApp Cloud API / Instagram API with Instagram Login)
  │  POST, X-Hub-Signature-256
  ▼
/api/webhooks/meta ── verify HMAC on raw body ── 413/401/400 on bad input
  │  store MetaWebhookEvent (unique sha256(body))  → 200 to Meta
  ▼  after():
processEvent ── normalizeWebhook()  (src/lib/meta/normalize.ts)
  ├─ Conversation upsert (channel + customer id)
  ├─ Message insert (unique Meta message id)
  ├─ delivery/read statuses → Message.status
  └─ refreshDraft()  (per-conversation advisory lock)
        ├─ extractOrder()  (src/lib/meta/extract.ts — pure, deterministic)
        ├─ validate ids/quantities against the catalog
        ├─ create/update Order {status NEEDS_REVIEW | PENDING_CONFIRMATION, source}
        └─ notifyNewOrder() → Telegram (once, on creation)
Admin: /admin/inbox → /admin/orders/[id] review → changeOrderStatus(PLACED)
```

| File | Role |
|---|---|
| `src/app/api/webhooks/meta/route.ts` | GET verification, POST ingestion |
| `src/lib/meta/signature.ts` | HMAC + constant-time compares |
| `src/lib/meta/normalize.ts` | Meta payloads → `NormalizedMessage` / `StatusUpdate` |
| `src/lib/meta/extract.ts` | Intent detection, product matching, contact/delivery extraction |
| `src/lib/meta/ingest.ts` | Persistence, idempotency, retries, draft creation |
| `src/lib/meta/client.ts` | All Graph API calls (send, profile, media, health, token refresh) |
| `src/lib/meta/config.ts` | Env config, masking |
| `src/app/api/cron/meta/route.ts` | Daily: retries, pruning, Instagram token refresh |
| `src/app/api/admin/meta/*` | Reply, conversation actions, event retry, media proxy |
| `src/app/api/admin/orders/review/route.ts` | Edit / confirm / reject drafts |
| `src/app/admin/inbox`, `src/app/admin/meta` | Inbox, thread, connection + webhook log |

WhatsApp and Instagram share everything after `normalizeWebhook()`; adding
Messenger means adding one normalizer branch and one `sendText` branch.

## Data model

Migration `prisma/migrations/20261001100000_meta_inbox` (additive; existing rows
stay valid — every existing order gets `source = 'WEBSITE'`).

- **Order** (extended): `source` (`WEBSITE` | `APP` | `WHATSAPP` | `INSTAGRAM`),
  `conversationId` → Conversation (SET NULL on delete), `extraction` (JSON
  snapshot of what the extractor saw), `audits`.
- **OrderAudit**: append-only `actor`, `action`, `detail`, `createdAt`.
- **Conversation**: one per `(channel, externalUserId)` — WhatsApp `wa_id` or the
  Instagram-scoped user id (IGSID; usernames can change, so they're display only).
  Holds name/username/phone, `status`, `unreadCount`, `lastMessageAt`,
  `lastInboundAt`, `lastReadAt`, latest `extraction`. A conversation can have many orders.
- **Message**: `externalMessageId` **unique**, direction, type
  (`TEXT IMAGE VIDEO AUDIO DOCUMENT LOCATION INTERACTIVE REACTION UNKNOWN`),
  text, metadata (media ids/urls, coordinates — never media bytes), delivery status, `sentBy`.
- **MetaWebhookEvent**: raw payload, `eventKey` **unique** (sha256 of body),
  status (`RECEIVED PROCESSING PROCESSED IGNORED FAILED`), `retryCount`, `nextRetryAt`, `error`.
- **MetaCredential**: the refreshed Instagram token, AES-256-GCM encrypted with a key derived from `AUTH_SECRET`.
- **Product.aliases**: phrases customers use ("black mask") — editable on the product form.

There is no separate customer table: AquaGear orders already carry the
customer's name/phone/address, and the Conversation is the channel identity.
Identities are never merged automatically (not by name, not by phone).

Order statuses: drafts are `NEEDS_REVIEW` (something missing/uncertain) or
`PENDING_CONFIRMATION` (all products matched, phone and location present).
Neither holds stock. Confirming → `PLACED` (stock decremented) → `SHIPPED`;
rejecting → `CANCELED`. Drafts can't be moved through the generic status
dropdown or the mobile admin API — only through review.

## Webhooks

Callback URL: `https://YOUR-AQUAGEAR-DOMAIN/api/webhooks/meta` (the exact URL for
the current deployment is shown on **Admin → Meta**).

- **GET**: returns `hub.challenge` only when `hub.mode=subscribe` and
  `hub.verify_token` equals `META_VERIFY_TOKEN` (constant-time compare); else 403.
- **POST**: rejects bodies > 1 MB (413), bad/missing `X-Hub-Signature-256` (401),
  malformed JSON (400). With no app secret configured it returns 503 — unsigned
  deliveries are never accepted, including in development.
- Valid deliveries are stored, acknowledged with 200, then processed in `after()`.
  Unsupported events (other objects/fields) are stored as `IGNORED` with a reason.
- Idempotency: identical redeliveries dedupe on `eventKey`; the same message in a
  different delivery dedupes on `Message.externalMessageId`; draft creation is
  serialized per conversation with `pg_advisory_xact_lock`, and the Telegram alert
  fires only from the transaction that created the draft.
- Failures: the event is marked `FAILED` with backoff (1, 2, 4, 8, 16, 32 min).
  Retries run opportunistically after each webhook and in the daily cron; after 6
  attempts it waits for **Retry now** on Admin → Meta.

## WhatsApp setup

Requires a Meta Business portfolio and a phone number not registered in the
regular WhatsApp app.

1. developers.facebook.com → **Create app** (type *Business*) → add **WhatsApp**.
2. WhatsApp → **API Setup**: add/verify the business phone number. Copy the
   **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
3. Token: Business Settings → **System users** → add a system user, assign the app
   and the WhatsApp Business Account, generate a token with
   `whatsapp_business_messaging` and `whatsapp_business_management`
   → `WHATSAPP_ACCESS_TOKEN`. (The temporary token on API Setup expires in 24 h — test only.)
4. App settings → Basic → **App secret** → `META_APP_SECRET`.
5. WhatsApp → **Configuration** → Webhook: callback URL above, verify token =
   `META_VERIFY_TOKEN` → Verify and save. Subscribe to the **messages** field
   (it carries both incoming messages and delivery/read statuses).
6. Business verification and the app being **Live** are needed for production
   messaging limits; check App Review for `whatsapp_business_messaging` if the
   dashboard asks for Advanced Access.

The WhatsApp Business Account ID isn't needed by the code.

**Ads-only.** WhatsApp chats are accepted only when they start from a
Click-to-WhatsApp ad: the first message's `referral` (ad id, headline,
`ctwa_clid`) is stored in that message's `metadata.ad`, and later messages in
the same chat flow normally. Messages from a chat not opened from an ad are
dropped and their webhook payload is wiped (event shows as IGNORED). To accept
every chat, delete the `fromAd` line in `upsertConversation` (`src/lib/meta/ingest.ts`).
Instagram is unaffected.

## Instagram setup

Uses the **Instagram API with Instagram Login** (no Facebook Page required).
Only **professional** accounts (Business or Creator) can be connected — personal
accounts must first switch to professional in the Instagram app.

1. In the same Meta app, add **Instagram** → *API setup with Instagram login*.
2. Copy the **Instagram app secret** → `INSTAGRAM_APP_SECRET` (Instagram
   webhooks are signed with this secret, not the Meta app secret).
3. Add the AquaGear Instagram account (Roles → Instagram testers, then accept in
   the Instagram app), then **Generate token** → long-lived (60-day) token
   → `INSTAGRAM_ACCESS_TOKEN`. The daily cron refreshes it automatically
   (stored encrypted in `MetaCredential`); replacing the env var later takes precedence.
4. Optional: the account's Instagram user ID → `INSTAGRAM_ACCOUNT_ID` (defaults to `me`).
5. Webhooks (Instagram product → Configure webhooks): same callback URL and verify
   token; subscribe to **messages**, **messaging_seen**, **messaging_postbacks**.
   Then enable delivery for the account:
   `POST https://graph.instagram.com/v26.0/me/subscribed_apps?subscribed_fields=messages,messaging_seen,messaging_postbacks`
   with the Instagram token.
6. In the Instagram app: Settings → Messages and story replies → Message controls →
   Connected tools → **Allow access to messages** must be on.
7. Permissions: `instagram_business_basic`, `instagram_business_manage_messages`.
   Standard Access covers accounts you own or manage; Advanced Access (App Review)
   is only needed to serve accounts you don't own. Meta generally delivers
   webhooks for real (non-role) users only once the app is **Live**.

Replies from the Instagram app arrive as echo events and appear in the thread as AquaGear messages.

## Order processing

`extractOrder()` reads the conversation's messages since the last non-draft order
(max 40 messages / 7 days) and returns structured JSON:
`isOrder, intent, confidence, score, items[{customerText, quantity, productId, candidates, confidence, variant}], name, phone, location, addressDetails, pin, missingFields`.

- **Intent** is judged per sentence. Inquiries ("how much", "do you have",
  "pictures", "where is my order", "how do I order") and hedges ("maybe", "I'll
  let you know") never count. Order phrases: "I want/need/would like", "send me",
  "I'll take", "order/buy", Arabizi "badde/baddi", Arabic "بدي/اريد".
- **Product matching** order: SKU (`mpn`) → admin aliases → token overlap with the
  product name (brand words ignored, plurals folded). Colours/sizes ("black",
  "pro") can't identify a product alone, but can narrow an earlier ambiguous
  mention ("2 diving masks" … "the black Pro ones"). If two products explain the
  text equally well, the item is left unresolved with candidates — never guessed.
- **Contact/delivery**: Lebanese phone formats (normalized to +961…), "deliver to
  X", a short reply to "where should we deliver?", a small Lebanese place list,
  building/floor/street fragments, WhatsApp location pins. Nothing is invented.
- **Confidence**: `NONE` (no intent → no order) · `LOW` (intent, no product →
  conversation marked *Potential order*, no draft) · `MEDIUM` (draft, `NEEDS_REVIEW`)
  · `HIGH` (all items matched + phone + location → `PENDING_CONFIRMATION`).
- The extractor never writes; `refreshDraft()` validates product ids and
  quantities against the catalog and prices items at the catalog price. The
  total uses the shared `deliveryFeeFor()` + `StoreSettings.shippingFlatRate`.
- A draft keeps updating as the customer adds details, until an admin edits it;
  after that the admin's version wins (new detections still show on the thread).

## Admin workflow

- **Inbox** (`/admin/inbox`): filter by channel/unread, search name, @username,
  phone or message text. Opening a thread marks it read. Replies are sent through
  the API inside Meta's 24-hour customer-service window (outside it Meta only
  allows pre-approved templates — not implemented). Nothing is ever sent automatically.
- **Thread**: messages, media (via an admin-only proxy), the detected order,
  *Re-run detection*, *Create draft manually*, linked orders.
- **Orders**: source badges and filter, draft statuses in the status filter,
  *Review* for drafts. The review form edits customer, phone, address, items
  (pick candidates, add/remove), unit prices (with a logged reason), notes —
  then **Confirm** (→ PLACED, stock reserved, conversation → *Order confirmed*)
  or **Reject**. Every change is in the order's **History**.
- **Products**: *DM aliases* field.
- **Dashboard**: drafts to review, unread conversations, orders/revenue by source,
  DM conversation → order conversion (30 days).
- **Meta** (`/admin/meta`): connection status with masked tokens, *Test
  connections* (friendly error + technical details), webhook health, event log
  with status filter, raw payloads, *Retry now*.
- The iOS admin app doesn't show drafts (its decoder doesn't know the new statuses);
  confirmed WhatsApp/Instagram orders appear there like any other order.

## Security

- Webhook authenticated only by Meta's HMAC (raw body, constant-time) and verify
  token; admin routes only by the NextAuth admin session (`requireAdminApi` /
  admin layout). The two never mix.
- Tokens/secrets live in env (and the encrypted `MetaCredential` row), are never
  logged, never sent to the browser; the Meta page shows `••••••••abcd` masks.
  Note: Meta sends the *verify token* in the GET query string, so platform request
  logs (Vercel, `next dev`) show it — use a random value used for nothing else.
- Customer text is rendered as React text nodes (escaped); no `dangerouslySetInnerHTML`.
- Media proxy: admin-only, Instagram URLs restricted to Meta CDN hosts (no SSRF),
  only JPEG/PNG/GIF/WebP/audio/video render inline; everything else downloads as
  `application/octet-stream` under `Content-Security-Policy: sandbox`.
- All admin inputs are zod-validated; submitted product ids are re-checked against the DB.
- RBAC: AquaGear has a single `ADMIN` role, so every admin can use the inbox,
  review drafts and see the Meta page. Finer permissions need a role model first.

## Privacy & retention

For the business owner to review — not a legal compliance statement.

| Data | Why | Where | Who | Kept |
|---|---|---|---|---|
| Messages (text, media references, locations) | Order handling, history | Postgres `Message` | Admins | Indefinitely (business record); delete conversation to remove |
| Raw webhook payloads | Debugging delivery problems | `MetaWebhookEvent` | Admins (Meta page) | `META_EVENT_RETENTION_DAYS` (30) for processed/ignored, 3× for failed |
| Media files | Viewing attachments | Not stored — fetched from Meta on demand | Admins | Meta's retention (WhatsApp media URLs expire) |
| Name, phone, address on orders | Delivery | `Order` | Admins | Like all orders |
| Audit log | Accountability | `OrderAudit` | Admins | With the order |

Meta processes these messages under its own terms; AquaGear only receives what
customers send to the business accounts.

## Local development

Meta must reach the webhook over HTTPS:

```bash
npm run dev                                   # port 3000
cloudflared tunnel --url http://localhost:3000  # or: ngrok http 3000
```

Use the tunnel URL + `/api/webhooks/meta` as the callback in a **development**
Meta app with test credentials — never production tokens. Signature checks stay
on; set `META_APP_SECRET` / `INSTAGRAM_APP_SECRET` locally. Don't commit tunnel credentials.

## Testing

```bash
npm test                    # unit: signature, normalizers (fixtures), extractor, Telegram
npm run test:meta-e2e       # e2e against a running app + LOCAL Postgres (see script header)
```

Fixtures (synthetic data only): `src/lib/meta/fixtures/`. The e2e script refuses
non-localhost databases and covers verification, bad signatures, oversize/malformed
bodies, ignored events, duplicate deliveries, WhatsApp + Instagram drafts, echoes,
XSS rendering, unauthenticated/non-admin access, review → PLACED with stock and
audit, status-route bypass, cron retry, website cart regression, secret exposure.

## Troubleshooting

| Symptom | Check |
|---|---|
| Webhook verification failed | `META_VERIFY_TOKEN` in Vercel equals the dashboard value; redeploy after changing env; URL ends in `/api/webhooks/meta` |
| No events at all | Admin → Meta "Waiting for the first delivery"; field subscriptions (WhatsApp `messages`; Instagram `messages` + `/me/subscribed_apps`); app Live; HTTPS reachable |
| 401 in Vercel logs | Wrong secret: WhatsApp → `META_APP_SECRET`, Instagram → `INSTAGRAM_APP_SECRET` |
| Instagram messages missing | Professional account; *Allow access to messages* on; account added/accepted as tester in dev mode; `subscribed_apps` call done |
| WhatsApp messages missing | Number registered to Cloud API (not the phone app); system-user token has the WABA assigned |
| "Access token expired or invalid" | Regenerate; for Instagram check the cron runs (Vercel → Cron Jobs) so the 60-day token refreshes |
| "Missing permission" | Token scopes listed above; Advanced Access/App Review if serving non-owned accounts |
| Reply refused (24 h) | Customer must message first; templates aren't implemented |
| "Rate limited" | Client retries with backoff; wait and retry |
| Duplicate messages/orders | Shouldn't happen (unique keys + lock); check Admin → Meta for FAILED events and the order History |
| Product not recognized | Add DM aliases or an MPN to the product; ambiguous names land in review with candidates |
| Wrong customer details | Edit in review; the extractor never overwrites an admin-edited draft |
| Extraction wrong | Re-run detection after fixing aliases; or create the draft manually |
| FAILED events | Error column on Admin → Meta; fix cause; *Retry now* |

## Known limits

- Rule-based extraction (no LLM): unusual phrasing ends up as MEDIUM/LOW for an
  admin. `extractOrder()` is the swap point for an LLM returning the same shape.
- No outbound templates or automatic status messages (no approved templates yet).
- No product variants in the catalog: sizes go into order notes.
- Polling refresh (10–20 s) instead of realtime.
- Retries are opportunistic + a daily cron (Vercel Hobby allows daily crons only).
