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
  how_it_really_works: [
    "Connecting Messenger/Facebook Page, WhatsApp and Instagram is MANUAL (no one-click auto connect): Messenger needs the Page ID, Page Access Token and App Secret; WhatsApp needs the Meta Cloud API Phone Number ID, WABA ID and access token; Instagram needs the Business Account ID and Page token. All entered in the merchant panel. If the merchant finds it hard, the ORZEN support team helps set it up. Never say it connects in one click.",
    "AI selling: the merchant adds products (name, photo, price, size/colour variants, stock). When a customer messages, the AI answers only from that store's live products/prices/stock, collects name, mobile and address, and creates the order. The merchant gets a phone/desktop notification; stock is reserved for pending orders so the last piece is not sold twice.",
    "Customer sends a product photo -> the AI finds the matching product in that store.",
    "Courier: Steadfast, Pathao, RedX, Paperfly and eCourier (plus manual courier). The merchant adds the courier API key once, then books a parcel from the order page in one click and gets tracking/status updates. The COD amount to collect is calculated automatically (total minus advance paid) and can be edited.",
    "Online store: created right after sign-up at orzen.top; own custom domain can be connected. An existing website/WooCommerce/landing page can be connected with two-way order/status sync.",
    "Inbox: Messenger, WhatsApp, Instagram, Web Chat and Facebook comments in one inbox. The merchant can reply manually any time (Take Over) and the AI stops for that chat; it can be handed back to the AI.",
    "Plans: the merchant picks a plan on the Billing page and sends the fee by bKash/Nagad with the transaction ID; the ORZEN team verifies and activates the plan manually (not instant). Prices come only from get_public_pricing.",
  ],
  answer_playbook: [
    "How do I connect my page/WhatsApp? -> Manually from the merchant panel with the Page ID + token (WhatsApp: Cloud API IDs + token); our team helps if needed. Never claim one-click.",
    "Can I control/run my business with AI? -> Yes. AI replies to customers on Page/WhatsApp/Instagram/Web Chat, shows products, takes orders, checks stock; merchant books courier in one click and sees everything in one dashboard.",
    "Do I need a website? / Will I get a website? -> Yes, a free online store is created in minutes at orzen.top; own domain can be connected.",
    "How do orders come? -> Customers order from the store or by chatting; the AI collects name, phone, address and creates the order; you get a phone notification.",
    "Auto reply on my Facebook page? -> Yes, connect the Page from the merchant panel; AI replies to messages (and comments) 24/7 in Bangla/Banglish/English.",
    "Courier? -> Steadfast, Pathao, RedX and other Bangladeshi couriers; one-click booking, tracking and COD amount auto-calculated.",
    "Is it free? / price? -> Free plan/trial to start; paid plans from the live package list (call get_public_pricing).",
    "Do I need technical skills? -> No; everything is set up from the panel, product add is easy (AI product builder available).",
    "Fake orders? -> Fraud checker and duplicate-order protection are built in.",
    "I already have a website/WooCommerce/landing page -> It can be connected; orders and status sync both ways.",
  ],
  billing:
    "Plans renew monthly on the same calendar date. Merchants request a plan from the Billing page; after the payment is verified by the ORZEN team the plan is activated.",
};
