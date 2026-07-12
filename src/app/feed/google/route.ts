export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { ensureValidImageUrl } from "@/lib/images";

// Google Merchant Center product feed (RSS 2.0 + g: namespace).
// Every in-catalog product is included; identifier_exists is set to "no" when a
// product has no GTIN and no brand+MPN, which Google permits.

const xmlEscape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const abs = (u: string) => (u.startsWith("http") ? u : `${SITE_URL}${u.startsWith("/") ? "" : "/"}${u}`);

export async function GET() {
  const products = await prisma.product.findMany({
    where: { isArchived: false },
    include: { category: { select: { name: true } }, images: { orderBy: { order: "asc" }, select: { url: true } } },
  });

  const items = products
    .map((p) => {
      const image = ensureValidImageUrl(p.imageUrl) || p.images[0]?.url;
      if (!image) return null; // Merchant requires an image link.

      const extraImages = [...new Set(p.images.map((i) => i.url))]
        .filter((u) => u && u !== p.imageUrl)
        .slice(0, 10)
        .map((u) => `<g:additional_image_link>${xmlEscape(abs(u))}</g:additional_image_link>`)
        .join("");

      const hasIdentifier = !!p.gtin || (!!p.brand && !!p.mpn);
      const price = `${(p.price / 100).toFixed(2)} USD`;

      return `<item>
<g:id>${xmlEscape(p.id)}</g:id>
<g:title>${xmlEscape(p.name)}</g:title>
<g:description>${xmlEscape(p.description.replace(/\s+/g, " ").trim())}</g:description>
<g:link>${xmlEscape(abs(`/product/${p.slug}`))}</g:link>
<g:image_link>${xmlEscape(abs(image))}</g:image_link>
${extraImages}
<g:availability>${p.stock > 0 ? "in_stock" : "out_of_stock"}</g:availability>
<g:price>${price}</g:price>
<g:condition>${xmlEscape(p.condition || "new")}</g:condition>
<g:brand>${xmlEscape(p.brand || "AquaGear")}</g:brand>
${p.gtin ? `<g:gtin>${xmlEscape(p.gtin)}</g:gtin>` : ""}
${p.mpn ? `<g:mpn>${xmlEscape(p.mpn)}</g:mpn>` : ""}
<g:identifier_exists>${hasIdentifier ? "yes" : "no"}</g:identifier_exists>
<g:product_type>${xmlEscape(p.category.name)}</g:product_type>
${p.googleProductCategory ? `<g:google_product_category>${xmlEscape(p.googleProductCategory)}</g:google_product_category>` : ""}
</item>`;
    })
    .filter(Boolean)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>AquaGear</title>
<link>${SITE_URL}</link>
<description>AquaGear product feed</description>
${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      // Cache at the edge for an hour; the feed doesn't need to be real-time.
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  });
}
