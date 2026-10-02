import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, MapPin, Paperclip, Sparkles } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SourceBadge, StatusBadge, statusLabel } from "@/components/admin/OrderBadges";
import { AutoRefresh } from "@/components/admin/AutoRefresh";
import { isDraftStatus } from "@/lib/order-status";
import type { Extraction } from "@/lib/meta/extract";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conversation · AquaGear Admin" };

const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;
const THREAD_LIMIT = 200;

export default async function ConversationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const conv = await prisma.conversation.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { externalTimestamp: "desc" }, take: THREAD_LIMIT },
      orders: { orderBy: { createdAt: "desc" }, select: { id: true, status: true, total: true, createdAt: true } },
    },
  });
  if (!conv) return notFound();

  // Opening the thread marks it read.
  if (conv.unreadCount > 0) {
    await prisma.conversation.update({ where: { id }, data: { unreadCount: 0, lastReadAt: new Date() } });
  }

  const messages = [...conv.messages].reverse();
  const ex = conv.extraction as unknown as Extraction | null;
  const hasOpenDraft = conv.orders.some((o) => isDraftStatus(o.status));
  // Server component: renders once per request, so reading the clock here is intentional.
  const canReply = !!conv.lastInboundAt && Date.now() - conv.lastInboundAt.getTime() < REPLY_WINDOW_MS;
  const title = conv.name || (conv.username ? `@${conv.username}` : conv.phone || "Unknown customer");

  return (
    <div className="space-y-4">
      <AutoRefresh seconds={10} />
      <Link href="/admin/inbox" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="w-4 h-4" /> Back to inbox
      </Link>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <SourceBadge source={conv.channel} />
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {[conv.username && conv.name ? `@${conv.username}` : null, conv.phone, statusLabel(conv.status)].filter(Boolean).join(" · ")}
          </p>
        </div>
        {conv.status !== "CLOSED" && (
          <form action="/api/admin/meta/conversation" method="post">
            <input type="hidden" name="id" value={conv.id} />
            <button name="intent" value="close" className="btn-outline text-sm">Close conversation</button>
          </form>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Thread */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col min-h-[60vh]">
          <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[70vh]">
            {conv.messages.length === THREAD_LIMIT && (
              <p className="text-center text-xs text-gray-500">Showing the latest {THREAD_LIMIT} messages.</p>
            )}
            {messages.map((m) => {
              const out = m.direction === "OUTBOUND";
              const meta = (m.metadata ?? {}) as Record<string, any>;
              return (
                <div key={m.id} className={`flex ${out ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2 text-sm ${out ? "bg-sky-700 text-white rounded-br-sm" : "bg-gray-100 text-gray-900 rounded-bl-sm"}`}>
                    {m.type === "IMAGE" && (
                      // eslint-disable-next-line @next/next/no-img-element -- admin-only proxy, not optimizable
                      <img src={`/api/admin/meta/media/${m.id}`} alt="Customer attachment" loading="lazy" className="rounded-lg max-h-64 mb-1" />
                    )}
                    {m.type === "AUDIO" && <audio controls preload="none" src={`/api/admin/meta/media/${m.id}`} className="max-w-full" />}
                    {m.type === "VIDEO" && <video controls preload="none" src={`/api/admin/meta/media/${m.id}`} className="rounded-lg max-h-64" />}
                    {m.type === "DOCUMENT" && (
                      <a href={`/api/admin/meta/media/${m.id}`} className="inline-flex items-center gap-1 underline">
                        <Paperclip className="w-4 h-4" /> {meta.filename || "Download file"}
                      </a>
                    )}
                    {m.type === "LOCATION" && typeof meta.latitude === "number" && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${meta.latitude},${meta.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 underline"
                      >
                        <MapPin className="w-4 h-4" /> Shared location
                      </a>
                    )}
                    {m.type === "REACTION" && <span className="text-xs opacity-80">Reacted </span>}
                    {m.type === "UNKNOWN" && !m.text && <span className="italic opacity-80">Unsupported message type</span>}
                    {/* Customer text is untrusted: rendered as a React text node (escaped), never as HTML. */}
                    {m.text && <p className="whitespace-pre-wrap break-words">{m.text}</p>}
                    <div className={`text-[11px] mt-1 ${out ? "text-sky-100" : "text-gray-500"}`}>
                      {m.externalTimestamp.toLocaleString()}
                      {out && m.status && ` · ${m.status}`}
                      {out && m.sentBy && ` · ${m.sentBy}`}
                    </div>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && <p className="text-center text-sm text-gray-500 py-8">No messages yet.</p>}
          </div>

          <form action="/api/admin/meta/reply" method="post" className="border-t p-3 flex gap-2 items-end">
            <input type="hidden" name="conversationId" value={conv.id} />
            <label htmlFor="reply" className="sr-only">Reply</label>
            <textarea
              id="reply"
              name="text"
              rows={2}
              maxLength={1000}
              required
              disabled={!canReply}
              placeholder={canReply ? `Reply on ${conv.channel === "WHATSAPP" ? "WhatsApp" : "Instagram"}…` : "Last customer message is older than 24h — Meta only allows template messages."}
              className="flex-1 border border-gray-300 rounded-md p-2 text-sm focus:border-sky-500 focus:ring-sky-500 disabled:bg-gray-50"
            />
            <button className="btn-primary text-sm" disabled={!canReply}>Send</button>
          </form>
        </div>

        {/* Detected order + linked orders */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Detected order
            </h2>
            {!ex || !ex.isOrder ? (
              <p className="text-sm text-gray-500">
                {ex?.intent === "INQUIRY" ? "Customer is asking questions — no order intent yet." : "No order intent detected in recent messages."}
              </p>
            ) : (
              <div className="text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-500">Confidence</span>
                  <span className="font-medium">{ex.confidence} · {Math.round(ex.score * 100)}%</span>
                </div>
                <ul className="space-y-1">
                  {ex.items.map((i, idx) => (
                    <li key={idx}>
                      {i.productId ? (
                        <span>{i.quantity} × {i.productName}{i.variant ? ` (${i.variant})` : ""}</span>
                      ) : (
                        <span className="text-amber-800">
                          {i.quantity} × “{i.customerText}” — {i.candidates.length ? `could be ${i.candidates.map((c) => c.name).join(" / ")}` : "no matching product"}
                        </span>
                      )}
                    </li>
                  ))}
                  {ex.items.length === 0 && <li className="text-amber-800">Order intent, but no product recognized.</li>}
                </ul>
                {ex.location && <div><span className="text-gray-500">Delivery:</span> {ex.location}</div>}
                {ex.phone && <div><span className="text-gray-500">Phone:</span> {ex.phone}</div>}
                {ex.missingFields.length > 0 && <div className="text-xs text-gray-500">Missing: {ex.missingFields.join(", ").replace(/_/g, " ")}</div>}
              </div>
            )}
            <form action="/api/admin/meta/conversation" method="post" className="flex flex-wrap gap-2 pt-2 border-t">
              <input type="hidden" name="id" value={conv.id} />
              <button name="intent" value="detect" className="btn-outline text-sm">Re-run detection</button>
              {!hasOpenDraft && <button name="intent" value="draft" className="btn-outline text-sm">Create draft manually</button>}
            </form>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-3">
            <h2 className="font-semibold text-gray-900">Orders from this conversation</h2>
            {conv.orders.length === 0 && <p className="text-sm text-gray-500">None yet.</p>}
            {conv.orders.map((o) => (
              <Link key={o.id} href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-2 text-sm hover:text-sky-700">
                <span className="font-medium">#{o.id.slice(0, 8).toUpperCase()}</span>
                <span className="text-gray-500">${(o.total / 100).toFixed(2)}</span>
                <StatusBadge status={o.status} />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
