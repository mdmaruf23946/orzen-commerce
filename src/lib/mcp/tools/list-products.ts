import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function sb(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "list_products",
  title: "List products in a store",
  description:
    "List products for a store owned by the signed-in user. Pass the store's id (uuid) or slug. Returns up to 50 products newest first.",
  inputSchema: {
    store: z.string().min(1).describe("Store id (uuid) or store slug."),
    limit: z.number().int().min(1).max(50).optional().describe("Max products to return (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ store, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const client = sb(ctx);
    const isUuid = /^[0-9a-f-]{36}$/i.test(store);
    const { data: s, error: se } = await client
      .from("stores")
      .select("id, slug, name, owner_user_id")
      .eq(isUuid ? "id" : "slug", store)
      .maybeSingle();
    if (se) return { content: [{ type: "text", text: se.message }], isError: true };
    if (!s || s.owner_user_id !== ctx.getUserId()) {
      return { content: [{ type: "text", text: "Store not found or not owned by you." }], isError: true };
    }
    const { data, error } = await client
      .from("products")
      .select("id, name, price, discount_price, stock, sku, status, created_at")
      .eq("store_id", s.id)
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify({ store: s.slug, products: data ?? [] }, null, 2) }],
      structuredContent: { store: s.slug, products: data ?? [] },
    };
  },
});
