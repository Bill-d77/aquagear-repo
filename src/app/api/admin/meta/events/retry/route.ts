export const runtime = "nodejs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin";
import { processEvent } from "@/lib/meta/ingest";

/** Manually retry a failed webhook event from /admin/meta. */
export async function POST(req: Request) {
  const guard = await requireAdminApi();
  if (guard instanceof NextResponse) return guard;

  const id = String((await req.formData()).get("id") ?? "");
  const event = await prisma.metaWebhookEvent.findUnique({ where: { id }, select: { status: true } });
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (event.status === "FAILED") await processEvent(id);

  return NextResponse.redirect(new URL("/admin/meta", req.url));
}
