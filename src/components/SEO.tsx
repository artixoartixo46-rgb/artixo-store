import { Helmet } from "react-helmet-async";

export const SITE_URL = "https://artixo.store";
export const SITE_NAME = "ARTIXO";
export const SITE_DESCRIPTION =
  "Sri Lanka's premier online marketplace — shop electronics, fashion, home goods and more. Verified sellers, fast delivery island-wide.";
export const SITE_LOGO = `${SITE_URL}/logo.png`;

interface SEOProps {
  title?: string;
  description?: string;
  canonical?: string;
  image?: string;
  type?: "website" | "product" | "profile";
  /** JSON-LD schema objects to inject */
  schema?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
}

/** Reusable SEO head component — drop into any page. */
export const SEO = ({
  title,
  description = SITE_DESCRIPTION,
  canonical,
  image = SITE_LOGO,
  type = "website",
  schema,
  noindex = false,
}: SEOProps) => {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} — Sri Lanka's Online Marketplace`;
  const canonicalUrl = canonical ? `${SITE_URL}${canonical}` : undefined;
  const schemas = schema ? (Array.isArray(schema) ? schema : [schema]) : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      {canonicalUrl && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph */}
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      {canonicalUrl && <meta property="og:url" content={canonicalUrl} />}
      <meta property="og:image" content={image} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="en_LK" />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* JSON-LD schema(s) */}
      {schemas.map((s, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(s)}
        </script>
      ))}
    </Helmet>
  );
};

/** Organisation schema — include on every page that doesn't have a more specific schema */
export const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE_NAME,
  url: SITE_URL,
  logo: SITE_LOGO,
  description: SITE_DESCRIPTION,
  address: {
    "@type": "PostalAddress",
    addressCountry: "LK",
  },
  sameAs: [],
};

/** WebSite schema with SearchAction for sitelinks search box */
export const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: SITE_NAME,
  url: SITE_URL,
  potentialAction: {
    "@type": "SearchAction",
    target: {
      "@type": "EntryPoint",
      urlTemplate: `${SITE_URL}/products?q={search_term_string}`,
    },
    "query-input": "required name=search_term_string",
  },
};

interface ProductSchemaOptions {
  id: string;
  name: string;
  description?: string;
  price: number;
  currency?: string;
  image?: string | string[];
  brand?: string;
  sku?: string;
  stock?: number;
  ratingValue?: number;
  reviewCount?: number;
  category?: string;
}

/** Build a Product JSON-LD schema object */
export function buildProductSchema({
  id,
  name,
  description,
  price,
  currency = "LKR",
  image,
  brand,
  sku,
  stock,
  ratingValue,
  reviewCount,
  category,
}: ProductSchemaOptions): Record<string, unknown> {
  const images = image
    ? Array.isArray(image)
      ? image
      : [image]
    : [];

  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    url: `${SITE_URL}/product/${id}`,
    ...(description ? { description } : {}),
    ...(images.length ? { image: images } : {}),
    ...(brand ? { brand: { "@type": "Brand", name: brand } } : {}),
    ...(sku ? { sku } : {}),
    ...(category ? { category } : {}),
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/product/${id}`,
      priceCurrency: currency,
      price: price.toFixed(2),
      availability:
        stock === undefined || stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      seller: {
        "@type": "Organization",
        name: SITE_NAME,
      },
    },
  };

  if (ratingValue && reviewCount && reviewCount > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: ratingValue.toFixed(1),
      reviewCount,
      bestRating: "5",
      worstRating: "1",
    };
  }

  return schema;
}
