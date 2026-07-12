import { Cookie, Users, CheckCircle, XCircle } from "lucide-react";
import { getConsentStats } from "@/lib/cookie-stats";
import { CATEGORY_META } from "@/lib/cookies";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cookies · AquaGear Admin",
};

export default async function CookieAnalyticsPage() {
  const s = await getConsentStats();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Cookie consent</h2>
        <p className="text-gray-500 mt-2">
          From the consent audit log. Opt-in rates use each visitor&apos;s most recent choice.
        </p>
      </div>

      {s.totalDecisions === 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white p-8 text-center text-gray-500 shadow-sm">
          No consent decisions logged yet. They appear here once visitors interact with the cookie banner.
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Unique visitors" value={s.uniqueVisitors.toString()} icon={Users} sub="Distinct anonymous IDs" />
            <StatCard title="Decisions logged" value={s.totalDecisions.toString()} icon={Cookie} sub={`${s.decisions30d} in last 30 days`} />
            <StatCard title="Accept all" value={`${s.acceptAllPct}%`} icon={CheckCircle} sub="Opted into every category" />
            <StatCard title="Reject all" value={`${s.rejectAllPct}%`} icon={XCircle} sub="Essential only" />
          </div>

          <div className="grid gap-4 lg:grid-cols-7">
            {/* Opt-in by category */}
            <div className="col-span-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold">Opt-in rate by category</h3>
              <div className="space-y-4">
                <OptInBar label={CATEGORY_META.functional.title} pct={s.functionalPct} />
                <OptInBar label={CATEGORY_META.analytics.title} pct={s.analyticsPct} />
                <OptInBar label={CATEGORY_META.marketing.title} pct={s.marketingPct} />
              </div>
            </div>

            {/* By country */}
            <div className="col-span-3 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold">By country</h3>
              {s.byCountry.length === 0 ? (
                <p className="text-sm text-gray-500">No location data.</p>
              ) : (
                <ul className="space-y-2">
                  {s.byCountry.map((c) => (
                    <li key={c.country} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{c.country}</span>
                      <span className="font-medium text-gray-900">{c.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Recent decisions */}
          <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold">Recent decisions</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="pb-2 pr-4 font-medium">When</th>
                    <th className="pb-2 pr-4 font-medium">Country</th>
                    <th className="pb-2 pr-4 font-medium">Functional</th>
                    <th className="pb-2 pr-4 font-medium">Analytics</th>
                    <th className="pb-2 font-medium">Marketing</th>
                  </tr>
                </thead>
                <tbody>
                  {s.recent.map((r, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-4 whitespace-nowrap text-gray-700">
                        {r.createdAt.toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-gray-700">{r.country || "—"}</td>
                      <td className="py-2 pr-4"><YesNo on={r.functional} /></td>
                      <td className="py-2 pr-4"><YesNo on={r.analytics} /></td>
                      <td className="py-2"><YesNo on={r.marketing} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  sub,
}: {
  title: string;
  value: string;
  icon: typeof Cookie;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-500">{title}</span>
        <Icon className="h-5 w-5 text-gray-400" />
      </div>
      <div className="mt-2 text-3xl font-bold text-gray-900">{value}</div>
      <p className="mt-1 text-xs text-gray-500">{sub}</p>
    </div>
  );
}

function OptInBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-gray-700">{label}</span>
        <span className="font-medium text-gray-900">{pct}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-sky-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function YesNo({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
      Yes
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
      No
    </span>
  );
}
