// Server function powering the Landing Page → Design tab's AI theme suggestions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { myStoreRow } from "@/lib/store-access";
import type { LandingThemePreset } from "@/lib/landing-theme";

const uuid = z.string().uuid();

export const suggestLandingThemes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: uuid }).parse(d))
  .handler(async ({ data, context }): Promise<{ themes: LandingThemePreset[] }> => {
    const store = await myStoreRow(context.supabase, context.userId, "id", "landing_builder");
    if (!store) throw new Error("No store found for this account");

    const { data: page } = await context.supabase
      .from("landing_pages")
      .select("id,title,product_id,theme")
      .eq("id", data.id)
      .eq("store_id", (store as any).id)
      .maybeSingle();
    if (!page) throw new Error("Landing page not found");

    let facts: {
      name?: string | null;
      category?: string | null;
      description?: string | null;
      images?: string[];
    } = { name: (page as any).title };

    if ((page as any).product_id) {
      const { data: product } = await context.supabase
        .from("products")
        .select("name,short_description,description,primary_image_url,gallery")
        .eq("id", (page as any).product_id)
        .maybeSingle();
      if (product) {
        const p = product as any;
        const gallery = Array.isArray(p.gallery)
          ? p.gallery.map((g: any) => (typeof g === "string" ? g : String(g?.url ?? ""))).filter(Boolean)
          : [];
        facts = {
          name: p.name ?? (page as any).title,
          category: null,
          description: p.short_description || p.description || null,
          images: [p.primary_image_url, ...gallery].filter(Boolean).slice(0, 4),
        };
      }
    }

    const { suggestThemes } = await import("@/lib/landing-theme.server");
    return { themes: await suggestThemes(facts) };
  });
