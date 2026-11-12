import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { classifyStorePlan } from "@/lib/payments/promo-audience";

async function assertOwner(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("id").eq("user_id", userId).eq("role", "owner").maybeSingle();
  if (!data) throw new Error("Forbidden");
}

async function loadRecipients(sb: any) {
  const { data, error } = await sb
    .from("stores")
    .select("id,name,email,owner_name,owner_user_id,subscription_status,subscription_packages(name,price,is_trial)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((s: any) => ({
    id: s.id as string,
    name: s.name as string,
    owner_name: (s.owner_name ?? "") as string,
    owner_user_id: s.owner_user_id as string,
    email: (s.email ?? "") as string,
    plan: (s.subscription_packages?.name ?? "—") as string,
    group: classifyStorePlan({ subscription_status: s.subscription_status, package: s.subscription_packages }),
  }));
}

export const listPromoRecipients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const rows = await loadRecipients(supabaseAdmin);
    // Fall back to the owner's login email when the store has none.
    const missing = rows.filter((r: any) => !r.email.includes("@"));
    for (const r of missing) {
      const { data } = await (supabaseAdmin as any).auth.admin.getUserById(r.owner_user_id);
      r.email = data?.user?.email ?? "";
    }
    return rows.map(({ owner_user_id, ...r }: any) => r);
  });

export const sendPromoEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      couponId: z.string().uuid(),
      storeIds: z.array(z.string().uuid()).min(1).max(500),
      subject: z.string().trim().min(1).max(200),
      message: z.string().trim().min(1).max(5000),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: coupon } = await (supabaseAdmin as any).from("subscription_coupons").select("code,active").eq("id", data.couponId).maybeSingle();
    if (!coupon) throw new Error("প্রোমো কোড পাওয়া যায়নি");
    if (!coupon.active) throw new Error("প্রোমো কোডটি বন্ধ আছে — আগে Active করুন");
    const { escapeHtml, renderPlatformEmail, sendBrevoEmail } = await import("@/lib/notifications/brevo.server");
    const { fillPromoTemplate } = await import("@/lib/payments/promo-audience");
    const all = await loadRecipients(supabaseAdmin);
    const chosen = all.filter((r: any) => data.storeIds.includes(r.id));
    let sent = 0;
    const failed: string[] = [];
    for (const r of chosen) {
      let email = r.email;
      if (!email.includes("@")) {
        const { data: u } = await (supabaseAdmin as any).auth.admin.getUserById(r.owner_user_id);
        email = u?.user?.email ?? "";
      }
      if (!email.includes("@")) { failed.push(r.name); continue; }
      const vars = { code: coupon.code, store_name: r.name, owner_name: r.owner_name || r.name };
      const body = escapeHtml(fillPromoTemplate(data.message, vars)).replace(/\n/g, "<br>");
      const codeBox = `<div style="margin:20px 0;padding:16px;border:2px dashed #163f2c;border-radius:8px;text-align:center;font-family:Consolas,monospace;font-size:26px;font-weight:800;letter-spacing:4px;color:#163f2c">${escapeHtml(coupon.code)}</div>`;
      try {
        const html = await renderPlatformEmail({
          title: fillPromoTemplate(data.subject, vars),
          bodyHtml: `<p>${body}</p>${codeBox}`,
          actionLabel: "প্যাকেজ দেখুন",
          actionUrl: "https://orzen.top/admin/billing",
          kind: "billing",
          preheader: `প্রোমো কোড: ${coupon.code}`,
          sanitizeBody: false,
        });
        await sendBrevoEmail({ to: email, toName: r.owner_name || r.name, subject: fillPromoTemplate(data.subject, vars), html, tags: ["promo-code"] });
        sent++;
      } catch (e) {
        console.error("[promo-email] failed", r.id, (e as Error).message);
        failed.push(r.name);
      }
    }
    return { sent, failed };
  });
