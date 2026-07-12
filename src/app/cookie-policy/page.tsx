import type { Metadata } from "next";
import { CATEGORY_META, CONSENT_MAX_AGE_DAYS, type CookieCategory } from "@/lib/cookies";
import { CookieSettingsLink } from "@/components/cookies/CookieSettingsLink";

export const metadata: Metadata = {
  title: "Cookie Policy",
  description: "How AquaGear uses cookies and how to manage your consent.",
};

const ORDER: CookieCategory[] = ["essential", "functional", "analytics", "marketing"];

export default function CookiePolicyPage() {
  return (
    <article className="prose mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold tracking-tight">Cookie Policy</h1>
      <p className="mt-4 text-gray-600 dark:text-gray-300">
        AquaGear uses cookies and similar technologies to run the store, remember your preferences,
        and — only with your consent — to measure usage and personalise marketing. You can change or
        withdraw your consent at any time via <CookieSettingsLink />. Your choice is stored for{" "}
        {Math.round(CONSENT_MAX_AGE_DAYS / 30)} months.
      </p>

      <h2 className="mt-8 text-xl font-semibold">Categories we use</h2>
      <div className="mt-4 space-y-4">
        {ORDER.map((cat) => {
          const m = CATEGORY_META[cat];
          return (
            <div key={cat} className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{m.title}</h3>
                {m.locked && <span className="text-xs text-gray-500">(always on)</span>}
              </div>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{m.description}</p>
              <p className="mt-1 text-xs text-gray-400">Retention: {m.expiry}</p>
            </div>
          );
        })}
      </div>

      <h2 className="mt-8 text-xl font-semibold">Managing consent</h2>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
        Essential cookies are always active because the site cannot function without them. All other
        categories are off until you opt in. Withdrawing consent deletes the relevant non-essential
        cookies. Open <CookieSettingsLink /> to review or change your choices.
      </p>
    </article>
  );
}
