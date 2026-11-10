// Platform footer settings — public read + owner-only write.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FooterSocial = { platform: string; url: string };
export type FooterLink = { label: string; href: string };
export type FooterColumn = { title: string; links: FooterLink[] };
export type FooterSettings = {
  description: string;
  contact: { email?: string; phone?: string; address?: string };
  socials: FooterSocial[];
  columns: FooterColumn[];
  bottom_note: string;
};

export const FOOTER_FALLBACK: FooterSettings = {
  description:
    "An all-in-one eCommerce SaaS built for Bangladesh — store builder, AI sales agent, couriers, analytics and payments in one platform.",
  contact: { email: "support@orzen.top", phone: "", address: "Dhaka, Bangladesh" },
  socials: [
    { platform: "facebook", url: "#" },
    { platform: "linkedin", url: "#" },
    { platform: "youtube", url: "#" },
    { platform: "email", url: "mailto:support@orzen.top" },
  ],
  columns: [
    { title: "Product", links: [{ label: "Features", href: "#features" }, { label: "AI", href: "#ai" }] },
    { title: "Company", links: [{ label: "Support", href: "#contact" }, { label: "Contact", href: "#contact" }] },
    {
      title: "Legal",
      links: [
        { label: "Privacy Policy", href: "/privacy-policy" },
        { label: "Terms", href: "/terms" },
        { label: "Refund Policy", href: "/refund-policy" },
      ],
    },
  ],
  bottom_note: "Made with care in Dhaka.",
};

const schema = z.object({
  description: z.string().max(600).default(""),
  contact: z
    .object({
      email: z.string().max(160).default(""),
      phone: z.string().max(60).default(""),
      address: z.string().max(240).default(""),
    })
    .default({ email: "", phone: "", address: "" }),
  socials: z
    .array(z.object({ platform: z.string().min(1).max(40), url: z.string().max(400) }))
    .max(12)
    .default([]),
  columns: z
    .array(
      z.object({
        title: z.string().min(1).max(60),
        links: z.array(z.object({ label: z.string().min(1).max(60), href: z.string().max(400) })).max(20),
      }),
    )
    .max(6)
    .default([]),
  bottom_note: z.string().max(200).default(""),
});

export const getFooterSettings = createServerFn({ method: "GET" }).handler(async () => {
  const sb = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data } = await sb.rpc("get_platform_footer");
  const d = (data ?? null) as Partial<FooterSettings> | null;
  if (!d) return FOOTER_FALLBACK;
  return {
    description: d.description || FOOTER_FALLBACK.description,
    contact: { ...FOOTER_FALLBACK.contact, ...(d.contact ?? {}) },
    socials: Array.isArray(d.socials) && d.socials.length ? d.socials : FOOTER_FALLBACK.socials,
    columns: Array.isArray(d.columns) && d.columns.length ? d.columns : FOOTER_FALLBACK.columns,
    bottom_note: d.bottom_note || FOOTER_FALLBACK.bottom_note,
  } satisfies FooterSettings;
});

export const updateFooterSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => schema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: role } = await (context.supabase as any)
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "owner")
      .maybeSingle();
    if (!role) throw new Error("Forbidden");
    const { error } = await (context.supabase as any)
      .from("platform_footer")
      .upsert({ id: "global", ...data, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
