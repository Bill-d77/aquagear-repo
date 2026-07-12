"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { z } from "zod";
import { CONSENT_VERSION } from "@/lib/cookies";

const consentInput = z.object({
  anonId: z.string().min(1).max(64),
  functional: z.boolean(),
  analytics: z.boolean(),
  marketing: z.boolean(),
});

export type ConsentLogInput = z.infer<typeof consentInput>;

/**
 * Append one row to the consent audit trail. Fire-and-forget from the client;
 * failures are swallowed so logging can never block the user's choice from
 * taking effect (the cookie is the source of truth for the browser).
 */
export async function logConsent(raw: ConsentLogInput): Promise<void> {
  const parsed = consentInput.safeParse(raw);
  if (!parsed.success) return;

  try {
    const session = await auth().catch(() => null);
    const h = await headers();
    await prisma.cookieConsent.create({
      data: {
        anonId: parsed.data.anonId,
        userId: session?.user?.id || null,
        version: CONSENT_VERSION,
        functional: parsed.data.functional,
        analytics: parsed.data.analytics,
        marketing: parsed.data.marketing,
        country: h.get("x-vercel-ip-country") || null,
        userAgent: h.get("user-agent")?.slice(0, 300) || null,
      },
    });
  } catch (err) {
    console.error("logConsent failed:", err);
  }
}
