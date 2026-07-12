"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Cookie, X } from "lucide-react";
import { CATEGORY_META, DECLINE_ALL, type ConsentState, type CookieCategory } from "@/lib/cookies";

const TOGGLEABLE = ["functional", "analytics", "marketing"] as const satisfies readonly (keyof ConsentState)[];

type Props = {
  showBanner: boolean;
  modalOpen: boolean;
  initial: ConsentState | null;
  onCloseModal: () => void;
  onAcceptAll: () => void;
  onRejectNonEssential: () => void;
  onSave: (state: ConsentState) => void;
};

export function CookieConsentUI(props: Props) {
  const { showBanner, modalOpen } = props;
  if (!showBanner && !modalOpen) return null;

  return (
    <>
      {showBanner && !modalOpen && <Banner {...props} />}
      {modalOpen && <PreferencesModal {...props} />}
    </>
  );
}

function Banner({ onAcceptAll, onRejectNonEssential, onCloseModal, ...p }: Props) {
  // Banner uses the same modal-open channel: "Customize" tells the parent to open it.
  const openCustomize = () => window.dispatchEvent(new Event("aquagear:open-cookie-settings"));

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Cookie consent"
      className="fixed inset-x-0 bottom-0 z-[60] fade-up border-t border-gray-200 bg-white/95 backdrop-blur px-4 py-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] dark:border-gray-700 dark:bg-gray-900/95 sm:px-6"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <Cookie className="mt-0.5 h-6 w-6 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
          <p className="text-sm text-gray-700 dark:text-gray-200">
            We use cookies for essential site functions and — with your consent — for functional
            preferences, analytics and marketing. See our{" "}
            <Link href="/cookie-policy" className="font-medium text-sky-700 underline dark:text-sky-400">
              Cookie Policy
            </Link>{" "}
            and{" "}
            <Link href="/privacy-policy" className="font-medium text-sky-700 underline dark:text-sky-400">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:shrink-0">
          <button
            onClick={openCustomize}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Customize
          </button>
          <button
            onClick={onRejectNonEssential}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Reject non-essential
          </button>
          <button
            onClick={onAcceptAll}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            Accept all
          </button>
        </div>
      </div>
    </div>
  );
}

function PreferencesModal({ initial, onCloseModal, onAcceptAll, onSave }: Props) {
  const [state, setState] = useState<ConsentState>(initial ?? DECLINE_ALL);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseModal();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCloseModal]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onCloseModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-prefs-title"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl dark:bg-gray-900 sm:rounded-2xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id="cookie-prefs-title" className="text-lg font-bold text-gray-900 dark:text-white">
            Cookie preferences
          </h2>
          <button
            ref={closeRef}
            onClick={onCloseModal}
            aria-label="Close"
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-3">
          {/* Essential — always on, locked */}
          <CategoryRow category="essential" checked disabled onChange={() => {}} />
          {TOGGLEABLE.map((cat) => (
            <CategoryRow
              key={cat}
              category={cat}
              checked={state[cat]}
              onChange={(v) => setState((s) => ({ ...s, [cat]: v }))}
            />
          ))}
        </div>

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            onClick={() => onSave(state)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Save preferences
          </button>
          <button
            onClick={onAcceptAll}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2"
          >
            Accept all
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400">
          <Link href="/cookie-policy" className="underline hover:text-gray-600 dark:hover:text-gray-300">
            Cookie Policy
          </Link>
          {" · "}
          <Link href="/privacy-policy" className="underline hover:text-gray-600 dark:hover:text-gray-300">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}

function CategoryRow({
  category,
  checked,
  disabled,
  onChange,
}: {
  category: CookieCategory;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  const meta = CATEGORY_META[category];
  return (
    <label
      className={`flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700 ${
        disabled ? "opacity-70" : "hover:border-sky-300"
      }`}
    >
      <div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 dark:text-white">{meta.title}</span>
          {meta.locked && (
            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              Always on
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{meta.description}</p>
        <p className="mt-1 text-xs text-gray-400">Stored: {meta.expiry}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={meta.title}
        className="mt-1 h-5 w-5 shrink-0 accent-sky-600 disabled:cursor-not-allowed"
      />
    </label>
  );
}
