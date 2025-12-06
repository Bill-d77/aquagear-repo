export const FALLBACK_IMAGE_URL = "https://images.unsplash.com/photo-1560343076-ec340740dfce?q=80&w=1200&auto=format&fit=crop";

const ALLOWED_HOSTNAMES = new Set<string>([
  "images.unsplash.com",
]);

export function ensureValidImageUrl(input: unknown): string {
  const value = typeof input === "string" ? input.trim() : "";
  if (!value) return FALLBACK_IMAGE_URL;

  // Allow app-hosted static paths
  if (value.startsWith("/")) return value;

  // Only allow selected remote hosts; everything else falls back
  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const url = new URL(value);
      if (ALLOWED_HOSTNAMES.has(url.hostname)) return value;
      // Some links like Google Image redirect contain the real URL in a param; try to extract a safe one
      const embedded = url.searchParams.get("imgurl") || url.searchParams.get("url");
      if (embedded) {
        const inner = new URL(embedded);
        if (ALLOWED_HOSTNAMES.has(inner.hostname)) return inner.toString();
      }
    } catch {
      // ignore parse errors
    }
  }
  return FALLBACK_IMAGE_URL;
} 