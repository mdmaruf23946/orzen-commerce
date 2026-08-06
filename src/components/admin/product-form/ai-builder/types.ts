// Shared state shape for the type-aware AI Product Builder.
import type { DigitalFile } from "../DigitalFilesUploader";

export type AiProductType = "physical" | "digital" | "service" | "subscription";

export type PlanKey = "monthly" | "quarterly" | "half_yearly" | "yearly" | "lifetime";

export const PLAN_KEYS: PlanKey[] = ["monthly", "quarterly", "half_yearly", "yearly", "lifetime"];

export const PLAN_LABEL: Record<PlanKey, string> = {
  monthly: "Monthly",
  quarterly: "3 Months",
  half_yearly: "6 Months",
  yearly: "Yearly",
  lifetime: "Lifetime",
};

export type PlanRow = { enabled: boolean; price: string; compare: string };

export type AiEssentials = {
  // common
  price: string;
  oldPrice: string;

  // physical
  costPrice: string;
  stock: string;
  sku: string;
  lowStock: string;
  weight: string;
  dimL: string;
  dimW: string;
  dimH: string;
  warranty: string;
  manufacturer: string;
  origin: string;

  // digital
  deliveryType: "instant" | "manual" | "external";
  externalUrl: string;
  files: DigitalFile[];
  fileVersion: string;
  downloadLimit: string;
  expiryDays: string;
  licenseType: "personal" | "commercial" | "extended" | "custom";

  // service
  pricingMode: "fixed" | "starting";
  bookingRequired: boolean;
  appointmentMinutes: string;
  serviceMode: "online" | "offline" | "both";
  serviceArea: string;
  deliveryTime: string;
  responseTime: string;

  // subscription
  plans: Record<PlanKey, PlanRow>;
  trialEnabled: boolean;
  trialDays: string;
  activation: "automatic" | "manual";
  renewal: "automatic" | "manual";
};

export function defaultEssentials(): AiEssentials {
  return {
    price: "",
    oldPrice: "",
    costPrice: "",
    stock: "",
    sku: "",
    lowStock: "5",
    weight: "",
    dimL: "",
    dimW: "",
    dimH: "",
    warranty: "",
    manufacturer: "",
    origin: "",
    deliveryType: "instant",
    externalUrl: "",
    files: [],
    fileVersion: "",
    downloadLimit: "",
    expiryDays: "",
    licenseType: "personal",
    pricingMode: "fixed",
    bookingRequired: true,
    appointmentMinutes: "60",
    serviceMode: "online",
    serviceArea: "",
    deliveryTime: "",
    responseTime: "",
    plans: {
      monthly: { enabled: true, price: "", compare: "" },
      quarterly: { enabled: false, price: "", compare: "" },
      half_yearly: { enabled: false, price: "", compare: "" },
      yearly: { enabled: false, price: "", compare: "" },
      lifetime: { enabled: false, price: "", compare: "" },
    },
    trialEnabled: false,
    trialDays: "7",
    activation: "automatic",
    renewal: "automatic",
  };
}

/** Step 2 is complete enough to continue. */
export function essentialsReady(t: AiProductType, e: AiEssentials): boolean {
  if (t === "subscription") {
    return PLAN_KEYS.some((k) => e.plans[k].enabled && Number(e.plans[k].price) > 0);
  }
  return Number(e.price) > 0;
}

export type AiExtras = {
  youtubeUrl: string;
  facebookUrl: string;
  demoVideoUrl: string;
};
