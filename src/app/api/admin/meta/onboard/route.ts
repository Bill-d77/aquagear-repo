export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/admin";
import { rateLimit } from "@/lib/rate-limit";
import { completeCoexistenceSignup, requestSmbSync } from "@/lib/meta/client";

const schema = z.discriminatedUnion("intent", [
  // Embedded Signup finished in the browser: the 30-second code + the WABA id from the session event.
  z.object({ intent: z.literal("connect"), code: z.string().min(10).max(2000), wabaId: z.string().regex(/^\d{5,25}$/) }),
  // Re-request contacts/history sync (Meta only honours it once, within 24h of onboarding).
  z.object({ intent: z.literal("sync") }),
]);

/** Admin-only: finish WhatsApp coexistence onboarding from /admin/meta. JSON only, so a cross-site form can't post here. */
export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;
  if (!req.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "Expected JSON" }, { status: 415 });
  }
  const actor = guard.user?.email ?? "admin";
  if (!rateLimit({ key: `meta-onboard:${actor}`, max: 5, windowMs: 10 * 60_000 }).ok) {
    return NextResponse.json({ error: "Too many attempts — wait a few minutes" }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const steps =
    parsed.data.intent === "connect"
      ? await completeCoexistenceSignup(parsed.data.code, parsed.data.wabaId)
      : await requestSmbSync(["smb_app_state_sync", "history"]);
  const ok = steps.every((s) => s.ok);
  console.info(JSON.stringify({ event: "WhatsAppOnboarding", intent: parsed.data.intent, actor, ok, steps: steps.map((s) => `${s.step}:${s.ok}`) }));
  return NextResponse.json({ ok, steps });
}
