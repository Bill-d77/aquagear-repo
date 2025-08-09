export const FALLBACK_IMAGE_URL = "https://images.unsplash.com/photo-1520971383572-9d5d42baacb6?q=80&w=1200&auto=format&fit=crop";

export function ensureValidImageUrl(input: unknown): string {
  const value = typeof input === "string" ? input.trim() : "";
  if (!value) return FALLBACK_IMAGE_URL;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return value;
  return FALLBACK_IMAGE_URL;
} 