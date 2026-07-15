/**
 * Runnable self-check for the pageview-tracking helpers.
 * Run: `node src/lib/track.selfcheck.ts`  (Node 22+ strips the types natively)
 */
import assert from "node:assert/strict";
import { parseDevice, parseBrowser, externalReferrerHost, isTrackablePath } from "./track.ts";

// Device buckets
assert.equal(parseDevice("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)"), "mobile");
assert.equal(parseDevice("Mozilla/5.0 (iPad; CPU OS 17_0)"), "tablet");
assert.equal(parseDevice("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)"), "desktop");

// Browser families — order-sensitive UAs
assert.equal(parseBrowser("Mozilla/5.0 Chrome/120.0 Safari/537.36 Edg/120.0"), "Edge");
assert.equal(parseBrowser("Mozilla/5.0 Chrome/120.0 Safari/537.36 OPR/106.0"), "Opera");
assert.equal(parseBrowser("Mozilla/5.0 SamsungBrowser/23.0 Chrome/115.0 Safari/537.36"), "Samsung Internet");
assert.equal(parseBrowser("Mozilla/5.0 Chrome/120.0 Safari/537.36"), "Chrome");
assert.equal(parseBrowser("Mozilla/5.0 Version/17.0 Safari/605.1.15"), "Safari");
assert.equal(parseBrowser("Mozilla/5.0 Gecko/20100101 Firefox/121.0"), "Firefox");
assert.equal(parseBrowser("curl/8.4.0"), "Other");

// Referrers: external kept, same-site/invalid/empty dropped
assert.equal(externalReferrerHost("https://google.com/search?q=x", "aquagear-repo.vercel.app"), "google.com");
assert.equal(externalReferrerHost("https://aquagear-repo.vercel.app/shop", "aquagear-repo.vercel.app"), null);
assert.equal(externalReferrerHost("not a url", "x"), null);
assert.equal(externalReferrerHost(undefined, "x"), null);

// Trackable paths: storefront yes; admin/api/checkout/malformed no
assert.equal(isTrackablePath("/shop"), true);
assert.equal(isTrackablePath("/product/life-jacket"), true);
assert.equal(isTrackablePath("/admin/orders"), false);
assert.equal(isTrackablePath("/api/track"), false);
assert.equal(isTrackablePath("/checkout"), false);
assert.equal(isTrackablePath("relative"), false);
assert.equal(isTrackablePath("/" + "x".repeat(300)), false);

console.log("track.selfcheck: all assertions passed");
