// Converts raw Meta webhook payloads (WhatsApp Cloud API + Instagram API with
// Instagram Login) into one internal shape. Pure and dependency-free so the
// rest of the app never touches Meta's payload structure, and so it's testable
// against fixtures (see meta.test.ts).

export type Channel = "WHATSAPP" | "INSTAGRAM";
export type MessageType =
  | "TEXT" | "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "LOCATION" | "INTERACTIVE" | "REACTION" | "UNKNOWN";

export interface NormalizedMessage {
  channel: Channel;
  externalMessageId: string;
  /** The customer's id on the channel (wa_id / IGSID) — never the business's. */
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  /** WhatsApp business-scoped user id — sent even when Meta withholds the phone. */
  bsuid?: string;
  direction: "INBOUND" | "OUTBOUND";
  /** Coexistence history import: stored for context, never acted on. */
  historical?: boolean;
  type: MessageType;
  text: string | null;
  metadata: Record<string, unknown> | null;
  timestamp: Date;
}

export interface StatusUpdate {
  externalMessageId: string;
  status: string; // sent | delivered | read | failed
  error?: string;
}

/** A contact from the business's WhatsApp Business app (smb_app_state_sync). */
export interface ContactSync {
  waId: string;
  name: string;
}

/** account_update, e.g. ACCOUNT_OFFBOARDED with reason PRIMARY_INACTIVITY. */
export interface AccountEvent {
  event: string;
  reason?: string;
}

export interface NormalizedEvent {
  channel: Channel | "UNKNOWN";
  eventType: string;
  messages: NormalizedMessage[];
  statuses: StatusUpdate[];
  contacts: ContactSync[];
  account: AccountEvent[];
  /** Human-readable notes about parts of the payload that were skipped. */
  ignored: string[];
}

type Obj = Record<string, any>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" && v.length > 0 ? v : undefined);
const MAX_TEXT = 4096;
const clip = (s: string | undefined) => (s ? s.slice(0, MAX_TEXT) : null);

export function normalizeWebhook(payload: unknown): NormalizedEvent {
  if (!isObj(payload) || !Array.isArray(payload.entry)) {
    return { channel: "UNKNOWN", eventType: "invalid", messages: [], statuses: [], contacts: [], account: [], ignored: ["malformed payload"] };
  }
  if (payload.object === "whatsapp_business_account") return normalizeWhatsApp(payload.entry);
  if (payload.object === "instagram") return normalizeInstagram(payload.entry);
  return {
    channel: "UNKNOWN",
    eventType: String(payload.object ?? "unknown").slice(0, 50),
    messages: [],
    statuses: [],
    contacts: [],
    account: [],
    ignored: [`unsupported object "${String(payload.object).slice(0, 50)}"`],
  };
}

function summarize(ev: Omit<NormalizedEvent, "eventType">): NormalizedEvent {
  const kinds = new Set<string>();
  for (const m of ev.messages) kinds.add(m.historical ? "history" : m.direction === "OUTBOUND" ? "echo" : "message");
  if (ev.statuses.length) kinds.add("status");
  if (ev.contacts.length) kinds.add("contacts");
  if (ev.account.length) kinds.add("account");
  return { ...ev, eventType: kinds.size ? [...kinds].join("+") : "ignored" };
}

// ── WhatsApp ────────────────────────────────────────────────────────────────

