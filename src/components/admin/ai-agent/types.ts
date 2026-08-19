import { ORDER_FLOW_DEFAULTS, type OrderFlowConfig } from "@/lib/messenger-order-flow";

export type Faq = { q: string; a: string };

export type AgentSources = {
  products: boolean;
  stock: boolean;
  categories: boolean;
  delivery: boolean;
  payments: boolean;
  returns: boolean;
  warranty: boolean;
  store_info: boolean;
  business_hours: boolean;
};

export type AgentForm = {
  enabled: boolean;
  agent_name: string;
  description: string;
  welcome_message: string;
  fallback_message: string;
  product_recommendations: boolean;
  order_assistance: boolean;
  language: "bn" | "en" | "both";
  style: string;
  use_emoji: boolean;
  human_like: boolean;
  sales_focused: boolean;
  recommend_related: boolean;
  ask_for_info: boolean;
  escalate_to_human: boolean;
  sources: AgentSources;
  order_flow: OrderFlowConfig;
  knowledge: {
    store_info: string;
    delivery_policy: string;
    return_policy: string;
    warranty_policy: string;
    payment_methods: string;
    business_hours: string;
    faqs: Faq[];
  };
};

export const AGENT_DEFAULTS: AgentForm = {
  enabled: true,
  agent_name: "Sales Assistant",
  description: "",
  welcome_message: "Hi! How can I help you today?",
  fallback_message: "দুঃখিত, এই তথ্যটি আমার কাছে নেই। আপনি চাইলে আমি স্টোর অ্যাডমিনকে জানিয়ে দিতে পারি।",
  product_recommendations: true,
  order_assistance: true,
  language: "both",
  style: "friendly",
  use_emoji: true,
  human_like: true,
  sales_focused: true,
  recommend_related: true,
  ask_for_info: true,
  escalate_to_human: true,
  sources: {
    products: true,
    stock: true,
    categories: true,
    delivery: true,
    payments: true,
    returns: true,
    warranty: true,
    store_info: true,
    business_hours: true,
  },
  order_flow: ORDER_FLOW_DEFAULTS,
  knowledge: {
    store_info: "",
    delivery_policy: "",
    return_policy: "",
    warranty_policy: "",
    payment_methods: "",
    business_hours: "",
    faqs: [],
  },
};

export type KnowledgeSummary = {
  store: { name: string; address: string; phone: string; email: string; has_description: boolean };
  products_total: number;
  products_active: number;
  categories_total: number;
  delivery_zones: { name: string; charge: number }[];
  payment_gateways: string[];
  returns: { enabled: boolean; return_window_days: number | null; exchange_window_days: number | null };
};
