// Webhook → database pipeline: persist the signed delivery, then (after the
// 200 is sent) turn it into conversations, messages and draft orders.
//
// Idempotency is layered: the raw delivery dedupes on sha256(body), each
// message on its globally unique Meta id, and draft creation is serialized per
// conversation with a Postgres advisory lock — so Meta's retries can never
// duplicate a customer, message, order or Telegram alert.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/settings";
import { deliveryFeeFor } from "@/lib/cart";
import { DRAFT_STATUSES } from "@/lib/order-status";
import { notifyNewOrder } from "@/lib/telegram";
import { normalizeWebhook, type NormalizedEvent, type NormalizedMessage } from "./normalize";
import { extractOrder, type CatalogProduct, type Extraction } from "./extract";
import { fetchInstagramProfile } from "./client";
import { sha256 } from "./signature";

const MAX_RETRIES = 6; // 1, 2, 4, 8, 16, 32 minutes
const LEASE_MS = 5 * 60 * 1000;
const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const WINDOW_MESSAGES = 40;
const isUniqueViolation = (e: unknown) => e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";

/** Persist a verified delivery. Returns null when it's a duplicate (Meta retry). */
export async function recordWebhook(rawBody: string, payload: unknown): Promise<{ id: string; actionable: boolean } | null> {
  const ev = normalizeWebhook(payload);
  const actionable = ev.messages.length > 0 || ev.statuses.length > 0;
  try {
    const row = await prisma.metaWebhookEvent.create({
      data: {
        eventKey: sha256(rawBody),
        channel: ev.channel,
        eventType: ev.eventType,
        // Meta payloads carry message content but never credentials; nothing to redact.
        payload: payload as Prisma.InputJsonValue,
        status: actionable ? "RECEIVED" : "IGNORED",
        error: ev.ignored.length ? ev.ignored.join("; ").slice(0, 500) : null,
        processedAt: actionable ? null : new Date(),
      },
      select: { id: true },
    });
    return { id: row.id, actionable };
  } catch (e) {
    if (isUniqueViolation(e)) return null;
    throw e;
  }
}

/** Process one stored event. Safe to call concurrently/repeatedly — a lease ensures one worker. */
export async function processEvent(id: string): Promise<void> {
  const now = new Date();
  const claimed = await prisma.metaWebhookEvent.updateMany({
    where: {
      id,
      OR: [
        { status: { in: ["RECEIVED", "FAILED"] } },
        { status: "PROCESSING", nextRetryAt: { lt: now } }, // lease expired (crashed worker)
      ],
    },
    data: { status: "PROCESSING", nextRetryAt: new Date(now.getTime() + LEASE_MS) },
  });
  if (claimed.count === 0) return;

  const event = await prisma.metaWebhookEvent.findUniqueOrThrow({ where: { id } });
  try {
    const ev = normalizeWebhook(event.payload);
    const { inboundConversations, newInstagram } = await applyEvent(ev);
    for (const conversationId of newInstagram) await enrichInstagramProfile(conversationId);
    for (const conversationId of inboundConversations) await refreshDraft(conversationId);
    await prisma.metaWebhookEvent.update({
      where: { id },
      data: { status: "PROCESSED", processedAt: new Date(), nextRetryAt: null, error: null },
    });
    console.info(`[meta] event ${id} processed: ${ev.channel} ${ev.eventType} (${ev.messages.length} msg, ${ev.statuses.length} status)`);
  } catch (e) {
    const retryCount = event.retryCount + 1;
    const message = (e instanceof Error ? e.message : String(e)).slice(0, 500);
    await prisma.metaWebhookEvent.update({
      where: { id },
      data: {
        status: "FAILED",
        retryCount,
        error: message,
        // After MAX_RETRIES it stays FAILED for a manual retry from /admin/meta.
        nextRetryAt: retryCount < MAX_RETRIES ? new Date(Date.now() + 60_000 * 2 ** (retryCount - 1)) : null,
      },
    });
    console.error(`[meta] event ${id} failed (attempt ${retryCount}): ${message}`);
  }
}

/** Pick up failed events whose backoff elapsed, and deliveries whose after() never ran. */
export async function retryDueEvents(limit = 5): Promise<number> {
  const now = new Date();
  const due = await prisma.metaWebhookEvent.findMany({
    where: {
      OR: [
        { status: "FAILED", nextRetryAt: { lte: now } },
        { status: "PROCESSING", nextRetryAt: { lt: now } },
        { status: "RECEIVED", receivedAt: { lt: new Date(now.getTime() - 2 * 60_000) } },
      ],
    },
    orderBy: { receivedAt: "asc" },
    take: limit,
    select: { id: true },
  });
  for (const { id } of due) await processEvent(id);
  return due.length;
}

export async function pruneEvents(retentionDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const longCutoff = new Date(Date.now() - 3 * retentionDays * 24 * 60 * 60 * 1000);
  const { count } = await prisma.metaWebhookEvent.deleteMany({
    where: {
      OR: [
        { status: { in: ["PROCESSED", "IGNORED"] }, receivedAt: { lt: cutoff } },
        { receivedAt: { lt: longCutoff } }, // failed events are kept longer for diagnosis
      ],
    },
  });
  return count;
}

