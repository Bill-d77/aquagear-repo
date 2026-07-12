/**
 * Renders a JSON-LD structured-data block. Server component — the object is
 * serialized at render time. Values come from the DB, never fabricated.
 *
 * `<` is escaped so a stray character in product data can't break out of the
 * script tag (the standard JSON-LD XSS guard).
 */
export function JsonLd({ data }: { data: Record<string, unknown> | Record<string, unknown>[] }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
