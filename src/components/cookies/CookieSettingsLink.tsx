"use client";

import { openCookieSettings } from "./ConsentProvider";

/** Inline "Cookie Settings" trigger usable inside server-rendered prose. */
export function CookieSettingsLink({ children = "Cookie Settings" }: { children?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      className="font-medium text-sky-700 underline dark:text-sky-400"
    >
      {children}
    </button>
  );
}
