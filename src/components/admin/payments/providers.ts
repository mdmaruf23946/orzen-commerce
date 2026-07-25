// Central branding registry for every payment gateway shown in the Store Admin.
// Keeps colors, taglines and docs in one place so cards, sheets, badges and
// toasts stay visually consistent.

export type PaymentBrand = {
  id: string;
  label: string;
  tagline: string;
  brandColor: string; // primary hex
  accentColor: string; // subtle hex for backgrounds
  initials: string;
  docsUrl?: string;
  region: string;
};

export const PAYMENT_BRANDS: Record<string, PaymentBrand> = {
  sslcommerz: {
    id: "sslcommerz",
    label: "SSLCommerz",
    tagline: "Cards, MFS and internet banking across Bangladesh.",
    brandColor: "#0B5FFF",
    accentColor: "#E8F0FF",
    initials: "SC",
    docsUrl: "https://developer.sslcommerz.com/",
    region: "Bangladesh",
  },
  shurjopay: {
    id: "shurjopay",
    label: "ShurjoPay",
    tagline: "Unified checkout for cards, bKash, Nagad and Rocket.",
    brandColor: "#F5A623",
    accentColor: "#FFF4E0",
    initials: "SP",
    docsUrl: "https://engine.shurjopayment.com/",
    region: "Bangladesh",
  },
  amarpay: {
    id: "amarpay",
    label: "AmarPay",
    tagline: "MFS + card payments with instant settlement.",
    brandColor: "#E11D48",
    accentColor: "#FEE2E9",
    initials: "AP",
    docsUrl: "https://aamarpay.readme.io/",
    region: "Bangladesh",
  },
  portwallet: {
    id: "portwallet",
    label: "PortWallet",
    tagline: "Global cards + Bangladeshi MFS in one gateway.",
    brandColor: "#00A3AD",
    accentColor: "#E0F7F7",
    initials: "PW",
    docsUrl: "https://docs.portwallet.com/",
    region: "Bangladesh",
  },
  stripe: {
    id: "stripe",
    label: "Stripe",
    tagline: "Global card processing loved by developers.",
    brandColor: "#635BFF",
    accentColor: "#EEECFF",
    initials: "S",
    docsUrl: "https://stripe.com/docs",
    region: "Global",
  },
  paypal: {
    id: "paypal",
    label: "PayPal",
    tagline: "Trusted wallet and card payments worldwide.",
    brandColor: "#003087",
    accentColor: "#E5EBF5",
    initials: "PP",
    docsUrl: "https://developer.paypal.com/",
    region: "Global",
  },
  bkash: {
    id: "bkash",
    label: "bKash",
    tagline: "Bangladesh's largest mobile financial service.",
    brandColor: "#E2136E",
    accentColor: "#FFE1EE",
    initials: "bK",
    docsUrl: "https://developer.bka.sh/",
    region: "Bangladesh",
  },
  manual: {
    id: "manual",
    label: "Manual / Bank Transfer",
    tagline: "Offline bank, mobile wallet and QR payments.",
    brandColor: "#0F172A",
    accentColor: "#E2E8F0",
    initials: "MB",
    region: "Any",
  },
};

export function getBrand(id: string): PaymentBrand {
  return (
    PAYMENT_BRANDS[id] ?? {
      id,
      label: id,
      tagline: "Payment gateway.",
      brandColor: "#64748B",
      accentColor: "#F1F5F9",
      initials: id.slice(0, 2).toUpperCase(),
      region: "—",
    }
  );
}
