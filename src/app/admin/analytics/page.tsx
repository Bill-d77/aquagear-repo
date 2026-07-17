import Link from "next/link";
import {
  DollarSign, ShoppingBag, TrendingUp, Users, UserPlus, Repeat,
  Package, Cookie, ArrowRight, BarChart3,
} from "lucide-react";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { TrafficChart } from "@/components/admin/TrafficChart";
import { getAnalytics, getTraffic, RANGES, type RangeKey } from "@/lib/analytics";
import { getConsentStats } from "@/lib/cookie-stats";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Analytics · AquaGear Admin" };

const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

type Delta = { text: string; dir: "up" | "down" | "flat" } | null;

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

/** "LB" → "🇱🇧 Lebanon"; leaves non-ISO labels (e.g. "Unknown") untouched. */
function countryLabel(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return code;
  const flag = code.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
  let name: string | undefined;
  try {
    name = regionNames.of(code);
  } catch {
    name = undefined;
  }
  return `${flag} ${name ?? code}`;
}

/** Percent change vs the previous period; null when both periods are empty. */
function pctDelta(current: number, previous: number): Delta {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return { text: "new", dir: "up" };
  const pct = Math.round(((current - previous) / previous) * 100);
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, dir: pct > 0 ? "up" : pct < 0 ? "down" : "flat" };
}

/** Percentage-point change, for metrics that are already percentages. */
function pointsDelta(current: number, previous: number): Delta {
  if (previous === 0 && current === 0) return null;
  const pp = current - previous;
  return { text: `${pp > 0 ? "+" : ""}${pp}pp`, dir: pp > 0 ? "up" : pp < 0 ? "down" : "flat" };
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range: rangeParam } = await searchParams;
  const range: RangeKey = (RANGES.find((r) => r.key === rangeParam)?.key ?? "30d") as RangeKey;

  const [a, traffic, consent] = await Promise.all([getAnalytics(range), getTraffic(range), getConsentStats()]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Analytics</h2>
          <p className="mt-2 text-gray-500">Sales, customers, and consent — from your live data.</p>
        </div>
        {/* Date range filter */}
        <div className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/admin/analytics?range=${r.key}`}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                r.key === range ? "bg-sky-700 text-white" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {r.label}
            </Link>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi title="Revenue" value={money(a.revenue)} icon={DollarSign} sub="Placed + shipped" delta={pctDelta(a.revenue, a.prev.revenue)} />
        <Kpi title="Orders" value={a.orders.toString()} icon={ShoppingBag} sub={`${a.cartsCreated} carts started`} delta={pctDelta(a.orders, a.prev.orders)} />
        <Kpi title="Avg order value" value={money(a.aov)} icon={TrendingUp} sub="Revenue ÷ orders" delta={pctDelta(a.aov, a.prev.aov)} />
        <Kpi title="Cart → order" value={`${a.conversion}%`} icon={BarChart3} sub={`${a.cartAbandonment}% abandoned`} delta={pointsDelta(a.conversion, a.prev.conversion)} />
        <Kpi title="New customers" value={a.newCustomers.toString()} icon={UserPlus} sub="Signed up in range" delta={pctDelta(a.newCustomers, a.prev.newCustomers)} />
        <Kpi title="Returning buyers" value={a.returningCustomers.toString()} icon={Repeat} sub="More than one order (all-time)" />
        <Kpi title="Registered orders" value={a.registeredOrders.toString()} icon={Users} sub={`${a.guestOrders} guest orders`} />
        <Kpi title="Shipped" value={a.shippedCount.toString()} icon={Package} sub="Fulfilled in range" />
      </div>

      {/* Revenue trend + order funnel */}
      <div className="grid gap-4 lg:grid-cols-7">
        <div className="col-span-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Revenue over time</h3>
          <RevenueChart data={a.chart} />
        </div>
        <div className="col-span-3 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Order funnel</h3>
          <Funnel carts={a.cartsCreated} orders={a.orders} shipped={a.shippedCount} />
        </div>
      </div>

      {/* Best sellers + top customers */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Best sellers</h3>
          {a.bestSellers.length === 0 ? (
            <p className="text-sm text-gray-500">No sales in this range.</p>
          ) : (
            <ul className="space-y-3">
              {a.bestSellers.map((p) => (
                <li key={p.slug} className="flex items-center justify-between gap-4 text-sm">
                  <Link href={`/product/${p.slug}`} className="truncate font-medium text-gray-900 hover:text-sky-700">{p.name}</Link>
                  <span className="shrink-0 text-gray-500">{p.units} sold · {money(p.revenue)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Top customers</h3>
          {a.topCustomers.length === 0 ? (
            <p className="text-sm text-gray-500">No registered-customer orders in this range.</p>
          ) : (
            <ul className="space-y-3">
              {a.topCustomers.map((c) => (
                <li key={c.email} className="flex items-center justify-between gap-4 text-sm">
                  <span className="min-w-0"><span className="block truncate font-medium text-gray-900">{c.name}</span><span className="block truncate text-xs text-gray-500">{c.email}</span></span>
                  <span className="shrink-0 text-gray-500">{money(c.spent)} · {c.orders} orders</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Traffic — first-party pageview log (visitors who opted into analytics cookies) */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <BarChart3 className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold">Traffic</h3>
          <span className="text-xs text-gray-400">consented visitors only, in range</span>
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-700" />
            </span>
            {traffic.activeNow} active now
          </span>
        </div>
        {traffic.pageviews === 0 ? (
          <p className="text-sm text-gray-500">
            No pageviews recorded yet. Tracking starts as visitors accept analytics cookies; data is
            retained for 90 days.
          </p>
        ) : (
          <>
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-2xl font-bold text-gray-900">{traffic.pageviews.toLocaleString()}</div>
                <div className="text-sm text-gray-500">Pageviews</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{traffic.visitors.toLocaleString()}</div>
                <div className="text-sm text-gray-500">Unique visitors</div>
              </div>
            </div>
            <div className="mb-6">
              <h4 className="mb-2 text-sm font-semibold text-gray-700">Pageviews over time</h4>
              <TrafficChart data={traffic.chart} />
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <TopList title="Top pages" items={traffic.topPages} />
              <TopList title="Routes" items={traffic.routes} />
              <TopList
                title="Countries"
                items={traffic.countries.map((c) => ({ ...c, label: countryLabel(c.label) }))}
                percentOf={traffic.pageviews}
              />
              <TopList title="Referrers" items={traffic.referrers} empty="Direct traffic only so far" />
              <TopList title="Devices" items={traffic.devices} percentOf={traffic.pageviews} />
              <TopList title="Browsers" items={traffic.browsers} percentOf={traffic.pageviews} />
              <TopList title="Operating systems" items={traffic.oses} percentOf={traffic.pageviews} />
              <TopList title="UTM sources" items={traffic.sources} empty="No campaign-tagged visits yet" />
              <TopList title="UTM medium" items={traffic.mediums} empty="No campaign-tagged visits yet" />
              <TopList title="Campaigns" items={traffic.campaigns} empty="No campaign-tagged visits yet" />
            </div>
          </>
        )}
      </div>

      {/* Visitors & consent (from the cookie audit log — the only first-party visitor signal stored) */}
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Cookie className="h-5 w-5 text-gray-400" />
          <h3 className="text-lg font-semibold">Visitors &amp; consent</h3>
          <span className="text-xs text-gray-400">all-time</span>
        </div>
        {consent.totalDecisions === 0 ? (
          <p className="text-sm text-gray-500">No consent decisions logged yet.</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-1">
              <div className="text-2xl font-bold text-gray-900">{consent.uniqueVisitors}</div>
              <div className="text-sm text-gray-500">Unique visitors (consent IDs)</div>
              <div className="text-xs text-gray-400">{consent.decisions30d} decisions in 30d</div>
            </div>
            <div className="space-y-2 md:col-span-2">
              <OptIn label="Accept all" pct={consent.acceptAllPct} />
              <OptIn label="Analytics opt-in" pct={consent.analyticsPct} />
              <OptIn label="Marketing opt-in" pct={consent.marketingPct} />
            </div>
          </div>
        )}

        {/* Honest scope note */}
        <div className="mt-6 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-600">
          <p className="font-medium text-gray-800">Not shown here (no data pipeline yet)</p>
          <p className="mt-1">
            Device, browser, geography, referrers, and pageviews now come from the first-party consent-gated
            pageview log above (all-visitor totals live in <strong>Vercel Web Analytics</strong>). Heatmaps,
            scroll depth, search analytics, UTM attribution, and predictive insights still need richer event
            tracking before they can be shown without guessing.
          </p>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  title,
  value,
  icon: Icon,
  sub,
  delta,
}: {
  title: string;
  value: string;
  icon: typeof DollarSign;
  sub: string;
  delta?: Delta;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-gray-900">{value}</span>
        {delta && (
          <span
            className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
              delta.dir === "up"
                ? "bg-emerald-50 text-emerald-700"
                : delta.dir === "down"
                  ? "bg-red-50 text-red-700"
                  : "bg-gray-100 text-gray-500"
            }`}
            title="vs previous period"
          >
            {delta.dir === "up" ? "▲" : delta.dir === "down" ? "▼" : "–"} {delta.text}
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-500">{sub}</p>
    </div>
  );
}

