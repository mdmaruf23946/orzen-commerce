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
    const { data: coupon } = await (supabaseAdmin as any).from("subscription_coupons").select("code,active,type,value,expires_at").eq("id", data.couponId).maybeSingle();
    if (!coupon) throw new Error("প্রোমো কোড পাওয়া যায়নি");
    if (!coupon.active) throw new Error("প্রোমো কোডটি বন্ধ আছে — আগে Active করুন");
    if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) throw new Error("প্রোমো কোডের মেয়াদ শেষ — আগে মেয়াদ বাড়ান");
    const { escapeHtml, renderPlatformEmail, sendBrevoEmail } = await import("@/lib/notifications/brevo.server");
    const { fillPromoTemplate, promoValidity, recipientName, bnNum } = await import("@/lib/payments/promo-audience");
    const all = await loadRecipients(supabaseAdmin);
    const chosen = all.filter((r: any) => data.storeIds.includes(r.id));
    let sent = 0;
    const failed: string[] = [];
    const v = promoValidity(coupon.expires_at);
    const discount = coupon.type === "percent" ? `${bnNum(Number(coupon.value))}% ছাড়` : `৳${bnNum(Number(coupon.value))} ছাড়`;
    for (const r of chosen) {
      const { data: u } = await (supabaseAdmin as any).auth.admin.getUserById(r.owner_user_id);
      let email = r.email;
      if (!email.includes("@")) email = u?.user?.email ?? "";
      if (!email.includes("@")) { failed.push(r.name); continue; }
      const name = recipientName(u?.user?.user_metadata, r.owner_name);
      const vars = { code: coupon.code, store_name: r.name, owner_name: name, discount, expiry_date: v.date || "সীমিত সময়", days_left: v.daysLeft == null ? "" : bnNum(v.daysLeft), validity_text: v.text };
      const subject = fillPromoTemplate(data.subject, vars);
      const body = escapeHtml(fillPromoTemplate(data.message, vars)).replace(/\n/g, "<br>");
      const e = escapeHtml;
      const offer = `
<div style="margin:22px 0;border-radius:12px;overflow:hidden;border:1px solid #f0c36d">
  <div style="background:#163f2c;color:#ffffff;text-align:center;padding:10px;font-size:13px;font-weight:700;letter-spacing:1px">🎁 সীমিত সময়ের বিশেষ অফার</div>
  <div style="background:#fffaf0;text-align:center;padding:20px 16px">
    <div style="font-size:30px;line-height:38px;font-weight:800;color:#b45309">${e(discount)}</div>
    <div style="font-size:13px;color:#64716b;margin:6px 0 12px">প্যাকেজ কেনার সময় এই কোডটি লিখে Apply করুন</div>
    <div style="display:inline-block;padding:12px 22px;border:2px dashed #163f2c;border-radius:8px;background:#ffffff;font-family:Consolas,monospace;font-size:26px;font-weight:800;letter-spacing:4px;color:#163f2c">${e(coupon.code)}</div>
  </div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff1d6"><tr>
    <td align="center" style="padding:12px;font-size:14px;color:#7c2d12;font-weight:700">⏳ ${e(v.text)}</td>
    ${v.date ? `<td align="center" style="padding:12px;font-size:14px;color:#7c2d12;border-left:1px solid #f0c36d">📅 শেষ তারিখ: <b>${e(v.date)}</b></td>` : ""}
  </tr></table>
</div>
<div style="font-size:14px;line-height:24px;color:#24342c;margin:0 0 6px"><b>আপগ্রেড করলে যা পাবেন:</b><br>✅ AI দিয়ে Messenger/WhatsApp-এ অটো সেল ও অর্ডার<br>✅ কুরিয়ার বুকিং ও COD হিসাব এক জায়গায়<br>✅ বেশি প্রোডাক্ট, বেশি অর্ডার, পেশাদার স্টোর</div>
<div style="font-size:13px;color:#b45309;margin-top:10px">⚡ অফারটি মেয়াদ শেষ হলে আর পাওয়া যাবে না — এখনই নিয়ে নিন।</div>`;
      try {
        const html = await renderPlatformEmail({
          title: subject,
          bodyHtml: `<p>${body}</p>${offer}`,
          actionLabel: "এখনই অফারটি নিন →",
          actionUrl: "https://orzen.top/admin/billing",
          kind: "billing",
          preheader: `${discount} • কোড ${coupon.code} • ${v.text}`,
          sanitizeBody: false,
        });
        await sendBrevoEmail({ to: email, toName: name, subject, html, tags: ["promo-code"] });
        sent++;
      } catch (err) {
        console.error("[promo-email] failed", r.id, (err as Error).message);
        failed.push(r.name);
      }
    }
    return { sent, failed };
  });
