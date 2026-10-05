import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { MessageCircle, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { SourceBadge, statusLabel } from "@/components/admin/OrderBadges";
import { AutoRefresh } from "@/components/admin/AutoRefresh";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inbox · AquaGear Admin" };

const CHANNELS = [
  { value: "", label: "All conversations" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "INSTAGRAM", label: "Instagram" },
];
const PAGE_SIZE = 30;

type SearchParams = Promise<{ channel?: string; q?: string; unread?: string; page?: string }>;

export default async function Inbox({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const channel = CHANNELS.some((c) => c.value === sp.channel) ? sp.channel! : "";
  const q = (sp.q || "").trim().slice(0, 100);
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);

  const where: Prisma.ConversationWhereInput = {
    messages: { some: {} }, // contact-sync placeholders stay hidden until they have a message
    ...(channel ? { channel } : {}),
    ...(sp.unread ? { unreadCount: { gt: 0 } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { contactName: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { externalUserId: { contains: q } },
            // ponytail: ILIKE over message text — fine for a small shop; add a
            // trigram/full-text index if the inbox grows past ~100k messages.
            { messages: { some: { text: { contains: q, mode: "insensitive" } } } },
          ],
        }
      : {}),
  };

  const [conversations, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      orderBy: { lastMessageAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        messages: { orderBy: { externalTimestamp: "desc" }, take: 1, select: { text: true, type: true, direction: true } },
        orders: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
      },
    }),
    prisma.conversation.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => {
    const params = new URLSearchParams({ ...(channel ? { channel } : {}), ...(q ? { q } : {}), ...(sp.unread ? { unread: "1" } : {}), page: String(p) });
    return `/admin/inbox?${params}`;
  };

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={20} />
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Inbox</h1>
        <span className="text-sm text-gray-500">{total} conversation{total === 1 ? "" : "s"}</span>
      </div>

      <form className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 grid gap-3 md:grid-cols-4">
        <div className="relative md:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, @username, phone, or message text…"
            className="w-full border border-gray-300 rounded-md pl-9 pr-3 py-2 text-sm focus:border-sky-500 focus:ring-sky-500"
          />
        </div>
        <select name="channel" defaultValue={channel} className="border border-gray-300 rounded-md px-3 py-2 text-sm">
          {CHANNELS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="unread" value="1" defaultChecked={!!sp.unread} /> Unread only
        </label>
        <div className="md:col-span-4 flex gap-2">
          <button type="submit" className="btn-primary text-sm">Apply</button>
          <Link href="/admin/inbox" className="btn-outline text-sm">Reset</Link>
        </div>
      </form>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm divide-y">
        {conversations.map((c) => {
          const last = c.messages[0];
          const preview = last ? `${last.direction === "OUTBOUND" ? "You: " : ""}${last.text || `[${last.type.toLowerCase()}]`}` : "";
          return (
            <Link key={c.id} href={`/admin/inbox/${c.id}`} className="flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <SourceBadge source={c.channel} />
                  <span className={`truncate ${c.unreadCount ? "font-semibold text-gray-900" : "font-medium text-gray-800"}`}>
                    {c.contactName || c.name || (c.username ? `@${c.username}` : c.phone || "Unknown customer")}
                  </span>
                  {c.username && c.name && <span className="text-xs text-gray-500">@{c.username}</span>}
                  {c.channel === "WHATSAPP" && c.phone && <span className="text-xs text-gray-500">{c.phone}</span>}
                </div>
                <p className={`text-sm mt-1 truncate ${c.unreadCount ? "text-gray-900" : "text-gray-500"}`}>{preview}</p>
                <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-gray-500">
                  <span>{statusLabel(c.status)}</span>
                  {c.orders[0] && <span>· Order: {statusLabel(c.orders[0].status)}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-gray-500">{c.lastMessageAt.toLocaleString()}</div>
                {c.unreadCount > 0 && (
                  <span className="inline-block mt-1 min-w-6 px-2 py-0.5 rounded-full bg-sky-700 text-white text-xs font-semibold">
                    {c.unreadCount}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
        {conversations.length === 0 && (
          <div className="text-center py-12">
            <MessageCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900">No conversations</h3>
            <p className="text-gray-500 text-sm">
              WhatsApp and Instagram DMs appear here once the Meta webhook is connected (see <Link href="/admin/meta" className="text-sky-700 hover:underline">Meta</Link>).
            </p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          {page > 1 && <Link href={href(page - 1)} className="btn-outline text-sm">← Previous</Link>}
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          {page < totalPages && <Link href={href(page + 1)} className="btn-outline text-sm">Next →</Link>}
        </div>
      )}
    </div>
  );
}
