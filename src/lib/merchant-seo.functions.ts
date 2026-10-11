// Merchant AI SEO (Step 4): store audit, single/bulk AI suggestions and the
// approval workflow. AI output is only stored in seo_recommendations; nothing
// goes live until the merchant approves (seo_apply_recommendation RPC, which
// snapshots the old metadata for one-click rollback).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { myStoreRow } from "@/lib/store-access";

type Draft = { title: string; description: string; keywords: string; alt: string };

const strip = (s: unknown) =>
  String(s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

async function storeId(context: any): Promise<string> {
  const store = await myStoreRow(context.supabase, context.userId, "id, name", "seo");
  if (!store) throw new Error("No store found");
  return (store as any).id;
}

function parseDraft(text: string | null): Draft | null {
  if (!text) return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]);
    const title = strip(o.title).slice(0, 70);
    const description = strip(o.description).slice(0, 200);
    if (!title || !description) return null;
    const kw = Array.isArray(o.keywords) ? o.keywords.map(strip).filter(Boolean).join(", ") : strip(o.keywords);
    return { title, description, keywords: kw.slice(0, 400), alt: strip(o.alt).slice(0, 200) };
  } catch {
    return null;
  }
}

async function draftFor(p: { name: string; brand?: string | null; category?: string | null; description?: string | null; price?: number | null; storeName?: string | null }) {
  const { routedChatCompletion } = await import("@/lib/ai-provider.server");
  let text: string | null = null;
  try {
    text = await routedChatCompletion({
      jsonOnly: true,
      maxTokens: 700,
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content:
            "You write ecommerce product SEO for a Bangladeshi online store. Keep the language of the product name (English or Bangla). Title 45–60 characters, include the product name, no ALL CAPS, no emojis. Meta description 130–155 characters with a clear benefit and a soft call to action. 5–8 search keywords. Image alt text under 120 characters describing the product photo. Never invent prices, discounts, materials or claims not in the input. Reply ONLY with JSON: {\"title\": string, \"description\": string, \"keywords\": string[], \"alt\": string}",
        },
        {
          role: "user",
          content: [
            `Store: ${p.storeName ?? ""}`,
            `Product: ${p.name}`,
            p.brand ? `Brand: ${p.brand}` : "",
            p.category ? `Category: ${p.category}` : "",
            p.price ? `Price: ৳${p.price}` : "",
            `Details: ${strip(p.description).slice(0, 900)}`,
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    });
  } catch (e) {
    console.error("[merchant-seo] draft failed", e);
  }
  return parseDraft(text);
}

function productScore(p: any) {
  const seo = p.meta?.seo ?? {};
  const t = strip(seo.title).length;
  const d = strip(seo.description).length;
  return {
    hasTitle: t >= 25 && t <= 70,
    hasDescription: d >= 70 && d <= 200,
    hasKeywords: !!strip(seo.keywords),
    hasAlt: !!strip(seo.image_alt),
    hasImage: !!p.primary_image_url,
  };
}

export const getSeoAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const sid = await storeId(context);
    const [{ data: products }, { data: recs }] = await Promise.all([
      sb.from("products").select("id, name, primary_image_url, meta").eq("store_id", sid).order("created_at", { ascending: false }).limit(1000),
      sb.from("seo_recommendations").select("id, entity_id, proposed_title, proposed_description, proposed_keywords, proposed_alt, reason, created_at").eq("store_id", sid).eq("entity_type", "product").eq("status", "pending").order("created_at", { ascending: false }).limit(300),
    ]);
    const list = (products ?? []) as any[];
    const byId = new Map(list.map((p) => [p.id, p]));
    let title = 0, desc = 0, kw = 0, alt = 0, img = 0;
    const missing: { id: string; name: string }[] = [];
    for (const p of list) {
      const s = productScore(p);
      if (s.hasTitle) title++;
      if (s.hasDescription) desc++;
      if (s.hasKeywords) kw++;
      if (s.hasAlt) alt++;
      if (s.hasImage) img++;
      if (!s.hasTitle || !s.hasDescription) missing.push({ id: p.id, name: p.name });
    }
    return {
      total: list.length,
      coverage: { title, description: desc, keywords: kw, alt, image: img },
      missingIds: missing.map((m) => m.id),
      allIds: list.map((p) => p.id),
      pending: ((recs ?? []) as any[])
        .filter((r: any) => byId.has(r.entity_id))
        .map((r: any): { id: string; entity_id: string; proposed_title: string | null; proposed_description: string | null; proposed_keywords: string | null; proposed_alt: string | null; name: string; image: string | null; current: { title: string; description: string; keywords: string; alt: string } } => {
          const p = byId.get(r.entity_id);
          const seo = p.meta?.seo ?? {};
          return {
            ...r,
            name: p.name as string,
            image: p.primary_image_url as string | null,
            current: { title: seo.title ?? "", description: seo.description ?? "", keywords: seo.keywords ?? "", alt: seo.image_alt ?? "" },
          };
        }),
    };
  });

