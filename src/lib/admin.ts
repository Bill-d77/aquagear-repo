import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { cache } from "react";

/**
 * The session, if it belongs to a user who is an admin *right now*. The role
 * in the JWT is set at login and lives as long as the session (30 days), so a
 * demoted admin would keep access — always re-check the DB (as mobile-admin does).
 */
// cache(): layout + page + actions in one request share a single role query.
const adminSession = cache(async (): Promise<Session | null> => {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  return user?.role === "ADMIN" ? session : null;
});

/**
 * Returns true if the current request belongs to an admin. Read-only check;
 * use requireAdmin() instead when you want to enforce.
 */
export async function isAdmin() {
  return (await adminSession()) !== null;
}

/**
 * Ensures the current request is an admin. Use from server components / pages
 * — redirects unauthenticated/non-admin users to "/". Returns the typed
 * session for downstream use.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await adminSession();
  if (!session) {
    redirect("/");
  }
  return session;
}

/**
 * API-route variant: returns the typed session on success, or a 403
 * NextResponse you can return immediately on failure. Pattern:
 *
 *   const guard = await requireAdminApi();
 *   if (guard instanceof NextResponse) return guard;
 *   // guard.user.role is "ADMIN" here
 */
export async function requireAdminApi(): Promise<Session | NextResponse> {
  const session = await adminSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session;
}

/** Threshold below which a product is considered low stock. */
export const LOW_STOCK_THRESHOLD = 5;

/**
 * Redirect back to an admin page with a human-readable ?error= message.
 * Use for failures an admin can actually hit from the plain-HTML forms —
 * a raw JSON error page loses their context. Tamper-only paths (hidden-field
 * manipulation) can keep returning JSON.
 */
export function redirectWithError(req: Request, path: string, message: string): NextResponse {
  const url = new URL(path, req.url);
  url.searchParams.set("error", message);
  return NextResponse.redirect(url);
}
