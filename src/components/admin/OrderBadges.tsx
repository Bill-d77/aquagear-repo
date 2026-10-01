const SOURCES: Record<string, { label: string; className: string }> = {
  WEBSITE: { label: "🌐 Website", className: "bg-gray-100 text-gray-700" },
  APP: { label: "📱 App", className: "bg-sky-100 text-sky-800" },
  WHATSAPP: { label: "🟢 WhatsApp", className: "bg-green-100 text-green-800" },
  INSTAGRAM: { label: "📷 Instagram", className: "bg-pink-100 text-pink-800" },
};

export function SourceBadge({ source }: { source: string }) {
  const s = SOURCES[source] ?? { label: source, className: "bg-gray-100 text-gray-700" };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${s.className}`}>{s.label}</span>;
}

const STATUS_CLASS: Record<string, string> = {
  PLACED: "bg-green-100 text-green-700",
  PENDING: "bg-yellow-100 text-yellow-700",
  SHIPPED: "bg-blue-100 text-blue-700",
  NEEDS_REVIEW: "bg-amber-100 text-amber-800",
  PENDING_CONFIRMATION: "bg-violet-100 text-violet-800",
};

export const statusLabel = (s: string) => s.replace(/_/g, " ");

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_CLASS[status] ?? "bg-gray-100 text-gray-700"}`}>
      {statusLabel(status)}
    </span>
  );
}
