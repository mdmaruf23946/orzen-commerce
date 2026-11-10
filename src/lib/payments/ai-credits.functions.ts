import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("id").eq("user_id", userId).eq("role", "owner").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

export const getAiCreditAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb = context.supabase as any;
    const [s, b, p, st, c] = await Promise.all([
      sb.from("ai_credit_settings").select("*").maybeSingle(),
      sb.from("ai_credit_bundles").select("*").order("sort_order").order("credits"),
      sb.from("subscription_packages").select("id,name,price,ai_credits_included,is_active").order("sort_order"),
      sb.from("stores").select("id,name,slug").order("created_at", { ascending: false }).limit(500),
      sb.from("store_ai_credits").select("*"),
    ]);
    const credits = new Map((c.data ?? []).map((r: any) => [r.store_id, r]));
    return {
      settings: s.data ?? { tokens_per_credit: 1000, enforce_limits: false, visible_to_merchants: false },
      bundles: b.data ?? [],
      packages: p.data ?? [],
      stores: (st.data ?? []).map((x: any) => ({ ...x, balance: Number((credits.get(x.id) as any)?.balance ?? 0), used: Number((credits.get(x.id) as any)?.lifetime_used ?? 0) })),
    };
  });

export const saveAiCreditSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { tokens_per_credit: number }) => {
    const n = Math.floor(Number(d.tokens_per_credit));
    if (!(n >= 1 && n <= 10_000_000)) throw new Error("Invalid tokens per credit");
    return { tokens_per_credit: n };
  })
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("ai_credit_settings")
      .update({ tokens_per_credit: data.tokens_per_credit, updated_at: new Date().toISOString() }).eq("id", true);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const upsertAiCreditBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id?: string; name: string; credits: number; price_bdt: number; is_active: boolean }) => {
    if (!d.name?.trim()) throw new Error("Name required");
    if (!(Number(d.credits) > 0)) throw new Error("Credits must be > 0");
    if (!(Number(d.price_bdt) >= 0)) throw new Error("Invalid price");
    return { ...d, name: d.name.trim(), credits: Math.floor(Number(d.credits)), price_bdt: Number(d.price_bdt) };
  })
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const sb = context.supabase as any;
    const row = { name: data.name, credits: data.credits, price_bdt: data.price_bdt, is_active: data.is_active };
    const { error } = data.id ? await sb.from("ai_credit_bundles").update(row).eq("id", data.id) : await sb.from("ai_credit_bundles").insert(row);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteAiCreditBundle = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("ai_credit_bundles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPackageAiCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { packageId: string; credits: number }) => {
    const n = Math.floor(Number(d.credits));
    if (!(n >= 0)) throw new Error("Invalid credits");
    return { packageId: d.packageId, credits: n };
  })
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { error } = await (context.supabase as any).from("subscription_packages").update({ ai_credits_included: data.credits }).eq("id", data.packageId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adjustStoreAiCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { storeId: string; credits: number; note?: string }) => {
    const n = Number(d.credits);
    if (!Number.isFinite(n) || n === 0) throw new Error("Enter credits");
    return { storeId: d.storeId, credits: n, note: d.note?.slice(0, 200) ?? null };
  })
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { data: bal, error } = await (context.supabase as any).rpc("grant_ai_credits", {
      _store: data.storeId, _credits: data.credits, _kind: data.credits > 0 ? "admin_grant" : "admin_deduct", _note: data.note,
    });
    if (error) throw new Error(error.message);
    return { balance: Number(bal) };
  });
