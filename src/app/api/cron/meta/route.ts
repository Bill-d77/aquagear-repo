export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { metaConfig } from "@/lib/meta/config";
import { safeEqual } from "@/lib/meta/signature";
import { retryDueEvents, pruneEvents } from "@/lib/meta/ingest";
import { refreshInstagramTokenIfDue } from "@/lib/meta/client";

// Daily Vercel Cron (vercel.json): retry failed webhook events, prune old raw
// payloads, and keep the 60-day Instagram token alive. Vercel sends
// "Authorization: Bearer $CRON_SECRET".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!secret || !safeEqual(given, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const retried = await retryDueEvents(25);
  const pruned = await pruneEvents(metaConfig().eventRetentionDays);
  const instagram = await refreshInstagramTokenIfDue();
  return NextResponse.json({ retried, pruned, instagram });
}