// Coexistence (WhatsApp Business app + Cloud API on one number) adds three
// fields next to `messages`: smb_message_echoes (sent from the phone app),
// history (one-time import of past chats) and smb_app_state_sync (contacts).
// Payload shapes: developers.facebook.com/documentation/business-messaging/
// whatsapp/embedded-signup/onboarding-business-app-users (checked 2026-10-05).
function normalizeWhatsApp(entries: unknown[]): NormalizedEvent {
  const messages: NormalizedMessage[] = [];
  const statuses: StatusUpdate[] = [];
  const contacts: ContactSync[] = [];
  const account: AccountEvent[] = [];
  const ignored: string[] = [];

  for (const entry of entries) {
    if (!isObj(entry) || !Array.isArray(entry.changes)) continue;
    for (const change of entry.changes) {
      if (!isObj(change) || !isObj(change.value)) continue;
      const value = change.value;
      const list = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : []);

      switch (change.field) {
        case "messages": {
          // Profile names keyed by phone (wa_id) and by BSUID (user_id); the
          // phone is omitted for some username users, the BSUID never is.
          const names = new Map<string, string>();
          const bsuids = new Map<string, string>();
          for (const c of list(value.contacts)) {
            const name = str(c.profile?.name);
            if (name) for (const k of [str(c.wa_id), str(c.user_id)]) if (k) names.set(k, name);
            if (str(c.wa_id) && str(c.user_id)) bsuids.set(c.wa_id, c.user_id);
          }
          for (const m of list(value.messages)) {
            const phone = str(m.from);
            const bsuid = str(m.from_user_id) ?? (phone ? bsuids.get(phone) : undefined);
            const customerId = phone ?? bsuid;
            if (!str(m.id) || !customerId) {
              ignored.push("whatsapp message without id/from");
              continue;
            }
            messages.push({
              channel: "WHATSAPP",
              externalMessageId: m.id,
              customerId,
              customerName: names.get(customerId),
              ...(phone ? { customerPhone: `+${phone}` } : {}),
              ...(bsuid ? { bsuid } : {}),
              direction: "INBOUND",
              ...whatsAppContent(m),
              timestamp: fromSeconds(m.timestamp),
            });
          }
          for (const s of list(value.statuses)) {
            if (!str(s.id) || !str(s.status)) continue;
            const err = Array.isArray(s.errors) && isObj(s.errors[0]) ? s.errors[0] : null;
            statuses.push({
              externalMessageId: s.id,
              status: s.status,
              ...(err ? { error: String(err.title ?? err.message ?? err.code).slice(0, 200) } : {}),
            });
          }
          break;
        }

        case "smb_message_echoes":
          // Staff replied from the phone app: business → customer (`to`).
          for (const m of list(value.message_echoes)) {
            if (!str(m.id) || !str(m.to)) {
              ignored.push("whatsapp echo without id/to");
              continue;
            }
            messages.push({
              channel: "WHATSAPP",
              externalMessageId: m.id,
              customerId: m.to,
              customerPhone: `+${m.to}`,
              direction: "OUTBOUND",
              ...whatsAppContent(m),
              timestamp: fromSeconds(m.timestamp),
            });
          }
          break;

        case "history": {
          for (const h of list(value.history)) {
            const err = list(h.errors)[0];
            if (err) {
              // 2593109 = the business declined history sharing during signup.
              ignored.push(`history: ${String(err.code ?? "")} ${String(err.title ?? err.message ?? "").slice(0, 150)}`.trim());
              continue;
            }
            for (const thread of list(h.threads)) {
              const customer = str(thread.id);
              if (!customer) continue;
              for (const m of list(thread.messages)) {
                if (!str(m.id)) continue;
                messages.push({
                  channel: "WHATSAPP",
                  externalMessageId: m.id,
                  customerId: customer,
                  customerPhone: `+${customer}`,
                  direction: m.from === customer ? "INBOUND" : "OUTBOUND",
                  historical: true,
                  ...whatsAppContent(m),
                  timestamp: fromSeconds(m.timestamp),
                });
              }
            }
          }
          // Media for earlier `media_placeholder` history messages arrives later,
          // flat under value.messages with the same wamid. It fills in the stored
          // placeholder; customerId is set only when the customer sent it.
          const business = str(value.metadata?.display_phone_number);
          for (const m of list(value.messages)) {
            if (!str(m.id)) continue;
            const fromCustomer = str(m.from) && m.from !== business;
            messages.push({
              channel: "WHATSAPP",
              externalMessageId: m.id,
              customerId: fromCustomer ? m.from : "",
              ...(fromCustomer ? { customerPhone: `+${m.from}` } : {}),
              direction: fromCustomer ? "INBOUND" : "OUTBOUND",
              historical: true,
              ...whatsAppContent(m),
              timestamp: fromSeconds(m.timestamp),
            });
          }
          break;
        }

        case "smb_app_state_sync":
          for (const s of list(value.state_sync)) {
            const c = isObj(s.contact) ? s.contact : null;
            const waId = str(c?.phone_number)?.replace(/\D/g, "");
            const name = str(c?.full_name) ?? str(c?.first_name);
            if (s.type === "contact" && waId && name) contacts.push({ waId, name: name.slice(0, 100) });
          }
          break;

        case "account_update":
          if (str(value.event)) {
            account.push({ event: value.event, ...(str(value.disconnection_info?.reason) ? { reason: value.disconnection_info.reason } : {}) });
          }
          break;

        default:
          ignored.push(`whatsapp field "${String(change.field).slice(0, 50)}"`);
      }
    }
  }
  return summarize({ channel: "WHATSAPP", messages, statuses, contacts, account, ignored });
}

