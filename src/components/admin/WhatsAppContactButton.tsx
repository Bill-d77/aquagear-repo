"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Check } from "lucide-react";

interface Props {
  orderId: string;
  whatsappUrl: string;
  initiallyContactedAt: string | null;
}

export function WhatsAppContactButton({ orderId, whatsappUrl, initiallyContactedAt }: Props) {
  const [contactedAt, setContactedAt] = useState<string | null>(initiallyContactedAt);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    // Open WhatsApp in a new tab first (user gesture preserves the popup).
    window.open(whatsappUrl, "_blank", "noopener,noreferrer");

    // Then mark the order as contacted server-side, optimistically.
    startTransition(async () => {
      try {
        const res = await fetch("/api/admin/orders/whatsapp-contacted", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: orderId }),
        });
        const data = await res.json();
        if (res.ok && data.lastContactedAt) {
          setContactedAt(data.lastContactedAt);
        }
      } catch {
        // Silent — the WhatsApp tab still opened, which is the primary action.
      }
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors disabled:opacity-60"
      >
        <MessageCircle className="w-4 h-4" />
        Open WhatsApp & mark contacted
      </button>
      {contactedAt && (
        <p className="text-xs text-gray-500 flex items-center gap-1">
          <Check className="w-3 h-3 text-emerald-600" />
          Last contacted {new Date(contactedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
