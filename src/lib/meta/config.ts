// Server-only Meta configuration. Read at call time (not module load) so a
// missing credential degrades that one feature instead of crashing the app.

// Verified current on 2026-10-01 (Graph API changelog: v26.0 released 2026-07-29).
const DEFAULT_GRAPH_VERSION = "v26.0";

export const metaConfig = () => ({
  graphVersion: process.env.META_GRAPH_API_VERSION || DEFAULT_GRAPH_VERSION,
  verifyToken: process.env.META_VERIFY_TOKEN || "",
  // WhatsApp deliveries are signed with the Meta app secret; Instagram-Login
  // deliveries with the Instagram app secret. Either may be set.
  webhookSecrets: [process.env.META_APP_SECRET, process.env.INSTAGRAM_APP_SECRET].filter((s): s is string => !!s),
  // Embedded Signup (connect the WhatsApp Business app number from /admin/meta).
  appId: process.env.META_APP_ID || "",
  appSecret: process.env.META_APP_SECRET || "",
  embeddedSignupConfigId: process.env.META_ES_CONFIG_ID || "",
  // Optional overrides; normally stored by Embedded Signup (MetaCredential "whatsapp").
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
  whatsappToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
  instagramAccountId: process.env.INSTAGRAM_ACCOUNT_ID || "",
  instagramEnvToken: process.env.INSTAGRAM_ACCESS_TOKEN || "",
  eventRetentionDays: Math.max(1, Number(process.env.META_EVENT_RETENTION_DAYS) || 30),
});

/** "••••••••abcd" — enough to tell tokens apart, never enough to use one. */
export const maskSecret = (s: string) => (s ? `${"•".repeat(8)}${s.slice(-4)}` : "");
