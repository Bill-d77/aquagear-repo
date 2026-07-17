# Performance Audit — Iteration 1 (2026-07-17) — Score: 90/100

Source: local Lighthouse (mobile emulation) vs live homepage. PSI API anonymous
quota was exhausted; no CrUX field data exists for this origin yet.

| Metric | Value | Target | Status |
|---|---|---|---|
| Performance score | 90 | ≥95 | ⚠️ |
| LCP | 3.2 s | <2.5 s | ❌ |
| CLS | 0 | <0.1 | ✅ |
| TBT | 40 ms | low | ✅ |
| FCP | 1.2 s | — | ✅ |
| TTFB (root doc) | 180 ms | <800 ms | ✅ |
| Accessibility | 95 | ≥95 | ✅ (fixes → expect 100) |
| Best Practices | 100 | ≥95 | ✅ |
| SEO | 100 | 100 | ✅ |

## LCP diagnosis
Hero `next/image` already has `priority` + `sizes="100vw"`. The dominant subpart
was element render delay — the hero section carried `fade-up` (starts at
opacity 0, 0.6 s). Removed in this iteration; re-measure post-deploy.

## Other flagged items (minor)
- unused-javascript ~49 KiB, legacy JS ~14 KiB (framework overhead; low ROI)
- image-delivery ~58 KiB savings (hero jpg could be tighter; optional re-export)
- bfcache blocked by no-store SSR responses (inherent to force-dynamic pages)
