// Shared AI agent types (split from ai-agent.server.ts).
export type AgentContext = {
  storeId: string;
  storeSlug?: string;
  conversationId?: string; // Messenger/web conversation row
  psid?: string; // Messenger PSID
  pageToken?: string; // decrypted page access token
  siteOrigin?: string; // e.g. https://mystore.orzen.top
  channel?: "web" | "messenger" | "whatsapp"; // controls which display tools are registered
  waTo?: string; // customer WhatsApp number (wa_id)
  waPhoneNumberId?: string; // store's WhatsApp Cloud API phone number id
  waToken?: string; // decrypted WhatsApp access token
  focusProductId?: string | null; // server-resolved product for this turn (see resolveFocusProduct)
};


export type GlobalAiSettings = {
  global_system_prompt?: string | null;
  safety_rules?: string | null;
  brand_voice?: string | null;
  supported_languages?: string[] | null;
  temperature?: number | null;
  max_tokens?: number | null;
  fallback_model?: string | null;
};

export type AgentState = {
  pending_order?: Record<string, any> | null;
  last_order?: Record<string, any> | null;
  recent_product_ids?: string[] | null;
  /** Pre-rendered compact memory card (summary, facts, recent products). */
  memory_card?: string | null;
};

export type FocusProduct = {
  product: any | null;
  ambiguous: boolean;
  candidates: any[]; // small summaries when ambiguous
  canonical_caption?: string;
};

