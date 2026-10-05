# Meta (WhatsApp + Instagram) production checklist

Details for every step: [docs/meta-integration.md](docs/meta-integration.md).

### Meta
- [ ] Meta Developer App (type Business) created; separate dev app for testing
- [ ] WhatsApp (coexistence — number stays in the WhatsApp Business app): Tech Provider status
      (Business Verification + App Review), Embedded Signup configuration created
- [ ] WhatsApp webhook verified; **messages, smb_message_echoes, history, smb_app_state_sync, account_update** subscribed
- [ ] Admin → Meta → *Connect WhatsApp Business app* → all steps ✓ (history sync within 24h)
- [ ] Nobody on WhatsApp for Windows / WearOS; companion devices re-linked
- [ ] Instagram account is professional (Business/Creator); *Allow access to messages* on
- [ ] Instagram: long-lived token generated; `instagram_business_basic` + `instagram_business_manage_messages`
- [ ] Instagram webhook verified; **messages, messaging_seen, messaging_postbacks** subscribed; `POST /me/subscribed_apps` done
- [ ] Business verification complete; App Review / Advanced Access done where the dashboard requires it
- [ ] App switched to **Live**

### AquaGear (Vercel → Production env)
- [ ] `META_VERIFY_TOKEN`, `META_APP_SECRET`, `INSTAGRAM_APP_SECRET`
- [ ] `META_APP_ID`, `META_ES_CONFIG_ID` (WhatsApp credentials are stored by Embedded Signup; `WHATSAPP_*` only to override)
- [ ] `INSTAGRAM_ACCESS_TOKEN` (optional `INSTAGRAM_ACCOUNT_ID`)
- [ ] `CRON_SECRET` (Vercel Cron → `/api/cron/meta` daily); optional `META_GRAPH_API_VERSION`, `META_EVENT_RETENTION_DAYS`
- [ ] Production credentials only in Production; dev/preview use the dev app
- [ ] Deploy → migrations `20261001100000_meta_inbox` + `20261005100000_whatsapp_coexistence` applied by `scripts/vercel-migrate.sh`
- [ ] `node scripts/backfill-phones.mjs` (dry run) reviewed, then `--apply`
- [ ] Admin → Meta: *Test connections* shows both channels connected
- [ ] Webhook shows "Healthy" after a test message
- [ ] DM aliases / MPNs filled in for best-selling products
- [ ] Test order: DM → draft in Orders → review → Confirm → stock decremented, Telegram alert received
- [ ] Website checkout order still shows source 🌐 Website