function whatsAppContent(m: Obj): Pick<NormalizedMessage, "type" | "text" | "metadata"> {
  const media = (key: string, type: MessageType) => {
    const o = isObj(m[key]) ? m[key] : {};
    return {
      type,
      text: clip(str(o.caption)),
      metadata: { mediaId: str(o.id) ?? null, mimeType: str(o.mime_type) ?? null, filename: str(o.filename) ?? null },
    };
  };
  const context = isObj(m.context) && str(m.context.id) ? { replyTo: m.context.id } : {};

  switch (m.type) {
    case "text":
      return { type: "TEXT", text: clip(str(m.text?.body)), metadata: Object.keys(context).length ? context : null };
    case "image":
      return media("image", "IMAGE");
    case "sticker":
      return media("sticker", "IMAGE");
    case "media_placeholder":
      // History sync: the media itself follows in a later history webhook.
      return { type: "UNKNOWN", text: null, metadata: { originalType: "media_placeholder" } };
    case "video":
      return media("video", "VIDEO");
    case "audio":
      return media("audio", "AUDIO");
    case "document":
      return media("document", "DOCUMENT");
    case "location": {
      const l = isObj(m.location) ? m.location : {};
      const lat = Number(l.latitude);
      const lng = Number(l.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { type: "UNKNOWN", text: null, metadata: null };
      return {
        type: "LOCATION",
        text: clip([str(l.name), str(l.address)].filter(Boolean).join(", ") || undefined),
        metadata: { latitude: lat, longitude: lng },
      };
    }
    case "interactive": {
      const reply = m.interactive?.button_reply ?? m.interactive?.list_reply;
      return { type: "INTERACTIVE", text: clip(str(reply?.title)), metadata: { replyId: str(reply?.id) ?? null } };
    }
    case "button":
      return { type: "INTERACTIVE", text: clip(str(m.button?.text)), metadata: { payload: str(m.button?.payload) ?? null } };
    case "reaction":
      return {
        type: "REACTION",
        text: clip(str(m.reaction?.emoji)),
        metadata: { reactedTo: str(m.reaction?.message_id) ?? null },
      };
    case "order": {
      // WhatsApp catalog cart — kept as a readable summary; items go through review like any DM.
      const items = Array.isArray(m.order?.product_items) ? m.order.product_items : [];
      const lines = items
        .filter(isObj)
        .map((i: Obj) => `${Number(i.quantity) || 1} x ${String(i.product_retailer_id ?? "item")}`);
      return { type: "INTERACTIVE", text: clip(lines.length ? `I want ${lines.join(", ")}` : undefined), metadata: { catalogOrder: true } };
    }
    default:
      return { type: "UNKNOWN", text: null, metadata: { originalType: String(m.type ?? "").slice(0, 30) } };
  }
}

// ── Instagram ───────────────────────────────────────────────────────────────

const IG_ATTACHMENT_TYPES: Record<string, MessageType> = {
  image: "IMAGE",
  video: "VIDEO",
  ig_reel: "VIDEO",
  reel: "VIDEO",
  audio: "AUDIO",
  file: "DOCUMENT",
};

function normalizeInstagram(entries: unknown[]): NormalizedEvent {
  const messages: NormalizedMessage[] = [];
  const statuses: StatusUpdate[] = [];
  const ignored: string[] = [];

  for (const entry of entries) {
    if (!isObj(entry)) continue;
    const businessId = str(entry.id);
    if (!Array.isArray(entry.messaging)) {
      if (Array.isArray(entry.changes)) ignored.push("instagram changes (non-messaging) event");
      continue;
    }
    for (const ev of entry.messaging) {
      if (!isObj(ev)) continue;
      const sender = str(ev.sender?.id);
      const recipient = str(ev.recipient?.id);
      if (!sender || !recipient) continue;

      if (isObj(ev.read) && str(ev.read.mid)) {
        statuses.push({ externalMessageId: ev.read.mid, status: "read" });
        continue;
      }

      const msg = isObj(ev.message) ? ev.message : null;
      const postback = isObj(ev.postback) ? ev.postback : null;
      const mid = str(msg?.mid) ?? str(postback?.mid);
      if (!mid) {
        ignored.push(`instagram ${Object.keys(ev).filter((k) => !["sender", "recipient", "timestamp"].includes(k)).join(",") || "event"}`);
        continue;
      }
      if (msg?.is_deleted) {
        ignored.push("instagram deleted message");
        continue;
      }

      // is_echo (or sender === our account) means the business sent it — e.g.
      // a reply typed in the Instagram app. The customer is then the recipient.
      const outbound = msg?.is_echo === true || sender === businessId;
      const base = {
        channel: "INSTAGRAM" as const,
        externalMessageId: mid,
        customerId: outbound ? recipient : sender,
        direction: outbound ? ("OUTBOUND" as const) : ("INBOUND" as const),
        timestamp: fromMillis(ev.timestamp),
      };

      if (postback) {
        messages.push({ ...base, type: "INTERACTIVE", text: clip(str(postback.title)), metadata: { payload: str(postback.payload) ?? null } });
        continue;
      }

      const attachments = (Array.isArray(msg!.attachments) ? msg!.attachments : [])
        .filter(isObj)
        .map((a: Obj) => ({ type: String(a.type ?? "unknown").slice(0, 30), url: str(a.payload?.url) ?? null }));
      const first = attachments[0];
      messages.push({
        ...base,
        type: str(msg!.text) ? "TEXT" : first ? IG_ATTACHMENT_TYPES[first.type] ?? "UNKNOWN" : "UNKNOWN",
        text: clip(str(msg!.text)),
        metadata: attachments.length || msg!.reply_to
          ? { ...(attachments.length ? { attachments } : {}), ...(str(msg!.reply_to?.mid) ? { replyTo: msg!.reply_to.mid } : {}) }
          : null,
      });
    }
  }
  return summarize({ channel: "INSTAGRAM", messages, statuses, contacts: [], account: [], ignored });
}

function fromSeconds(v: unknown): Date {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : new Date();
}

function fromMillis(v: unknown): Date {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? new Date(n) : new Date();
}
