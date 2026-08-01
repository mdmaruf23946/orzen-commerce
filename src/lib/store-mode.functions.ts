// Store Mode switching: writes the mode and safely archives any connected
// custom domain (never deletes it) so it can be reconnected afterwards.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function myStore(supabase: any, userId: string) {
  const { data } = await supabase
    .from("stores")
    .select("id, store_mode, primary_domain_id")
    .eq("owner_user_id", userId)
    .maybeSingle();
  if (!data) throw new Error("No store found for this account");
  return data as { id: string; store_mode: string | null; primary_domain_id: string | null };
}

export const switchStoreMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ mode: z.enum(["physical", "digital", "hybrid"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await myStore(supabase, userId);
    const current = store.store_mode ?? "physical";
    if (current === data.mode) return { ok: true, mode: data.mode, disconnected: [] as string[] };

    // 1. Mode write — no other store data is touched.
    const { error } = await supabase
      .from("stores")
      .update({ store_mode: data.mode, store_mode_changed_at: new Date().toISOString() })
      .eq("id", store.id);
    if (error) throw new Error(error.message);

    // 2. Archive connected custom domains (kept, never deleted).
    const { data: domains } = await supabase
      .from("store_domains")
      .select("*")
      .eq("store_id", store.id)
      .eq("kind", "custom")
      .is("disconnected_at", null);

    const disconnected: string[] = [];
    for (const d of (domains ?? []) as any[]) {
      const { error: upErr } = await supabase
        .from("store_domains")
        .update({
          status: "pending",
          is_primary: false,
          disconnected_at: new Date().toISOString(),
          disconnect_reason: "store_mode_changed",
          previous_state: {
            status: d.status,
            is_primary: d.is_primary,
            ssl_status: d.ssl_status,
            verified_at: d.verified_at,
          },
        })
        .eq("id", d.id);
      if (!upErr) disconnected.push(d.hostname);
      if (store.primary_domain_id === d.id) {
        await supabase.from("stores").update({ primary_domain_id: null }).eq("id", store.id);
      }
    }

    return { ok: true, mode: data.mode, disconnected };
  });

/** Restore a domain archived by a mode switch. */
export const reconnectDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ domainId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const store = await myStore(supabase, userId);
    const { data: row } = await supabase
      .from("store_domains")
      .select("*")
      .eq("id", data.domainId)
      .eq("store_id", store.id)
      .maybeSingle();
    if (!row) throw new Error("Domain not found");

    const prev = (row as any).previous_state ?? {};
    const { error } = await supabase
      .from("store_domains")
      .update({
        // Restore to pending so verification re-runs; keep prior SSL knowledge.
        status: "pending",
        ssl_status: prev.ssl_status ?? "none",
        disconnected_at: null,
        disconnect_reason: null,
        previous_state: null,
        last_checked_at: null,
      })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    return { ok: true, hostname: (row as any).hostname };
  });

/** Domains archived by a mode switch, for the warning banner. */
export const listDisconnectedDomains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: store } = await supabase
      .from("stores")
      .select("id")
      .eq("owner_user_id", userId)
      .maybeSingle();
    if (!store) return [];
    const { data } = await supabase
      .from("store_domains")
      .select("id, hostname, disconnected_at, disconnect_reason")
      .eq("store_id", store.id)
      .not("disconnected_at", "is", null);
    return (data ?? []) as any[];
  });
