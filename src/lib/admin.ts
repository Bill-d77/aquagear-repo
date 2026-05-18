import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

/**
 * Returns true if the current request belongs to an admin. Read-only check;
 * use requireAdmin() instead when you want to enforce.
 */
export async function isAdmin() {
  const session = await auth();
  return session?.user?.role === "ADMIN";
}

/**
 * Ensures the current request is an admin. Use from server components / pages
 * — redirects unauthenticated/non-admin users to "/". Returns the typed
 * session for downstream use.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
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
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session;
}

/** Threshold below which a product is considered low stock. */
export const LOW_STOCK_THRESHOLD = 5;
