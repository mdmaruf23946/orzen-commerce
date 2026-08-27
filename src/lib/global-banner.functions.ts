// Public read for the platform-wide storefront header banner (Owner-managed).
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

export type GlobalHeaderBanner = {
  enabled: boolean;
  image_url: string | null;
  link_url: string | null;
  alt: string | null;
};

export const getGlobalHeaderBanner = createServerFn({ method: "GET" }).handler(
  async (): Promise<GlobalHeaderBanner> => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient(process.env["SUPABASE_URL"]!, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });
    const { data } = await sb.rpc("get_global_header_banner" as any);
    const b = (data ?? {}) as any;
    return {
      enabled: !!b.enabled,
      image_url: b.image_url || null,
      link_url: b.link_url || null,
      alt: b.alt || null,
    };
  },
);
