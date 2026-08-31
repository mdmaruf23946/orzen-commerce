// Public (unauthenticated) read for builder landing pages.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { LandingContent, LandingFormConfig, LandingTheme } from "@/lib/landing-builder";

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
    gallery?: unknown;
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