function Funnel({ carts, orders, shipped }: { carts: number; orders: number; shipped: number }) {
  const stages = [
    { label: "Carts started", value: carts },
    { label: "Orders placed", value: orders },
    { label: "Shipped", value: shipped },
  ];
  const max = Math.max(carts, 1);
  return (
    <div className="space-y-3">
      {stages.map((s, i) => {
        const pctOfTop = Math.round((s.value / max) * 100);
        const conv = i === 0 ? 100 : carts > 0 ? Math.round((s.value / carts) * 100) : 0;
        return (
          <div key={s.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-gray-700">{s.label}</span>
              <span className="font-medium text-gray-900">{s.value} <span className="text-gray-400">({conv}%)</span></span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-sky-700" style={{ width: `${pctOfTop}%` }} />
            </div>
          </div>
        );
      })}
      <p className="flex items-center gap-1 pt-1 text-xs text-gray-500">
        <ArrowRight size={12} /> {carts - orders} carts abandoned before ordering
      </p>
    </div>
  );
}

function TopList({
  title,
  items,
  empty,
  percentOf,
}: {
  title: string;
  items: { label: string; count: number }[];
  empty?: string;
  /** When set, show each row as a % of this total instead of a raw count. */
  percentOf?: number;
}) {
  const max = Math.max(...items.map((i) => i.count), 1);
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-gray-700">{title}</h4>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400">{empty ?? "No data yet"}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((i) => (
            <li key={i.label} className="text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-gray-700">{i.label}</span>
                <span className="shrink-0 font-medium text-gray-900">
                  {percentOf ? `${Math.round((i.count / Math.max(percentOf, 1)) * 100)}%` : i.count.toLocaleString()}
                </span>
              </div>
              <div className="mt-0.5 h-1 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-sky-500" style={{ width: `${Math.round((i.count / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function OptIn({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="font-medium text-gray-900">{pct}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-sky-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
