"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  ACCEPT_ALL,
  DECLINE_ALL,
  clearNonEssential,
  ensureAnonId,
  readConsent,
  writeConsent,
  type ConsentState,
} from "@/lib/cookies";
import { logConsent } from "@/app/actions/consent";
import { CookieConsentUI } from "./CookieConsent";
import { ThirdPartyScripts } from "./ThirdPartyScripts";

/** Event any component can dispatch to open the preferences modal (e.g. footer link). */
export const OPEN_COOKIE_SETTINGS = "aquagear:open-cookie-settings";
export function openCookieSettings() {
  window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS));
}

type ConsentContextValue = {
  /** null until decided (banner is showing). */
  consent: ConsentState | null;
  decided: boolean;
  acceptAll: () => void;
  rejectNonEssential: () => void;
  save: (state: ConsentState) => void;
  openSettings: () => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error("useConsent must be used inside <ConsentProvider>");
  return ctx;
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentState | null>(null);
  const [decided, setDecided] = useState(true); // assume decided until mount reads the cookie
  const [modalOpen, setModalOpen] = useState(false);

  // Hydrate from the cookie on mount (client-only; server render shows nothing).
  useEffect(() => {
    ensureAnonId();
    const stored = readConsent();
    if (stored) {
      setConsent({ functional: stored.functional, analytics: stored.analytics, marketing: stored.marketing });
      setDecided(true);
    } else {
      setDecided(false); // no valid consent → show banner
    }
    const open = () => setModalOpen(true);
    window.addEventListener(OPEN_COOKIE_SETTINGS, open);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS, open);
  }, []);

  const persist = useCallback((state: ConsentState) => {
    writeConsent(state);
    setConsent(state);
    setDecided(true);
    setModalOpen(false);
    // Withdraw = delete the cookies that category no longer permits.
    if (!state.analytics || !state.marketing || !state.functional) clearNonEssential();
    // Audit trail (best-effort; never blocks the UI).
    logConsent({ anonId: ensureAnonId(), ...state }).catch(() => {});
  }, []);

  const value: ConsentContextValue = {
    consent,
    decided,
    acceptAll: () => persist(ACCEPT_ALL),
    rejectNonEssential: () => persist(DECLINE_ALL),
    save: persist,
    openSettings: () => setModalOpen(true),
  };

  return (
    <ConsentContext.Provider value={value}>
      {children}
      <CookieConsentUI
        showBanner={!decided}
        modalOpen={modalOpen}
        initial={consent}
        onCloseModal={() => setModalOpen(false)}
        onAcceptAll={value.acceptAll}
        onRejectNonEssential={value.rejectNonEssential}
        onSave={value.save}
      />
      {consent && <ThirdPartyScripts consent={consent} />}
    </ConsentContext.Provider>
  );
}
