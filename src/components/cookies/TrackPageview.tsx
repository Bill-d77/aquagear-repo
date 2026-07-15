"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "./ConsentProvider";
import { isTrackablePath } from "@/lib/track";

/**
 * First-party pageview beacon. Fires once per route change, and ONLY when the
 * visitor has opted into analytics cookies (the /api/track endpoint re-checks
 * the consent cookie server-side). document.referrer is sent on the first
 * pageview only — that's the external source; later navigations are internal.
 */
export function TrackPageview() {
  const pathname = usePathname();
  const { consent } = useConsent();
  const firstBeacon = useRef(true);

  useEffect(() => {
    if (!consent?.analytics || !isTrackablePath(pathname)) return;
    const body = JSON.stringify({
      path: pathname,
      referrer: firstBeacon.current ? document.referrer || undefined : undefined,
    });
    firstBeacon.current = false;
    // sendBeacon survives page unloads; fetch keepalive is the fallback.
    if (!navigator.sendBeacon?.("/api/track", new Blob([body], { type: "application/json" }))) {
      fetch("/api/track", { method: "POST", body, headers: { "content-type": "application/json" }, keepalive: true }).catch(() => {});
    }
  }, [pathname, consent?.analytics]);

  return null;
}
