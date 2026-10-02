export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAdmin } from "@/lib/mobile-admin";

// APNs device tokens are hex (64 chars today; Apple says don't assume a length).
const TOKEN_RE = /^[0-9a-f]{16,200}$/i;

async function parseToken(req: Request): Promise<string | null> {
  const body = await req.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token : "";
  return TOKEN_RE.test(token) ? token : null;
}

/** Register this device for new-order pushes. Idempotent. */
export async function POST(req: Request) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;
  const token = await parseToken(req);
  if (!token) return NextResponse.json({ error: "Invalid device token" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: guard.id },
    select: { pushTokens: true },
  });
  if (user && !user.pushTokens.includes(token)) {
    await prisma.user.update({
      where: { id: guard.id },
      data: { pushTokens: [...user.pushTokens, token] },
    });
  }
  return NextResponse.json({ ok: true });
}

/** Unregister this device (alerts toggled off, or sign-out). Idempotent. */
export async function DELETE(req: Request) {
  const guard = await requireMobileAdmin(req);
  if (guard instanceof NextResponse) return guard;
  const token = await parseToken(req);
  if (!token) return NextResponse.json({ error: "Invalid device token" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: guard.id },
    select: { pushTokens: true },
  });
  if (user?.pushTokens.includes(token)) {
    await prisma.user.update({
      where: { id: guard.id },
      data: { pushTokens: user.pushTokens.filter((t) => t !== token) },
    });
  }
  return NextResponse.json({ ok: true });
}
