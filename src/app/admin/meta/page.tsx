import Link from "next/link";
import type { Metadata } from "next";
import { Webhook } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { metaConfig, maskSecret } from "@/lib/meta/config";
import { checkHealth, getWhatsAppCreds, type ChannelHealth } from "@/lib/meta/client";
import { EmbeddedSignup } from "@/components/admin/EmbeddedSignup";
import { SITE_URL } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Meta · AquaGear Admin" };

const STATUSES = ["", "RECEIVED", "PROCESSING", "PROCESSED", "FAILED", "IGNORED"];
const STATUS_CLASS: Record<string, string> = {
  PROCESSED: "text-green-700",
  FAILED: "text-red-700",
  IGNORED: "text-gray-500",
  RECEIVED: "text-amber-800",
  PROCESSING: "text-sky-800",
};

export default async function MetaPage({ searchParams }: { searchParams: Promise<{ test?: string; status?: string }> }) {
  const sp = await searchParams;
  const cfg = metaConfig();
  const status = STATUSES.includes(sp.status ?? "") ? sp.status ?? "" : "";
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [wa, coex, health, counts, lastEvent, events, igToken, convCounts] = await Promise.all([
    getWhatsAppCreds(),
    coexistenceStatus(weekAgo),
    sp.test ? checkHealth() : null,
    prisma.metaWebhookEvent.groupBy({ by: ["status"], where: { receivedAt: { gte: dayAgo } }, _count: true }),
    prisma.metaWebhookEvent.findFirst({ orderBy: { receivedAt: "desc" }, select: { receivedAt: true } }),
    prisma.metaWebhookEvent.findMany({ where: status ? { status } : {}, orderBy: { receivedAt: "desc" }, take: 50 }),
    prisma.metaCredential.findUnique({ where: { key: "instagram_token" }, select: { updatedAt: true, expiresAt: true } }),
    prisma.conversation.groupBy({ by: ["channel"], where: { messages: { some: {} } }, _count: true }),
  ]);

  const configured = {
    WHATSAPP: !!(wa.phoneNumberId && wa.token),
    INSTAGRAM: !!cfg.instagramEnvToken,
  };
  const webhookState = !cfg.webhookSecrets.length || !cfg.verifyToken
    ? { label: "Not configured — set META_VERIFY_TOKEN and META_APP_SECRET / INSTAGRAM_APP_SECRET", ok: false }
    : !lastEvent
      ? { label: "Waiting for the first delivery", ok: false }
      : Date.now() - lastEvent.receivedAt.getTime() > 7 * 24 * 60 * 60 * 1000
        ? { label: `Inactive — last delivery ${lastEvent.receivedAt.toLocaleString()}`, ok: false }
        : { label: `Healthy — last delivery ${lastEvent.receivedAt.toLocaleString()}`, ok: true };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Webhook className="w-6 h-6 text-gray-400" />
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Meta (WhatsApp & Instagram)</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <ChannelCard
          title="WhatsApp"
          configured={configured.WHATSAPP}
          health={health?.WHATSAPP}
          lines={[
            `Phone number ID: ${wa.phoneNumberId || "—"}`,
            `Token: ${maskSecret(wa.token) || "—"}${wa.source === "signup" ? " (from Embedded Signup)" : wa.source === "env" ? " (from env)" : ""}`,
            `Conversations: ${convCounts.find((c) => c.channel === "WHATSAPP")?._count ?? 0}`,
          ]}
        />
        <ChannelCard
          title="Instagram"
          configured={configured.INSTAGRAM}
          health={health?.INSTAGRAM}
          lines={[
            `Account ID: ${cfg.instagramAccountId || "me"}`,
            `Token: ${maskSecret(cfg.instagramEnvToken) || "—"}`,
            igToken?.expiresAt ? `Token auto-refreshed ${igToken.updatedAt.toLocaleDateString()}, expires ${igToken.expiresAt.toLocaleDateString()}` : "Token not refreshed yet (daily cron)",
            `Conversations: ${convCounts.find((c) => c.channel === "INSTAGRAM")?._count ?? 0}`,
          ]}
        />
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-2 text-sm">
          <h2 className="font-semibold text-gray-900">Webhook</h2>
          <p className={webhookState.ok ? "text-green-700" : "text-amber-800"}>{webhookState.label}</p>
          <p className="text-gray-600 break-all">Callback URL: <code>{SITE_URL}/api/webhooks/meta</code></p>
          <p className="text-gray-600">Graph API: {cfg.graphVersion}</p>
          <p className="text-gray-600">
            Last 24h: {counts.map((c) => `${c._count} ${c.status.toLowerCase()}`).join(", ") || "no deliveries"}
          </p>
        </div>
      </div>
      <Link href="/admin/meta?test=1" className="btn-outline text-sm inline-block">Test connections</Link>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-2 text-sm">
        <h2 className="font-semibold text-gray-900">WhatsApp Business app (coexistence)</h2>
        {cfg.appId && cfg.embeddedSignupConfigId ? (
          <EmbeddedSignup appId={cfg.appId} configId={cfg.embeddedSignupConfigId} graphVersion={cfg.graphVersion} />
        ) : (
          <p className="text-gray-600">Set META_APP_ID and META_ES_CONFIG_ID to connect the WhatsApp Business app number from here.</p>
        )}
        {coex.disconnected ? (
          <p className="font-medium text-red-700">
            ✗ Disconnected {coex.account!.at.toLocaleString()} ({coex.account!.event}
            {coex.account!.reason ? `, ${coex.account!.reason === "PRIMARY_INACTIVITY" ? "phone app not opened for ~14 days" : coex.account!.reason}` : ""}). Reconnect through Embedded Signup.
          </p>
        ) : (
          <p className="text-gray-700">
            {coex.account ? `Last account event: ${coex.account.event} (${coex.account.at.toLocaleString()})` : "No disconnection events received."}
          </p>
        )}
        <p className="text-gray-600">
          History import:{" "}
          {coex.historyDeclined
            ? "declined in the WhatsApp Business app — only new messages sync."
            : coex.historyEvents === 0
              ? "not received (optional — new messages work without it)."
              : `${coex.historyProgress ?? 0}% (${coex.historyEvents} chunks)${coex.historyProgress === 100 ? " — complete" : ""} · ${coex.historicalMessages} messages imported`}
        </p>
        <p className="text-gray-600">
          Phone-app replies synced in the last 7 days: {coex.phoneEchoes}
          {coex.phoneEchoes === 0 && " — if staff replied from the phone, check the smb_message_echoes webhook subscription."}
        </p>
        <p className="text-gray-600">WhatsApp orders (all time): {coex.whatsappOrders}</p>
        <p className="text-amber-800 bg-amber-50 rounded-md px-3 py-2">
          Keep the WhatsApp Business app on the main phone in use: Meta disconnects the API side if it isn&apos;t opened for about 14 days, or if
          the app is reinstalled or moved to another phone. Linked WhatsApp for Windows and WearOS devices don&apos;t sync to this dashboard.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-4 flex flex-wrap items-center justify-between gap-3 border-b">
          <h2 className="font-semibold text-gray-900">Webhook events</h2>
          <div className="flex flex-wrap gap-2 text-sm">
            {STATUSES.map((s) => (
              <Link key={s} href={s ? `/admin/meta?status=${s}` : "/admin/meta"} className={`px-2 py-1 rounded ${s === status ? "bg-sky-700 text-white" : "text-gray-700 hover:bg-gray-100"}`}>
                {s ? s.toLowerCase() : "all"}
              </Link>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-gray-500 bg-gray-50">
              <tr>
                <th className="px-4 py-2">Received</th>
                <th className="px-4 py-2">Channel</th>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {events.map((e) => (
                <tr key={e.id} className="align-top">
                  <td className="px-4 py-2 whitespace-nowrap">{e.receivedAt.toLocaleString()}</td>
                  <td className="px-4 py-2">{e.channel}</td>
                  <td className="px-4 py-2">{e.eventType}</td>
                  <td className={`px-4 py-2 font-medium ${STATUS_CLASS[e.status] ?? ""}`}>
                    {e.status.toLowerCase()}
                    {e.retryCount > 0 && <span className="text-xs text-gray-500"> · {e.retryCount} retr{e.retryCount === 1 ? "y" : "ies"}</span>}
                    {e.status === "FAILED" && (
                      <form action="/api/admin/meta/events/retry" method="post" className="mt-1">
                        <input type="hidden" name="id" value={e.id} />
                        <button className="text-xs text-sky-700 hover:underline">Retry now</button>
                      </form>
                    )}
                  </td>
                  <td className="px-4 py-2 max-w-md">
                    {e.error && <p className="text-xs text-gray-600 break-words">{e.error}</p>}
                    <details>
                      <summary className="cursor-pointer text-xs text-sky-700">Raw payload</summary>
                      <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-x-auto max-h-64">{JSON.stringify(e.payload, null, 2).slice(0, 8000)}</pre>
                    </details>
                  </td>
                </tr>
              ))}
              {events.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No webhook events{status ? ` with status ${status.toLowerCase()}` : ""}.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="px-4 py-3 text-xs text-gray-500 border-t">
          Raw payloads contain customer messages and are deleted after {cfg.eventRetentionDays} days (processed/ignored) by the daily cron.
        </p>
      </div>
    </div>
  );
}

function ChannelCard({ title, configured, health, lines }: { title: string; configured: boolean; health?: ChannelHealth; lines: string[] }) {
  const state = health ?? (configured ? { state: "connected" as const, label: "Configured (click Test connections to verify)" } : { state: "not_configured" as const, label: "Not configured" });
  const color = state.state === "connected" ? "text-green-700" : state.state === "error" ? "text-red-700" : "text-gray-500";
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-2 text-sm">
      <h2 className="font-semibold text-gray-900">{title}</h2>
      <p className={`font-medium ${color}`}>{state.state === "connected" && health ? "✓ " : ""}{state.label}</p>
      {health?.detail && (
        <details>
          <summary className="cursor-pointer text-xs text-sky-700">Technical details</summary>
          <p className="text-xs text-gray-600 break-words mt-1">{health.detail}</p>
        </details>
      )}
      {lines.map((l) => (
        <p key={l} className="text-gray-600 break-all">{l}</p>
      ))}
    </div>
  );
}

/** Coexistence health, read from the webhook event log (no extra tables). */
async function coexistenceStatus(since: Date) {
  const [account] = await prisma.$queryRaw<{ event: string | null; reason: string | null; at: Date }[]>`
    SELECT payload #>> '{entry,0,changes,0,value,event}' AS event,
           payload #>> '{entry,0,changes,0,value,disconnection_info,reason}' AS reason,
           "receivedAt" AS at
    FROM "MetaWebhookEvent" WHERE "eventType" LIKE '%account%' ORDER BY "receivedAt" DESC LIMIT 1`;
  const [history] = await prisma.$queryRaw<{ progress: number | null; events: bigint; declined: boolean }[]>`
    SELECT max(CASE WHEN p ~ '^[0-9]+$' THEN p::int END) AS progress, count(*) AS events,
           bool_or(error LIKE '%2593109%') AS declined
    FROM (SELECT payload #>> '{entry,0,changes,0,value,history,0,metadata,progress}' AS p, error
          FROM "MetaWebhookEvent" WHERE "eventType" LIKE '%history%' OR error LIKE '%history:%') h`;
  const [historicalMessages, phoneEchoes, whatsappOrders] = await Promise.all([
    prisma.message.count({ where: { isHistorical: true } }),
    prisma.message.count({
      where: { direction: "OUTBOUND", sentBy: null, isHistorical: false, externalTimestamp: { gte: since }, conversation: { channel: "WHATSAPP" } },
    }),
    prisma.order.count({ where: { source: "WHATSAPP" } }),
  ]);
  const acc = account?.event ? { event: account.event, reason: account.reason, at: account.at } : null;
  return {
    account: acc,
    disconnected: !!acc && ["ACCOUNT_OFFBOARDED", "PARTNER_REMOVED"].includes(acc.event),
    historyProgress: history?.progress ?? null,
    historyEvents: Number(history?.events ?? 0),
    historyDeclined: !!history?.declined,
    historicalMessages,
    phoneEchoes,
    whatsappOrders,
  };
}
