// Core AI agent logic — used by both the storefront chat route and the Messenger webhook.
// Strictly scoped to a single store_id.
import { createClient } from "@supabase/supabase-js";
import { generateText, streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

function admin() {
  return createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );
}

export async function loadAiContext(storeId: string) {
  const sb = admin();
  const [{ data: store }, { data: agent }, { data: settings }] = await Promise.all([
    sb.from("stores").select("id,name,description,address,phone,whatsapp,facebook,delivery,payments_config").eq("id", storeId).maybeSingle(),
    sb.from("store_ai_agents").select("*").eq("store_id", storeId).maybeSingle(),
    sb.from("ai_global_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  if (!store || !agent) throw new Error("Agent not configured");
  if (!agent.enabled) throw new Error("Agent disabled");
  if (settings && settings.enabled === false) throw new Error("AI globally disabled");
  return { store, agent, settings };
}

export function buildSystemPrompt(store: any, agent: any) {
  const k = (agent.knowledge ?? {}) as Record<string, any>;
  const lang =
    agent.language === "bn"
      ? "Respond in Bangla."
      : agent.language === "en"
      ? "Respond in English."
      : "Respond in the same language the customer uses (Bangla or English).";
  const emoji = agent.use_emoji ? "Use friendly emojis sparingly." : "Do not use emojis.";
  const human = agent.human_like ? "Sound natural and human, not robotic." : "";
  const faqs = Array.isArray(k.faqs)
    ? k.faqs.map((f: any) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n")
    : "";
  return `You are ${agent.agent_name}, the sales assistant for "${store.name}".
${lang} ${emoji} ${human}
Style: ${agent.style}.

You MUST only discuss this store's products and policies. Use the available tools to look up products, prices, and stock. Never invent information.

When a customer wants to buy, collect product+qty, full name, phone, and delivery address, then call placeOrder. Confirm the order id after success.

Store info: ${k.store_info || store.description || ""}
Address: ${store.address || "n/a"}
Phone: ${store.phone || "n/a"}
Delivery: ${k.delivery_policy || JSON.stringify(store.delivery ?? {})}
Returns: ${k.return_policy || ""}
Warranty: ${k.warranty_policy || ""}
Payment: ${k.payment_methods || ""}
Business hours: ${k.business_hours || ""}

FAQs:
${faqs}`;
}

export function buildTools(storeId: string) {
  const sb = admin();
  return {
    searchProducts: tool({
      description: "Search this store's products by name/keyword. Returns id, name, price, stock.",
      inputSchema: z.object({ query: z.string().min(1).max(120) }),
      execute: async ({ query }) => {
        const { data } = await sb
          .from("products")
          .select("id,name,price,old_price,stock,status")
          .eq("store_id", storeId)
          .neq("status", "draft")
          .ilike("name", `%${query}%`)
          .limit(10);
        return data ?? [];
      },
    }),
    getProduct: tool({
      description: "Get full details of one product by id.",
      inputSchema: z.object({ productId: z.string().uuid() }),
      execute: async ({ productId }) => {
        const { data } = await sb
          .from("products")
          .select("id,name,description,price,old_price,stock,status")
          .eq("store_id", storeId)
          .eq("id", productId)
          .maybeSingle();
        return data;
      },
    }),
    listCategories: tool({
      description: "List product categories in this store.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await sb.from("categories").select("id,name").eq("store_id", storeId);
        return data ?? [];
      },
    }),
    placeOrder: tool({
      description: "Create an order for this store after collecting all required info from the customer.",
      inputSchema: z.object({
        customer_name: z.string().min(1).max(120),
        phone: z.string().min(5).max(40),
        address: z.string().min(3).max(500),
        payment_method: z.enum(["cod", "bkash", "nagad", "rocket", "bank"]).default("cod"),
        items: z
          .array(z.object({ productId: z.string().uuid(), qty: z.number().int().min(1).max(99) }))
          .min(1)
          .max(20),
      }),
      execute: async (input) => {
        const ids = input.items.map((i) => i.productId);
        const { data: products } = await sb
          .from("products")
          .select("id,name,price,stock,status")
          .in("id", ids)
          .eq("store_id", storeId);
        const byId = new Map((products ?? []).map((p) => [p.id, p]));
        let subtotal = 0;
        const rows = input.items.map((i) => {
          const p = byId.get(i.productId);
          if (!p) throw new Error("Invalid product");
          if (p.stock < i.qty) throw new Error(`Out of stock: ${p.name}`);
          subtotal += Number(p.price) * i.qty;
          return { product_id: p.id, name_snapshot: p.name, price_snapshot: p.price, qty: i.qty };
        });
        const { data: order, error } = await sb
          .from("orders")
          .insert({
            store_id: storeId,
            customer_name: input.customer_name,
            phone: input.phone,
            address: input.address,
            payment_method: input.payment_method,
            subtotal,
            status: "pending",
            notes: "Placed via AI Sales Agent",
          })
          .select("id")
          .single();
        if (error || !order) throw new Error(error?.message ?? "Order failed");
        await sb.from("order_items").insert(rows.map((r) => ({ ...r, order_id: order.id })));
        return { orderId: order.id, subtotal };
      },
    }),
  };
}

export async function logUsage(storeId: string | null, model: string, usage: any, kind: string) {
  try {
    const sb = admin();
    await sb.from("ai_usage").insert({
      store_id: storeId,
      model,
      prompt_tokens: usage?.promptTokens ?? usage?.inputTokens ?? 0,
      completion_tokens: usage?.completionTokens ?? usage?.outputTokens ?? 0,
      cost_usd: 0,
      kind,
    });
  } catch {
    /* swallow */
  }
}

export async function getModelForStore() {
  const sb = admin();
  const { data: settings } = await sb.from("ai_global_settings").select("*").eq("id", 1).maybeSingle();
  const apiKey = settings?.provider_api_key || process.env.LOVABLE_API_KEY!;
  const modelId = settings?.default_model || "google/gemini-3-flash-preview";
  const gateway = createLovableAiGatewayProvider(apiKey);
  return { model: gateway(modelId), modelId };
}

export function streamAgentResponse(opts: {
  storeId: string;
  messages: any[];
  system: string;
}) {
  return async () => {
    const { model, modelId } = await getModelForStore();
    const result = streamText({
      model,
      system: opts.system,
      messages: opts.messages,
      tools: buildTools(opts.storeId),
      stopWhen: stepCountIs(50),
      onFinish: ({ usage }) => {
        void logUsage(opts.storeId, modelId, usage, "chat");
      },
    });
    return result;
  };
}

export async function generateAgentReply(opts: { storeId: string; messages: any[]; system: string }) {
  const { model, modelId } = await getModelForStore();
  const result = await generateText({
    model,
    system: opts.system,
    messages: opts.messages,
    tools: buildTools(opts.storeId),
    stopWhen: stepCountIs(50),
  });
  void logUsage(opts.storeId, modelId, result.usage, "messenger");
  return result.text;
}
