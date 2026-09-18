import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const schema = z.object({
  store_id: z.string().uuid(),
  email: z.string().email().max(254),
});

export const subscribeToStoreOffers = createServerFn({ method: "POST" })
  .inputValidator((data) => schema.parse(data))
  .handler(async ({ data }) => {
    const { guardServerFn } = await import("@/lib/rate-limit.server");
    await guardServerFn("contact");
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient(process.env["SUPABASE_URL"]!, key, {
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

    const { error } = await sb
      .from("store_newsletter_subscribers")
      .insert({ store_id: data.store_id, email: data.email.toLowerCase() });

    if (error) {
      if (error.code === "23505") return { ok: true, alreadySubscribed: true };
      throw new Error(error.message);
    }
    return { ok: true, alreadySubscribed: false };
  });
