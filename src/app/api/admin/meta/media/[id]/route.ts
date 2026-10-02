export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { fetchMedia, MAX_MEDIA_BYTES } from "@/lib/meta/client";

// Admin-only proxy for DM attachments: WhatsApp media needs the access token,
// and Instagram CDN links expire — neither should reach the browser directly.
const INLINE = /^(?:image\/(?:jpeg|png|gif|webp)|audio\/[\w.+-]+|video\/[\w.+-]+)$/;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  const { id } = await params;
  const message = await prisma.message.findUnique({
    where: { id },
    select: { metadata: true, conversation: { select: { channel: true } } },
  });
  if (!message) return new NextResponse("Not found", { status: 404 });

  const upstream = await fetchMedia(message.conversation.channel, message.metadata as Record<string, any> | null);
  if (!upstream?.ok || !upstream.body) return new NextResponse("Media unavailable", { status: 502 });
  if (Number(upstream.headers.get("content-length") ?? 0) > MAX_MEDIA_BYTES) {
    return new NextResponse("Media too large", { status: 413 });
  }

  // Customer-supplied files are untrusted: only known-safe media types render
  // inline; anything else (HTML, SVG, PDFs…) downloads, inside a CSP sandbox.
  const type = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const inline = INLINE.test(type);
  return new NextResponse(upstream.body, {
    headers: {
      "content-type": inline ? type : "application/octet-stream",
      "content-disposition": inline ? "inline" : "attachment",
      "content-security-policy": "sandbox; default-src 'none'",
      "cache-control": "private, max-age=3600",
    },
  });
}
