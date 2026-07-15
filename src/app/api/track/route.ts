export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { parseConsent, CONSENT_COOKIE, ANON_ID_COOKIE } from "@/lib/cookies";
import { parseDevice, parseBrowser, externalReferrerHost, isTrackablePath, parseUtm } from "@/lib/track";

const schema = z.object({
  path: z.string().min(1).max(200),
  referrer: z.string().max(500).optional(),
  search: z.string().max(500).optional(),
});

const RETENTION_DAYS = 90;

export async function POST(req: Request) {
  // Server-side consent gate — the client beacon already checks, but the
  // cookie is the source of truth. No analytics consent → drop silently.
  const cookieStore = await cookies();
  const consent = parseConsent(cookieStore.get(CONSENT_COOKIE)?.value);
  if (!consent?.analytics) {
    return new NextResponse(null, { status: 204 });
  }

  const ip = getClientIp(req);
  const limit = rateLimit({ key: `track:ip:${ip}`, max: 60, windowMs: 60 * 1000 });
  if (!limit.ok) return new NextResponse(null, { status: 204 }); // drop, never error

  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success || !isTrackablePath(parsed.data.path)) {
      return new NextResponse(null, { status: 204 });
    }

    const ua = req.headers.get("user-agent") ?? "";
    const ownHost = new URL(req.url).hostname;

    await prisma.pageView.create({
      data: {
        anonId: cookieStore.get(ANON_ID_COOKIE)?.value ?? null,
        path: parsed.data.path,
        country: req.headers.get("x-vercel-ip-country"),
        device: parseDevice(ua),
        browser: parseBrowser(ua),
        referrer: externalReferrerHost(parsed.data.referrer, ownHost),
        ...parseUtm(parsed.data.search),
      },
    });

    // Opportunistic retention pruning (~2% of writes) instead of a cron.
    if (Math.random() < 0.02) {
      const cutoff = new Date(Date.now() - RETENTION_DAYS * 86400000);
      await prisma.pageView.deleteMany({ where: { createdAt: { lt: cutoff } } });
    }
  } catch (e) {
    console.error("POST /api/track:", e);
  }
  // Always 204 — analytics must never surface errors to visitors.
  return new NextResponse(null, { status: 204 });
}