/** One-click suggestion inside the product form. Returns a draft only — nothing is saved. */
export const suggestProductSeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      name: z.string().trim().min(1).max(200),
      brand: z.string().max(120).optional(),
      category: z.string().max(120).optional(),
      description: z.string().max(6000).optional(),
      price: z.number().optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await storeId(context);
    const d = await draftFor(data);
    if (!d) throw new Error("AI সাজেশন তৈরি করা যায়নি — একটু পরে আবার চেষ্টা করুন।");
    return d;
  });

/** Bulk: generate suggestions for a small batch (the UI loops batches with progress). */
export const generateBulkSeo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ productIds: z.array(z.string().uuid()).min(1).max(5) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const sid = await storeId(context);
    const [{ data: store }, { data: products }, { data: existing }, { data: tracking }] = await Promise.all([
      sb.from("stores").select("name").eq("id", sid).maybeSingle(),
      sb.from("products").select("id, name, brand, description, short_description, price, category_id, categories(name)").eq("store_id", sid).in("id", data.productIds),
      sb.from("seo_recommendations").select("entity_id").eq("store_id", sid).eq("entity_type", "product").eq("status", "pending").in("entity_id", data.productIds),
      sb.from("seo_change_tracking").select("entity_id, current_hash").eq("store_id", sid).eq("entity_type", "product").in("entity_id", data.productIds),
    ]);
    const skip = new Set((existing ?? []).map((r: any) => r.entity_id));
    const hashes = new Map((tracking ?? []).map((t: any) => [t.entity_id, t.current_hash]));
    let created = 0, skipped = 0, failed = 0;
    for (const p of (products ?? []) as any[]) {
      if (skip.has(p.id)) { skipped++; continue; }
      const d = await draftFor({
        name: p.name,
        brand: p.brand,
        category: p.categories?.name ?? null,
        description: [p.short_description, p.description].filter(Boolean).join("\n"),
        price: p.price,
        storeName: (store as any)?.name,
      });
      if (!d) { failed++; continue; }
      const { error } = await sb.from("seo_recommendations").insert({
        store_id: sid,
        entity_type: "product",
        entity_id: p.id,
        content_hash: hashes.get(p.id) ?? null,
        proposed_title: d.title,
        proposed_description: d.description,
        proposed_keywords: d.keywords,
        proposed_alt: d.alt,
        reason: "AI bulk optimizer",
        source: "manual_audit",
      });
      if (error) failed++; else created++;
    }
    return { created, skipped, failed };
  });

const editSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(120),
  description: z.string().max(320),
  keywords: z.string().max(400),
  alt: z.string().max(200),
});

export const approveSeoRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ items: z.array(editSchema).min(1).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    let ok = 0;
    const errors: string[] = [];
    for (const it of data.items) {
      const { error } = await sb.rpc("seo_apply_recommendation", {
        _id: it.id, _title: it.title, _description: it.description, _keywords: it.keywords, _alt: it.alt,
      });
      if (error) errors.push(error.message); else ok++;
    }
    return { applied: ok, failed: errors.length };
  });

export const rejectSeoRecommendations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ ids: z.array(z.string().uuid()).min(1).max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const sid = await storeId(context);
    const { error } = await sb
      .from("seo_recommendations")
      .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: context.userId })
      .eq("store_id", sid)
      .eq("status", "pending")
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
