// JSON-LD builders. Every value comes from real data (DB rows, store settings,
// known social URLs). Nothing here invents ratings, prices, or identifiers —
// fabricated structured data is a Google policy violation, not an SEO win.
import { SITE_URL } from "@/lib/site";

const ORG_ID = `${SITE_URL}/#organization`;
const WEBSITE_ID = `${SITE_URL}/#website`;

const SOCIALS = [
  "https://instagram.com/aquagear4",
  "https://www.tiktok.com/@aqua.gear.lb",
  "https://www.facebook.com/profile.php?id=61576671363398",
];

const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`);

export function organizationSchema(storeName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: storeName,
    url: SITE_URL,
    logo: abs("/logo_trans.png"),
    sameAs: SOCIALS,
    areaServed: "LB",
  };
}

export function websiteSchema(storeName: string) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: storeName,
    url: SITE_URL,
    publisher: { "@id": ORG_ID },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/shop?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: abs(item.path),
    })),
  };
}

export interface ProductSchemaInput {
  name: string;
  slug: string;
  description: string;
  priceCents: number;
  inStock: boolean;
  images: string[];
  categoryName: string;
  /** Stable identifier — the DB id doubles as a SKU. */
  sku: string;
  brand?: string | null;
  gtin?: string | null;
  mpn?: string | null;
  /** Real aggregate; omit the block entirely when there are no reviews. */
  ratingAverage?: number;
  ratingCount?: number;
  reviews?: { author: string; rating: number; body: string; date: string }[];
}

export function productSchema(p: ProductSchemaInput) {
  // Price validity is a soft field; 1 year out avoids the Merchant "no
  // priceValidUntil" warning without asserting anything about the product.
  const validUntil = new Date();
  validUntil.setFullYear(validUntil.getFullYear() + 1);

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    description: p.description,
    sku: p.sku,
    category: p.categoryName,
    brand: { "@type": "Brand", name: p.brand || "AquaGear" },
    ...(p.gtin ? { gtin: p.gtin } : {}),
    ...(p.mpn ? { mpn: p.mpn } : {}),
    image: p.images.map(abs),
    offers: {
      "@type": "Offer",
      url: abs(`/product/${p.slug}`),
      priceCurrency: "USD",
      price: (p.priceCents / 100).toFixed(2),
      priceValidUntil: validUntil.toISOString().slice(0, 10),
      itemCondition: "https://schema.org/NewCondition",
      availability: p.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      seller: { "@id": ORG_ID },
    },
  };

  // Only emit ratings/reviews backed by real Review rows.
  if (p.ratingCount && p.ratingCount > 0 && p.ratingAverage) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: p.ratingAverage.toFixed(1),
      reviewCount: p.ratingCount,
    };
    if (p.reviews?.length) {
      schema.review = p.reviews.map((r) => ({
        "@type": "Review",
        author: { "@type": "Person", name: r.author },
        reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5 },
        reviewBody: r.body,
        datePublished: r.date,
      }));
    }
  }

  return schema;
}
