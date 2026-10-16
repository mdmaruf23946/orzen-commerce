import { createFileRoute } from "@tanstack/react-router";
import { authStore, json, preflight, unauthorized } from "@/lib/call-sync.server";

export const Route = createFileRoute("/api/call-sync/products")({
  server: {
    handlers: {
      OPTIONS: async () => preflight(),
      GET: async ({ request }) => {
        const auth = await authStore(request);
        if (!auth) return unauthorized();
        const { storeId, supabaseAdmin } = auth;
        const limit = Math.min(Math.max(Number(new URL(request.url).searchParams.get("limit")) || 500, 1), 1000);
        const { data, error } = await supabaseAdmin
          .from("products")
          .select("id,name,price,stock,sku,primary_image_url,short_description,description,status,product_type,variants")
          .eq("store_id", storeId)
          .neq("status", "draft")
          .order("updated_at", { ascending: false })
          .limit(limit);
        if (error) return json({ ok: false, error: "query failed" }, 500);
        const products = (data ?? []).map((p: any) => ({
          id: p.id,
          name: p.name,
          price: Number(p.price ?? 0),
          stock_quantity: p.stock ?? 0,
          sku: p.sku ?? null,
          image_url: p.primary_image_url ?? null,
          description: p.short_description || p.description || "",
          details: p.description ?? "",
          status: p.status,
          product_type: p.product_type,
          variants: p.variants ?? [],
        }));
        return json({ ok: true, count: products.length, products });
      },
    },
  },
});
