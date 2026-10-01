export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminApi, redirectWithError } from "@/lib/admin";
import { sendText } from "@/lib/meta/client";

const REPLY_WINDOW_MS = 24 * 60 * 60 * 1000;
const schema = z.object({ conversationId: z.string().min(1), text: z.string().trim().min(1).max(1000) });

/** Admin reply from the inbox. Free-form messages are only allowed inside Meta's 24h window. */
export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  const form = await req.formData();
  const parsed = schema.safeParse({ conversationId: form.get("conversationId"), text: form.get("text") });
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const { conversationId, text } = parsed.data;
  const back = `/admin/inbox/${conversationId}`;

  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (conv.channel === "INSTAGRAM" && Buffer.byteLength(text, "utf8") > 1000) {
    return redirectWithError(req, back, "Instagram messages are limited to 1000 bytes.");
  }
  if (!conv.lastInboundAt || Date.now() - conv.lastInboundAt.getTime() > REPLY_WINDOW_MS) {
    return redirectWithError(
      req,
      back,
      "The customer's last message is older than 24 hours, so Meta only allows pre-approved templates. Ask them to message you, or contact them directly.",
    );
  }

  const res = await sendText(conv.channel as "WHATSAPP" | "INSTAGRAM", conv.externalUserId, text);
  if (!res.ok) return redirectWithError(req, back, `Message not sent: ${res.friendly}.`);

  const now = new Date();
  try {
    await prisma.message.create({
      data: {
        conversationId,
        externalMessageId: res.data.id || `local:${conversationId}:${now.getTime()}`,
        direction: "OUTBOUND",
        type: "TEXT",
        text,
        status: "sent",
        sentBy: guard.user?.email ?? "admin",
        externalTimestamp: now,
      },
    });
  } catch (e) {
    // The Instagram echo webhook can land before this insert — same message, already stored.
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
    await prisma.message.update({ where: { externalMessageId: res.data.id }, data: { sentBy: guard.user?.email ?? "admin" } });
  }
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
