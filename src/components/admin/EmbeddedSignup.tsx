"use client";

import { useEffect, useRef, useState } from "react";

// Meta's Embedded Signup for WhatsApp Business app users (coexistence): the
// owner scans a QR code from the WhatsApp Business app and the number gets
// connected to our Meta app while it keeps working on the phone. Launch
// options per developers.facebook.com/documentation/business-messaging/
// whatsapp/embedded-signup/onboarding-business-app-users (checked 2026-10-05).

type Step = { step: string; ok: boolean; detail?: string };
type FBLoginResponse = { authResponse?: { code?: string } | null };
declare global {
  interface Window {
    FB?: {
      init: (o: Record<string, unknown>) => void;
      login: (cb: (r: FBLoginResponse) => void, o: Record<string, unknown>) => void;
    };
    fbAsyncInit?: () => void;
  }
}

export function EmbeddedSignup({ appId, configId, graphVersion }: { appId: string; configId: string; graphVersion: string }) {
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  // The code (FB.login callback) and the WABA id (session-info message) arrive separately.
  const pending = useRef<{ code?: string; wabaId?: string }>({});

  useEffect(() => {
    window.fbAsyncInit = () => {
      window.FB!.init({ appId, autoLogAppEvents: true, xfbml: true, version: graphVersion });
      setReady(true);
    };
    if (window.FB) window.fbAsyncInit();
    else if (!document.getElementById("facebook-jssdk")) {
      const s = document.createElement("script");
      s.id = "facebook-jssdk";
      s.src = "https://connect.facebook.net/en_US/sdk.js";
      s.async = true;
      s.crossOrigin = "anonymous";
      document.body.appendChild(s);
    }

    const onMessage = (event: MessageEvent) => {
      if (!event.origin.endsWith("facebook.com")) return;
      let data: { type?: string; event?: string; data?: { waba_id?: string; current_step?: string; error_message?: string } };
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      if (data?.type !== "WA_EMBEDDED_SIGNUP") return;
      if (data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" && data.data?.waba_id) {
        pending.current.wabaId = data.data.waba_id;
        void finish();
      } else if (data.event === "CANCEL") {
        setBusy(false);
        setMessage(`Signup was closed${data.data?.current_step ? ` at "${data.data.current_step}"` : ""}. Nothing was connected.`);
      } else if (data.event === "ERROR") {
        setBusy(false);
        setMessage(`Meta reported an error: ${data.data?.error_message ?? "unknown"}`);
      } else if (data.event?.startsWith("FINISH")) {
        setBusy(false);
        setMessage("Meta finished a regular (non-coexistence) signup. This page only connects an existing WhatsApp Business app number.");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once
  }, []);

  async function finish() {
    const { code, wabaId } = pending.current;
    if (!code || !wabaId) return; // wait for the other half
    pending.current = {};
    setMessage("Connecting… don't close this page.");
    const res = await fetch("/api/admin/meta/onboard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intent: "connect", code, wabaId }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    setSteps(body.steps ?? []);
    setMessage(body.ok ? "Connected. Messages from the phone will start appearing in the inbox." : body.error ?? "Some steps failed — see below.");
  }

  function launch() {
    setBusy(true);
    setSteps([]);
    setMessage("Follow the steps in the Meta window, then scan the QR code with the WhatsApp Business app on the phone.");
    window.FB!.login(
      (r) => {
        const code = r.authResponse?.code;
        if (!code) {
          setBusy(false);
          setMessage("Signup was cancelled.");
          return;
        }
        pending.current.code = code;
        void finish();
      },
      {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "whatsapp_business_app_onboarding", sessionInfoVersion: "3" },
      },
    );
  }

  async function resync() {
    setBusy(true);
    const res = await fetch("/api/admin/meta/onboard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ intent: "sync" }),
    }).catch(() => null);
    const body = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    setSteps(body.steps ?? []);
    setMessage(body.ok ? "Sync requested — contacts and history arrive over the next minutes." : body.error ?? "Sync request failed.");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={launch} disabled={!ready || busy} className="btn-primary text-sm">
          {ready ? "Connect WhatsApp Business app" : "Loading Meta…"}
        </button>
        <button type="button" onClick={resync} disabled={busy} className="btn-outline text-sm">
          Re-request contacts + history sync
        </button>
      </div>
      {message && <p className="text-sm text-gray-700" role="status">{message}</p>}
      {steps.length > 0 && (
        <ul className="text-sm space-y-1">
          {steps.map((s) => (
            <li key={s.step} className={s.ok ? "text-green-700" : "text-red-700"}>
              {s.ok ? "✓" : "✗"} {s.step}
              {s.detail && <span className="text-gray-600"> — {s.detail}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
