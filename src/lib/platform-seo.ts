// Platform (orzen.top) SEO helpers — browser-safe.
import { PLATFORM_ORIGIN } from "@/lib/seo";

export const PLATFORM_OG_IMAGE = `${PLATFORM_ORIGIN}/og-orzen.jpg`;

/** Standard head for a platform marketing page. */
export function platformHead(opts: {
  path: string;
  title: string;
  description: string;
  image?: boolean;
  jsonLd?: unknown[];
}) {
  const url = `${PLATFORM_ORIGIN}${opts.path}`;
  const meta: any[] = [
    { title: opts.title },
    { name: "description", content: opts.description },
    { property: "og:title", content: opts.title },
    { property: "og:description", content: opts.description },
    { property: "og:type", content: "website" },
    { property: "og:url", content: url },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: opts.title },
    { name: "twitter:description", content: opts.description },
  ];
  if (opts.image !== false) {
    meta.push({ property: "og:image", content: PLATFORM_OG_IMAGE });
    meta.push({ property: "og:image:width", content: "1200" });
    meta.push({ property: "og:image:height", content: "630" });
    meta.push({ name: "twitter:image", content: PLATFORM_OG_IMAGE });
  }
  return {
    meta,
    links: [{ rel: "canonical", href: url }],
    scripts: opts.jsonLd?.length
      ? [{ type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@graph": opts.jsonLd }) }]
      : [],
  };
}

export const ORG_NODE = {
  "@type": "Organization",
  "@id": `${PLATFORM_ORIGIN}/#organization`,
  name: "ORZEN",
  url: `${PLATFORM_ORIGIN}/`,
  logo: PLATFORM_OG_IMAGE,
  description:
    "All-in-one eCommerce platform for store building, AI sales assistance, messenger automation, courier delivery, analytics and secure payments.",
};

export const WEBSITE_NODE = {
  "@type": "WebSite",
  "@id": `${PLATFORM_ORIGIN}/#website`,
  name: "ORZEN",
  url: `${PLATFORM_ORIGIN}/`,
  inLanguage: ["en", "bn"],
  publisher: { "@id": `${PLATFORM_ORIGIN}/#organization` },
};

/** SoftwareApplication node; offers only from real package prices. */
export function softwareAppNode(plans?: { name: string; price: number | string }[]) {
  const node: Record<string, unknown> = {
    "@type": "SoftwareApplication",
    "@id": `${PLATFORM_ORIGIN}/#software`,
    name: "ORZEN",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "eCommerce Platform",
    operatingSystem: "Web",
    url: `${PLATFORM_ORIGIN}/`,
    publisher: { "@id": `${PLATFORM_ORIGIN}/#organization` },
  };
  const offers = (plans ?? [])
    .filter((p) => p && p.name && Number.isFinite(Number(p.price)))
    .map((p) => ({ "@type": "Offer", name: p.name, price: Number(p.price), priceCurrency: "BDT" }));
  if (offers.length) node.offers = offers;
  return node;
}