// ── Conversations & messages ────────────────────────────────────────────────

const DETECTION_TYPES = new Set(["TEXT", "INTERACTIVE", "LOCATION"]);
const STATUS_RANK: Record<string, number> = { sent: 1, delivered: 2, read: 3 };

async function applyEvent(ev: NormalizedEvent) {
  const inboundConversations = new Set<string>();
  const newInstagram = new Set<string>();

  for (const m of [...ev.messages].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())) {
    const { conversation, created } = await upsertConversation(m);
    if (created && m.channel === "INSTAGRAM") newInstagram.add(conversation.id);

    try {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          externalMessageId: m.externalMessageId,
          direction: m.direction,
          type: m.type,
          text: m.text,
          metadata: (m.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          externalTimestamp: m.timestamp,
        },
      });
    } catch (e) {
      if (isUniqueViolation(e)) continue; // already stored (retry, or our own reply echoed back)
      throw e;
    }

    const newer = m.timestamp > conversation.lastMessageAt;
    const keepStatus = conversation.status === "ORDER_DETECTED";
    await prisma.conversation.update({
      where: { id: conversation.id },
      data:
        m.direction === "INBOUND"
          ? {
              unreadCount: { increment: 1 },
              lastInboundAt: m.timestamp,
              ...(newer ? { lastMessageAt: m.timestamp } : {}),
              ...(keepStatus ? {} : { status: "WAITING_FOR_ADMIN" }),
            }
          : { ...(newer ? { lastMessageAt: m.timestamp } : {}), ...(keepStatus ? {} : { status: "WAITING_FOR_CUSTOMER" }) },
    });
    if (m.direction === "INBOUND" && DETECTION_TYPES.has(m.type)) inboundConversations.add(conversation.id);
  }

  for (const s of ev.statuses) {
    const rank = STATUS_RANK[s.status];
    await prisma.message.updateMany({
      where: {
        externalMessageId: s.externalMessageId,
        // Statuses can arrive out of order — never downgrade read → delivered.
        ...(rank
          ? { OR: [{ status: null }, { status: { in: Object.keys(STATUS_RANK).filter((k) => STATUS_RANK[k] < rank) } }] }
          : {}),
      },
      data: { status: s.error ? `${s.status}: ${s.error}`.slice(0, 200) : s.status },
    });
  }

  return { inboundConversations, newInstagram };
}

async function upsertConversation(m: NormalizedMessage, retried = false) {
  const where = { channel_externalUserId: { channel: m.channel, externalUserId: m.customerId } };
  const existing = await prisma.conversation.findUnique({ where });
  if (existing) {
    const patch = {
      ...(m.customerName && m.customerName !== existing.name ? { name: m.customerName } : {}),
      ...(m.customerPhone && !existing.phone ? { phone: m.customerPhone } : {}),
    };
    const conversation = Object.keys(patch).length ? await prisma.conversation.update({ where, data: patch }) : existing;
    return { conversation, created: false };
  }
  try {
    const conversation = await prisma.conversation.create({
      data: {
        channel: m.channel,
        externalUserId: m.customerId,
        name: m.customerName ?? null,
        phone: m.customerPhone ?? null,
        lastMessageAt: new Date(0), // bumped by the first message below
      },
    });
    return { conversation, created: true };
  } catch (e) {
    // Two deliveries for a brand-new customer raced; the other one won.
    if (isUniqueViolation(e) && !retried) return upsertConversation(m, true);
    throw e;
  }
}

async function enrichInstagramProfile(conversationId: string) {
  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv || conv.name || conv.username) return;
  const profile = await fetchInstagramProfile(conv.externalUserId);
  if (profile) {
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { name: profile.name?.slice(0, 100) || null, username: profile.username?.slice(0, 100) || null },
    });
  }
}

// ── Draft orders ────────────────────────────────────────────────────────────

const SYSTEM = "system";
const CHANNEL_LABEL: Record<string, string> = { WHATSAPP: "WhatsApp", INSTAGRAM: "Instagram" };

/**
 * Re-run extraction over the conversation's recent messages and create or
 * update its open draft order. Never confirms anything and never touches
 * stock — drafts only become real orders when an admin confirms them.
 * Returns the id of a newly created draft, if any.
 */
