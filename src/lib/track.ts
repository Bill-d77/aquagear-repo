// Pure helpers for first-party pageview tracking. Deliberately coarse —
// ponytail: family-level UA buckets, not a full parser; add ua-parser-js only
// if finer granularity ever matters.

export function parseDevice(ua: string): string {
  if (/iPad|Tablet/i.test(ua)) return "tablet";
  if (/Mobi|Android|iPhone/i.test(ua)) return "mobile";
  return "desktop";
}

export function parseBrowser(ua: string): string {
  // Order matters: Edge/Opera/Samsung UAs also contain "Chrome"; Chrome contains "Safari".
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\/|Opera/.test(ua)) return "Opera";
  if (/SamsungBrowser/.test(ua)) return "Samsung Internet";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\/|CriOS\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua)) return "Safari";
  return "Other";
}

export function parseOs(ua: string): string {
  // Order matters: iPad/iPhone UAs contain "like Mac OS X"; Android contains "Linux".
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/CrOS/i.test(ua)) return "ChromeOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Other";
}

/**
 * Collapse dynamic paths to their route pattern so the Routes list groups
 * per-product traffic. ponytail: /product is the only dynamic storefront route.
 */
export function routePattern(path: string): string {
  return path.startsWith("/product/") ? "/product/[slug]" : path;
}

/** External referrer host, or null for same-site/empty/invalid referrers. */
export function externalReferrerHost(referrer: string | undefined, ownHost: string): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname;
    return host && host !== ownHost ? host : null;
  } catch {
    return null;
  }
}

/** utm_source / utm_medium / utm_campaign from a landing URL's query string. */
export function parseUtm(search: string | undefined): {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
} {
  const empty = { utmSource: null, utmMedium: null, utmCampaign: null };
  if (!search) return empty;
  try {
    const params = new URLSearchParams(search);
    const clean = (v: string | null) => (v ? v.slice(0, 100) : null);
    return {
      utmSource: clean(params.get("utm_source")),
      utmMedium: clean(params.get("utm_medium")),
      utmCampaign: clean(params.get("utm_campaign")),
    };
  } catch {
    return empty;
  }
}

/** Paths worth recording — storefront only. */
export function isTrackablePath(path: string): boolean {
  return (
    path.startsWith("/") &&
    path.length <= 200 &&
    !path.startsWith("/admin") &&
    !path.startsWith("/api") &&
    !path.startsWith("/checkout") // buyer flow stays out of the log (privacy)
  );
}
