/**
 * Single source of truth for cookie handling on AquaGear.
 *
 * - Generic CRUD (get/set/remove/has) — browser-only, no-ops on the server.
 * - Consent state, versioning, and category metadata used by the banner,
 *   the preferences modal, the consent-gated script loader, and the DB log.
 *
 * Auth cookies (Auth.js) and the shopping-cart cookie are managed elsewhere and
 * intentionally NOT duplicated here — this module only owns consent-scoped and
 * client-set cookies. `parse*`/`serialize*` are pure/isomorphic so they can run
 * on the server and in the self-check.
 */

export const CONSENT_COOKIE = "ag_consent";
export const ANON_ID_COOKIE = "ag_anon"; // essential: ties consent audit rows to a browser
export const CONSENT_VERSION = 1; // bump to force re-consent after policy changes
export const CONSENT_MAX_AGE_DAYS = 365; // 12 months (GDPR/ePrivacy re-ask window)

export type CookieCategory = "essential" | "functional" | "analytics" | "marketing";

/** The three toggleable categories. Essential is always on and never stored as a choice. */
export type ConsentState = {
  functional: boolean;
  analytics: boolean;
  marketing: boolean;
};

export const DECLINE_ALL: ConsentState = { functional: false, analytics: false, marketing: false };
export const ACCEPT_ALL: ConsentState = { functional: true, analytics: true, marketing: true };

/** Category descriptions + declared cookie expiries — rendered by the modal and cookie policy. */
export const CATEGORY_META: Record<
  CookieCategory,
  { title: string; description: string; expiry: string; locked?: boolean }
> = {
  essential: {
    title: "Essential",
    description:
      "Required for the site to work: authentication, session, CSRF protection, shopping cart, checkout, security and rate limiting. Always on.",
    expiry: "Session – 30 days",
    locked: true,
  },
  functional: {
    title: "Functional",
    description:
      "Remembers your preferences: language, currency, region, theme, layout, wishlist and recently viewed items.",
    expiry: "365 days",
  },
  analytics: {
    title: "Analytics",
    description:
      "Anonymous usage measurement (Google Analytics 4, internal analytics) to understand journeys and improve the store.",
    expiry: "Up to 13 months",
  },
  marketing: {
    title: "Marketing",
    description:
      "Advertising and attribution (Meta Pixel, Google Ads, campaign/UTM tracking) to measure and personalise ads.",
    expiry: "Up to 90 days",
  },
};

type ConsentPayload = ConsentState & { v: number; ts: string };
export type StoredConsent = ConsentState & { ts: string };

export function serializeConsent(state: ConsentState, ts = new Date().toISOString()): string {
  const payload: ConsentPayload = { ...state, v: CONSENT_VERSION, ts };
  return JSON.stringify(payload);
}

/**
 * Returns null when the cookie is absent, malformed, or from an older consent
 * version — any of those means "no valid consent on record", so the banner shows.
 */
export function parseConsent(raw: string | undefined | null): StoredConsent | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<ConsentPayload>;
    if (p.v !== CONSENT_VERSION) return null;
    return {
      functional: !!p.functional,
      analytics: !!p.analytics,
      marketing: !!p.marketing,
      ts: typeof p.ts === "string" ? p.ts : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Generic cookie CRUD — browser only. On the server these are safe no-ops so
// the same module can be imported anywhere.
// ---------------------------------------------------------------------------

export function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const esc = name.replace(/([.*+?^${}()|[\]\\])/g, "\\$1");
  const m = document.cookie.match(new RegExp("(?:^|; )" + esc + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : undefined;
}

export function setCookie(name: string, value: string, maxAgeDays: number) {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  const maxAge = Math.round(maxAgeDays * 86400);
  document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Lax${secure}`;
}

export function removeCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function hasCookie(name: string): boolean {
  return getCookie(name) !== undefined;
}

// ---------------------------------------------------------------------------
// Consent-aware helpers
// ---------------------------------------------------------------------------

export function readConsent(): StoredConsent | null {
  return parseConsent(getCookie(CONSENT_COOKIE));
}

export function writeConsent(state: ConsentState) {
  setCookie(CONSENT_COOKIE, serializeConsent(state), CONSENT_MAX_AGE_DAYS);
}

/** Stable anonymous id for the consent audit trail; created once, essential-scoped. */
export function ensureAnonId(): string {
  const existing = getCookie(ANON_ID_COOKIE);
  if (existing) return existing;
  const id =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  setCookie(ANON_ID_COOKIE, id, CONSENT_MAX_AGE_DAYS);
  return id;
}

// Cookies that must survive a reject / consent-withdrawal. Everything else that
// is visible to JS gets cleared. HttpOnly auth cookies aren't JS-visible and are
// left untouched by design (Auth.js owns them). ponytail: prefix allowlist —
// add a name here when a new essential JS-visible cookie is introduced.
const ESSENTIAL_PREFIXES = [
  CONSENT_COOKIE,
  ANON_ID_COOKIE,
  "cartId",
  "authjs.",
  "__Secure-authjs.",
  "__Host-authjs.",
  "next-auth.",
];

function isEssential(name: string): boolean {
  return ESSENTIAL_PREFIXES.some((p) => name === p || name.startsWith(p));
}

/** Delete every non-essential JS-visible cookie — used on reject / withdrawal. */
export function clearNonEssential() {
  if (typeof document === "undefined") return;
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0].trim();
    if (name && !isEssential(name)) removeCookie(name);
  }
}
