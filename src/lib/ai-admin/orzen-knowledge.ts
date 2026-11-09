// Built-in ORZEN platform knowledge for the Winner Admin Messenger sales agent.
// Used together with the published knowledge-base entries and live packages,
// so the agent always has accurate website facts even when the KB is empty.
import { PLAN_DISPLAY_FEATURES } from "@/lib/features";

export const ORZEN_SITE_URL = "https://orzen.top";

export const ORZEN_KNOWLEDGE = {
  website: ORZEN_SITE_URL,
  about:
    "ORZEN is a Bangladeshi AI eCommerce platform. Merchants create their own online store in minutes, and AI sells, replies and follows up for them on Messenger, WhatsApp and their website.",
  features: PLAN_DISPLAY_FEATURES.map((f) => f.label),
  feature_details: [
    "AI Sales Agent: replies to customers 24/7 on Messenger, WhatsApp, Instagram and Web Chat in Bangla/Banglish/English, shows products, prices, sizes/colours and takes orders from the store's own data.",
    "Unified inbox: all Messenger, WhatsApp, Instagram, Web Chat and Facebook comments in one place, with manual reply and easy AI/human takeover.",
    "Facebook Page: reply to comments publicly or privately and manage posts.",
    "Product photo matching: when a customer sends a product photo, the AI finds the matching product in the store.",
    "Courier integration: book parcels to Bangladeshi couriers (e.g. Steadfast, Pathao, RedX) in one click, with status tracking and COD amount calculation.",
    "Fraud checker and duplicate-order protection.",
    "Landing page builder and connecting existing websites/landing pages (WooCommerce or others) with two-way order sync.",
    "Facebook Pixel & tracking, custom domain, coupons, inventory/bulk import-export, analytics, returns, product reviews and staff accounts.",
    "Push notifications for new orders and messages on phone and desktop (installable app).",
  ],
  getting_started: [
    `Go to ${ORZEN_SITE_URL} and tap "Create Free Store".`,
    "Sign up with email and mobile number.",
    "Add products (or use the AI Product Builder).",
    "Connect the Facebook Page / WhatsApp from the merchant panel so the AI starts replying.",
    "Choose a plan from Billing when ready; the payment is verified by our team and the plan is activated.",
  ],
  billing:
    "Plans renew monthly on the same calendar date. Merchants request a plan from the Billing page; after the payment is verified by the ORZEN team the plan is activated.",
};
