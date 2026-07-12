"use client";

/**
 * Consent-gated third-party scripts. Each block renders ONLY after the matching
 * consent is granted, so nothing loads on first paint and nothing loads without
 * permission (GDPR/ePrivacy). Every id comes from a public env var — if the var
 * is unset the block is inert, so this file is safe to ship before the marketing
 * accounts exist. Set the env vars in Vercel to activate:
 *
 *   NEXT_PUBLIC_GA_ID          e.g. G-XXXXXXXXXX   (Google Analytics 4 / Google Ads via gtag)
 *   NEXT_PUBLIC_META_PIXEL_ID  e.g. 1234567890     (Meta Pixel)
 *
 * ponytail: GA4 + Meta cover the stated needs. Add TikTok/GTM here the same way
 * (one <Script> guarded by its env id + consent) when those accounts exist.
 */

import Script from "next/script";
import type { ConsentState } from "@/lib/cookies";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

export function ThirdPartyScripts({ consent }: { consent: ConsentState }) {
  return (
    <>
      {GA_ID && consent.analytics && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('consent', 'default', {
                ad_storage: '${consent.marketing ? "granted" : "denied"}',
                ad_user_data: '${consent.marketing ? "granted" : "denied"}',
                ad_personalization: '${consent.marketing ? "granted" : "denied"}',
                analytics_storage: 'granted'
              });
              gtag('config', '${GA_ID}');
            `}
          </Script>
        </>
      )}

      {META_PIXEL_ID && consent.marketing && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${META_PIXEL_ID}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
