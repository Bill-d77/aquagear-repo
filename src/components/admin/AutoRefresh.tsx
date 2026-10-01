"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// ponytail: polling via router.refresh() instead of websockets — the app has no
// realtime infrastructure and a handful of admins. Swap for SSE/realtime if
// the inbox ever needs sub-second updates.
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}
