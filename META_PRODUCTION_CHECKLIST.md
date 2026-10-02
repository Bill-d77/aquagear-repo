# Meta (WhatsApp + Instagram) production checklist

Details for every step: [docs/meta-integration.md](docs/meta-integration.md).

### Meta
- [ ] Meta Developer App (type Business) created; separate dev app for testing
- [ ] WhatsApp: phone number registered to Cloud API, Phone number ID copied
- [ ] WhatsApp: system-user token with `whatsapp_business_messaging` + `whatsapp_business_management`
- [ ] WhatsApp webhook verified, **messages** field subscribed
- [ ] Instagram account is professional (Business/Creator); *Allow access to messages* on
- [ ] Instagram: long-lived token generated; `instagram_business_basic` + `instagram_business_manage_messages`
- [ ] Instagram webhook verified; **messages, messaging_seen, messaging_postbacks** subscribed; `POST /me/subscribed_apps` done
- [ ] Business verification complete; App Review / Advanced Access done where the dashboard requires it
- [ ] App switched to **Live**

### AquaGear (Vercel → Production env)
- [ ] `META_VERIFY_TOKEN`, `META_APP_SECRET`, `INSTAGRAM_APP_SECRET`
- [ ] `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`
- [ ] `INSTAGRAM_ACCESS_TOKEN` (optional `INSTAGRAM_ACCOUNT_ID`)
- [ ] `YCLOUD_WEBHOOK_SECRET` if WhatsApp runs through YCloud coexistence (instead of `WHATSAPP_*`)
- [ ] `CRON_SECRET` (Vercel Cron → `/api/cron/meta` daily); optional `META_GRAPH_API_VERSION`, `META_EVENT_RETENTION_DAYS`
- [ ] Production credentials only in Production; dev/preview use the dev app
- [ ] Deploy → migration `20261001100000_meta_inbox` applied by `scripts/vercel-migrate.sh`
- [ ] Admin → Meta: *Test connections* shows both channels connected
- [ ] Webhook shows "Healthy" after a test message
- [ ] DM aliases / MPNs filled in for best-selling products
- [ ] Test order: DM → draft in Orders → review → Confirm → stock decremented, Telegram alert received
- [ ] Website checkout order still shows source 🌐 Website