export async function refreshDraft(conversationId: string): Promise<string | null> {
  const { shippingFlatRate } = await getStoreSettings();

  const createdId = await prisma.$transaction(
    async (tx) => {
      // Serialize per conversation: concurrent deliveries can't both create a draft.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${conversationId}))`;

      const conv = await tx.conversation.findUnique({ where: { id: conversationId } });
      if (!conv) return null;

      // Only messages since the last order that left draft state belong to the next order.
      const lastClosed = await tx.order.findFirst({
        where: { conversationId, status: { notIn: [...DRAFT_STATUSES] } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, placedAt: true, canceledAt: true },
      });
      const since = new Date(
        Math.max(
          Date.now() - WINDOW_MS,
          ...(lastClosed ? [lastClosed.createdAt, lastClosed.placedAt, lastClosed.canceledAt].filter((d): d is Date => !!d).map((d) => d.getTime()) : []),
        ),
      );
      const recent = await tx.message.findMany({
        where: { conversationId, externalTimestamp: { gt: since } },
        orderBy: { externalTimestamp: "desc" },
        take: WINDOW_MESSAGES,
        select: { direction: true, text: true, type: true, metadata: true },
      });
      const lines = recent.reverse().map((m) => ({
        direction: m.direction as "INBOUND" | "OUTBOUND",
        text: m.type === "REACTION" ? null : m.text,
        location: m.type === "LOCATION" ? (m.metadata as { latitude: number; longitude: number } | null) : null,
      }));

      const catalog: CatalogProduct[] = await tx.product.findMany({
        where: { isArchived: false },
        select: { id: true, name: true, price: true, stock: true, aliases: true, mpn: true, brand: true },
      });
      const ex = extractOrder(lines, catalog);
      const byId = new Map(catalog.map((p) => [p.id, p]));

      const draft = await tx.order.findFirst({
        where: { conversationId, status: { in: [...DRAFT_STATUSES] } },
        orderBy: { createdAt: "desc" },
        select: { id: true, extraction: true },
      });

      let created: string | null = null;
      let convStatus: string | undefined;

      if (ex.isOrder && ex.confidence !== "LOW") {
        const fields = draftFields(conv, ex, byId, shippingFlatRate);
        if (!draft) {
          const order = await tx.order.create({
            data: { ...fields.order, source: conv.channel, conversationId, items: { create: fields.items } },
            select: { id: true },
          });
          await tx.orderAudit.create({
            data: {
              orderId: order.id,
              actor: SYSTEM,
              action: `Draft created from ${CHANNEL_LABEL[conv.channel] ?? conv.channel} conversation`,
              detail: `Confidence ${ex.confidence} (${Math.round(ex.score * 100)}%). Missing: ${ex.missingFields.join(", ") || "nothing"}`,
            },
          });
          created = order.id;
        } else if (JSON.stringify(draft.extraction) !== JSON.stringify(ex)) {
          const adminEdits = await tx.orderAudit.count({ where: { orderId: draft.id, actor: { not: SYSTEM } } });
          // Once an admin has edited a draft, their version wins; new detections
          // are still visible on the conversation.
          if (adminEdits === 0) {
            await tx.orderItem.deleteMany({ where: { orderId: draft.id } });
            await tx.order.update({ where: { id: draft.id }, data: { ...fields.order, items: { create: fields.items } } });
            await tx.orderAudit.create({
              data: {
                orderId: draft.id,
                actor: SYSTEM,
                action: "Draft updated from new messages",
                detail: `Confidence ${ex.confidence} (${Math.round(ex.score * 100)}%). Items: ${fields.items.map((i) => `${i.quantity} × ${byId.get(i.productId)?.name}`).join(", ") || "none"}`,
              },
            });
          }
        }
        convStatus = "ORDER_DETECTED";
      } else if (ex.isOrder && !draft) {
        convStatus = "POTENTIAL_ORDER";
      }

      await tx.conversation.update({
        where: { id: conversationId },
        data: { extraction: ex as unknown as Prisma.InputJsonValue, ...(convStatus ? { status: convStatus } : {}) },
      });
      return created;
    },
    { timeout: 15_000 },
  );

  // Fired only for the transaction that actually created the draft — exactly once.
  if (createdId) await notifyNewOrder(createdId);
  return createdId;
}

function draftFields(
  conv: { name: string | null; phone: string | null },
  ex: Extraction,
  byId: Map<string, CatalogProduct>,
  shippingFlatRate: number,
) {
  // Validate the extractor's output against the catalog rather than trusting it.
  const items = ex.items
    .filter((i) => i.productId && byId.has(i.productId) && Number.isInteger(i.quantity) && i.quantity >= 1 && i.quantity <= 99)
    .map((i) => ({ productId: i.productId!, quantity: i.quantity, price: byId.get(i.productId!)!.price }));
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const notes = [
    ...ex.items.filter((i) => i.productId && i.variant).map((i) => `${i.productName}: ${i.variant}`),
    ...ex.items
      .filter((i) => !i.productId)
      .map((i) => `Unmatched "${i.customerText}"${i.candidates.length ? ` — could be: ${i.candidates.map((c) => c.name).join(" / ")}` : ""}`),
    ...(ex.pin ? [`Location pin: ${ex.pin}`] : []),
    ...(ex.customerConfirmed ? ["Customer said yes in the chat — confirm details before placing."] : []),
  ];

  return {
    items,
    order: {
      status: ex.confidence === "HIGH" ? "PENDING_CONFIRMATION" : "NEEDS_REVIEW",
      name: ex.name ?? conv.name,
      phoneNumber: ex.phone ?? conv.phone,
      location: ex.location,
      apartment: ex.addressDetails,
      notes: notes.length ? notes.join("\n").slice(0, 2000) : null,
      total: subtotal + deliveryFeeFor(subtotal, shippingFlatRate),
      extraction: ex as unknown as Prisma.InputJsonValue,
    },
  };
}
