// Public (unauthenticated) read for builder landing pages.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { LandingContent, LandingFormConfig, LandingTheme } from "@/lib/landing-builder";
import { storePublicUrl } from "@/lib/store-public-url";

export type PublicLandingPage = {
  id: string;
  store_id: string;
  slug: string;
  title: string;
  content: LandingContent;
  theme: LandingTheme;
  form_config: LandingFormConfig;
  seo: { title?: string; description?: string } | null;
  product: {
    id: string;
    name: string;
    price: number;
    old_price: number | null;
    stock: number | null;
    status: string;
    primary_image_url?: string | null;
    gallery?: string[] | null;
  } | null;
  store: {
    id: string;
    name: string;
    slug: string;
    logo_url?: string | null;
    name_logo_url?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    address?: string | null;
    facebook?: string | null;
    instagram?: string | null;
    youtube?: string | null;
    tiktok?: string | null;
  };
};

export const getPublicLanding = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(64) }).parse(d))
  .handler(async ({ data }) => {
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabase = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const { data: page } = await supabase.rpc("get_public_landing_page", {
      _slug: data.slug.toLowerCase(),
    });
    return (page as unknown as PublicLandingPage | null) ?? null;
  });

export type LandingStoreProducts = {
  storeUrl: string;
  products: {
    id: string;
    name: string;
    price: number;
    old_price: number | null;
    primary_image_url: string | null;
  }[];
};

/**
 * Active catalogue products of the landing page's store, used by the
 * Recommended / Related / Recently Viewed sections. Public, read-only.
 */
export const getLandingStoreProducts = createServerFn({ method: "GET" })
  .inputValidator((d: { storeId: string; storeSlug: string }) =>
    z.object({ storeId: z.string().uuid(), storeSlug: z.string().min(1).max(64) }).parse(d),
  )
  .handler(async ({ data }): Promise<LandingStoreProducts> => {
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const supabase = createClient<Database>(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
            h.delete("Authorization");
          }
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });

    const [{ data: rows }, storeUrl] = await Promise.all([
      supabase
        .from("products")
        .select("id,name,price,old_price,primary_image_url")
        .eq("store_id", data.storeId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(60),
      storePublicUrl(supabase as any, data.storeId, data.storeSlug),
    ]);

    return {
      storeUrl,
      products: (rows ?? []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: Number(p.price ?? 0),
        old_price: p.old_price == null ? null : Number(p.old_price),
        primary_image_url: p.primary_image_url ?? null,
      })),
    };
  });
