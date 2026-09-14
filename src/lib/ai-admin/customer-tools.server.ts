// Public-only tool layer for the Customer AI Agent.
// SECURITY: this module must never import the admin tool registry
// (./tools.server) or touch private tables (stores, orders, payments,
// subscriptions, users, revenue). Only the public knowledge base and the
// public subscription package list are readable here.
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type KbEntry = { category: string; title: string; body: string };

export const KB_CATEGORIES = [
  { key: "business", label: "Business information" },
  { key: "features", label: "Features" },
  { key: "pricing", label: "Pricing" },
  { key: "plans", label: "Plans" },
  { key: "faq", label: "FAQ" },
  { key: "howto", label: "How-to guide" },
  { key: "support", label: "Support information" },
  { key: "contact", label: "Contact information" },
  { key: "policy", label: "Policy" },
  { key: "other", label: "Other" },
] as const;

async function kb(categories?: string[]): Promise<KbEntry[]> {
  let q = supabaseAdmin
    .from("ai_admin_kb_entries")
    .select("category, title, body")
    .eq("published", true)
    .order("sort_order", { ascending: true })
    .limit(60);
  if (categories?.length) q = q.in("category", categories);
  const { data } = await q;
  return (data ?? []) as KbEntry[];
}

async function publicPackages() {
  const { data } = await supabaseAdmin
    .from("subscription_packages")
    .select("name, price, billing_cycle, duration_days, description, feature_summary, plan_tier, is_trial, trial_days")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .limit(20);
  return data ?? [];
}

export type CustomerToolCtx = {
  psid: string;
  threadId: string | null;
  customerName: string | null;
  /** Records that an escalation happened so the webhook can flag the thread. */
  onEscalate: (reason: string, summary: string) => Promise<void>;
};

/** Build the customer tool set. Read tools are public-only; the write tools
 *  can only create a support request for this exact PSID. */
export function buildCustomerTools(ctx: CustomerToolCtx) {
  const empty = z.object({});
  return {
    get_public_business_info: {
      description: "Public information about the business/platform.",
      schema: empty,
      run: async () => ({ entries: await kb(["business", "other"]) }),
    },
    get_public_features: {
      description: "Public list of product features and what they do.",
      schema: empty,
      run: async () => ({ entries: await kb(["features"]) }),
    },
    get_public_pricing: {
      description: "Public pricing and available plans.",
      schema: empty,
      run: async () => ({ entries: await kb(["pricing", "plans"]), packages: await publicPackages() }),
    },
    get_public_faq: {
      description: "Public frequently asked questions.",
      schema: empty,
      run: async () => ({ entries: await kb(["faq"]) }),
    },
    get_help_information: {
      description: "Public how-to guides, support and contact information, and policies.",
      schema: z.object({ topic: z.string().nullable() }),
      run: async () => ({ entries: await kb(["howto", "support", "contact", "policy"]) }),
    },
    create_support_request: {
      description:
        "File a support request for this customer when their issue cannot be answered from public information.",
      schema: z.object({ reason: z.string(), summary: z.string() }),
      run: async (args: { reason: string; summary: string }) => {
        await ctx.onEscalate(args.reason, args.summary);
        return { created: true };
      },
    },
    request_human_support: {
      description: "Escalate this conversation to a human admin because the customer asked for a person.",
      schema: z.object({ summary: z.string() }),
      run: async (args: { summary: string }) => {
        await ctx.onEscalate("Customer requested human support", args.summary);
        return { escalated: true };
      },
    },
  } as const;
}
