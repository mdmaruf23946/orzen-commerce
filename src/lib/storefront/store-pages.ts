// Shared (client-safe) definitions for the merchant-editable storefront pages.

export type StorePageGroup = "quick" | "policy";

export type StorePageDef = {
  key: string;
  label: string;
  group: StorePageGroup;
  /** Functional pages only use the editor content as an intro block. */
  functional?: boolean;
  /** Matching key in the legacy legal generator, when one exists. */
  legalKey?: string;
  defaultDescription: string;
};

export const STORE_PAGES: StorePageDef[] = [
  {
    key: "about-us",
    label: "About Us",
    group: "quick",
    legalKey: "about",
    defaultDescription: "Learn more about our store, our story and what we stand for.",
  },
  {
    key: "contact-us",
    label: "Contact Us",
    group: "quick",
    legalKey: "contact",
    defaultDescription: "Get in touch with our support team — we usually reply within 24 hours.",
  },
  {
    key: "shop",
    label: "Shop",
    group: "quick",
    functional: true,
    defaultDescription: "Browse the full product catalogue with search, category filters and sorting.",
  },
  {
    key: "track-order",
    label: "Track Order",
    group: "quick",
    functional: true,
    defaultDescription: "Track your order status instantly with your Order ID or phone number.",
  },
  {
    key: "blogs",
    label: "Blogs",
    group: "quick",
    defaultDescription: "News, guides and updates from our store.",
  },
  {
    key: "privacy-policy",
    label: "Privacy Policy",
    group: "policy",
    legalKey: "privacy",
    defaultDescription: "How we collect, use and protect your personal information.",
  },
  {
    key: "terms-conditions",
    label: "Terms & Conditions",
    group: "policy",
    legalKey: "terms",
    defaultDescription: "The terms that apply when you shop with us.",
  },
  {
    key: "return-refund-policy",
    label: "Return & Refund Policy",
    group: "policy",
    legalKey: "refund",
    defaultDescription: "Our return, exchange and refund rules explained clearly.",
  },
  {
    key: "shipping-policy",
    label: "Shipping Policy",
    group: "policy",
    legalKey: "shipping",
    defaultDescription: "Delivery timelines, shipping charges and coverage areas.",
  },
];

export const STORE_PAGE_KEYS = STORE_PAGES.map((p) => p.key);

export function storePageDef(key: string): StorePageDef | undefined {
  return STORE_PAGES.find((p) => p.key === key);
}
