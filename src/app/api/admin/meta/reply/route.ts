export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, redirectWithError } from "@/lib/admin";
import { rateLimit } from "@/lib/rate-limit";
import { listTemplates, sendTemplate, sendText } from "@/lib/meta/client";

const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;
const schema = z.object({
  conversationId: z.string().min(1),
  text: z.string().trim().max(1000).optional(),
  // "name|language" of an approved WhatsApp template — the only thing Meta allows outside the 24h window.
  template: z.string().max(600).optional(),
  params: z.array(z.string().trim().min(1).max(500)).max(10),
});

/**
 * Admin reply from the inbox. Free text inside Meta's 24h customer-service
 * window, an approved template outside it (WhatsApp only). The message is
 * stored as `pending` before calling Meta, then marked sent (with the wamid) or
 * failed — so a crash mid-send never loses what the admin typed.
 */
export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;
  const actor = guard.user?.email ?? "admin";

  const form = await req.formData();
  const parsed = schema.safeParse({
    conversationId: form.get("conversationId"),
    text: form.get("text") ?? undefined,
    template: form.get("template") || undefined,
    params: form.getAll("param").map(String).filter((p) => p.trim()),
  });
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { conversationId, text, template, params } = parsed.data;
  const back = `/admin/inbox/${conversationId}`;

  if (!rateLimit({ key: `meta-reply:${actor}`, max: 20, windowMs: 60_000 }).ok) {
    return redirectWithError(req, back, "Sending too fast — wait a minute and try again.");
  }

  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const inWindow = !!conv.lastInboundAt && Date.now() - conv.lastInboundAt.getTime() <= REPLY_WINDOW_MS;

  let body: string;
  let send: () => ReturnType<typeof sendText>;
  if (template) {
    if (conv.channel !== "WHATSAPP") return redirectWithError(req, back, "Templates are WhatsApp-only.");
    const t = (await listTemplates()).find((x) => `${x.name}|${x.language}` === template);
    if (!t) return redirectWithError(req, back, "That template isn't approved (or no longer exists).");
    if (params.length !== t.params) return redirectWithError(req, back, `This template needs ${t.params} value(s).`);
    body = t.body.replace(/\{\{(\d+)\}\}/g, (_, n) => params[Number(n) - 1] ?? "");
    send = () => sendTemplate(conv.externalUserId, t.name, t.language, params);
  } else {
    if (!text) return redirectWithError(req, back, "Type a message.");
    if (conv.channel === "INSTAGRAM" && Buffer.byteLength(text, "utf8") > 1000) {
      return redirectWithError(req, back, "Instagram messages are limited to 1000 bytes.");
    }
    if (!inWindow) {
      return redirectWithError(
        req,
        back,
        conv.channel === "WHATSAPP"
          ? "The customer's last message is older than 24 hours — pick an approved template, or reply from the phone."
          : "The customer's last message is older than 24 hours, so Meta doesn't allow a reply from here.",
      );
    }
    body = text;
    send = () => sendText(conv.channel as "WHATSAPP" | "INSTAGRAM", conv.externalUserId, text);
  }

  const now = new Date();
  const pending = await prisma.message.create({
    data: {
      conversationId,
      externalMessageId: `pending:${conversationId}:${now.getTime()}:${Math.random().toString(36).slice(2, 8)}`,
      direction: "OUTBOUND",
      type: "TEXT",
      text: body,
      status: "pending",
      sentBy: actor,
      metadata: template ? { template } : undefined,
      externalTimestamp: now,
    },
  });

  const res = await send();
  if (!res.ok) {
    await prisma.message.update({ where: { id: pending.id }, data: { status: `failed: ${res.friendly}`.slice(0, 200) } });
    console.warn(JSON.stringify({ event: "WhatsAppReplyFailed", channel: conv.channel, code: res.code ?? null, actor }));
    return redirectWithError(req, back, `Message not sent: ${res.friendly}. It's kept in the thread marked as failed.`);
  }

  if (res.data.id) {
    try {
      await prisma.message.update({ where: { id: pending.id }, data: { externalMessageId: res.data.id, status: "sent" } });
    } catch (e) {
      // The Instagram echo webhook can land first and store the same message: keep that row, credit the admin.
      if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
      await prisma.message.delete({ where: { id: pending.id } });
      await prisma.message.update({ where: { externalMessageId: res.data.id }, data: { sentBy: actor } });
    }
  } else {
    await prisma.message.update({ where: { id: pending.id }, data: { status: "sent" } });
  }
  console.info(JSON.stringify({ event: "WhatsAppReplySent", channel: conv.channel, template: !!template, actor }));

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: now,
      unreadCount: 0,
      lastReadAt: now,
      ...(conv.status === "ORDER_DETECTED" ? {} : { status: "WAITING_FOR_CUSTOMER" }),
    },
  });

  return NextResponse.redirect(new URL(back, req.url));
}
