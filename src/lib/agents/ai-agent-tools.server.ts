// AI Commerce Engine — core agent logic used by storefront chat and Messenger webhook.
import { createClient } from "@supabase/supabase-js";
import { generateText, streamText, tool, stepCountIs } from "ai";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  sendProductCard as fbSendProductCard,
  sendProductCarousel as fbSendProductCarousel,
  sendViewSiteButton as fbSendViewSiteButton,
  sendQuickReplies as fbSendQuickReplies,
} from "@/lib/integrations/messenger-send.server";
import { checkDuplicate } from "@/lib/orders/duplicate-guard.server";
import { collectVerifiedFacts } from "@/lib/agents/reply-guard.server";
import {
  fetchDeliveryZones,
  money,
  orderStatusBn,
  resolveDeliveryCharge,
  shortOrderNo,
} from "@/lib/orders/chat-order-format";
import {
  ORDER_FIELD_LABELS,
  messengerPaymentMethods,
  normalizeOrderFlow,
  optionalSlotFields,
  renderConfirmation,
  requiredSlotFields,
  type OrderFieldKey,
} from "@/lib/integrations/messenger-order-flow";
import { replyStyleInstruction, SHORT_REPLY_RULE } from "@/lib/agents/reply-language";
import { deriveCustomerStyle, personaInstruction } from "@/lib/agents/customer-style";
import { specialistFocus, allowedToolsFor, stepBudget } from "@/lib/agents/specialists";
import { asksForHuman } from "@/lib/agents/conversation-guard.server";

import type { AgentContext, GlobalAiSettings, AgentState, FocusProduct } from "@/lib/agents/ai-agent-types";
import { BANGLA_SEARCH_SYNONYMS, DEICTIC_TOKENS, PRODUCT_SELECT_MIN, PRODUCT_STOPWORDS, PUBLIC_MESSENGER_ORIGIN, ProductKind, absoluteUrl, blockDuplicateMessengerToolOrder, canonicalCaption, clearConversationSlot, compactSummary, firstImage, getConversationSlot, isBroadBrowseQuery, isMessengerOrderable, isShortFollowUp, loadMessengerPaymentMethods, loadOrderFlow, normalizeCatalogProduct, normalizePhone, productKind, productSummary, productUrl, publicOrigin, resolveFocusProduct, scoreProductAgainstQuery, searchTerms, stringifyProductField, subscriptionBilling, updateConversationSlot, admin } from "@/lib/agents/ai-agent-catalog.server";
import { drawerBoundRules, buildSystemPrompt } from "@/lib/agents/ai-agent-prompt.server";

// ---------- Tools ----------
export function buildTools(ctx: AgentContext) {
  const sb = admin();
  const storeId = ctx.storeId;

  const catalogProductSelect =
    "product_id,name,slug,brand,product_code,sku,category_id,short_description,description,price,old_price,stock,status,product_type,meta,primary_image_url,gallery,features,specifications,variants,video_url,delivery_charge,delivery_time_days,rating,total_sold,warranty,return_policy,shipping_info,is_featured,low_stock_threshold,related_product_ids,source_created_at";

  const convId = ctx.conversationId ?? null;

  async function getBlacklistedIds(): Promise<Set<string>> {
    const { data } = await sb
      .from("ai_product_blacklist")
      .select("product_id")
      .eq("store_id", storeId);
    return new Set((data ?? []).map((r: any) => r.product_id));
  }

  async function logRecommendations(toolName: string, products: any[], contextText: string) {
    if (!convId || !products?.length) return;
    try {
      const rows = products.slice(0, 10).map((p: any) => ({
        store_id: storeId,
        conversation_id: convId,
        product_id: p.id,
        tool_name: toolName,
        context: contextText.slice(0, 500),
      }));
      await sb.from("ai_product_recommendations").insert(rows as any);
    } catch {
      /* non-fatal */
    }
  }

  async function categoryMap() {
    const { data } = await sb.from("categories").select("id,name").eq("store_id", storeId);
    return new Map((data ?? []).map((c: any) => [c.id, c.name]));
  }

  const tools: Record<string, any> = {
    searchProducts: tool({
      description:
        "Search this store's products. Use for any natural-language product intent (e.g. 'mini projector', 'waterproof bedsheet under 1000', 'cheapest fan'). Returns matching products with price, stock, image.",
      inputSchema: z.object({
        query: z.string().min(1).max(200).describe("Customer's search phrase or keyword"),
        category: z.string().optional().describe("Optional category name"),
        brand: z.string().optional(),
        minPrice: z.number().nonnegative().optional(),
        maxPrice: z.number().nonnegative().optional(),
        inStockOnly: z.boolean().optional().default(true),
        sort: z
          .enum(["relevance", "price_asc", "price_desc", "bestseller", "newest"])
          .optional()
          .default("relevance"),
        limit: z.number().int().min(1).max(10).optional().default(6),
      }),
      execute: async (input) => {
        let q = sb
          .from("ai_product_catalog")
          .select(catalogProductSelect)
          .eq("store_id", storeId)
          .eq("status", "active");
        if (input.brand) q = q.ilike("brand", `%${input.brand}%`);
        if (input.minPrice != null) q = q.gte("price", input.minPrice);
        if (input.maxPrice != null) q = q.lte("price", input.maxPrice);
        // Stock only gates physical products — digital/service/subscription are stockless.
        if (input.inStockOnly) q = q.or("stock.gt.0,product_type.neq.physical");

        const cats = await categoryMap();
        if (input.category) {
          const { data: cat } = await sb
            .from("categories")
            .select("id")
            .eq("store_id", storeId)
            .ilike("name", `%${input.category}%`)
            .maybeSingle();
          if (cat) q = q.eq("category_id", cat.id);
        }
        if (input.sort === "price_asc") q = q.order("price", { ascending: true });
        else if (input.sort === "price_desc") q = q.order("price", { ascending: false });
        else if (input.sort === "bestseller") q = q.order("total_sold", { ascending: false });
        else if (input.sort === "newest") q = q.order("source_created_at", { ascending: false });
        else
          q = q
            .order("is_featured", { ascending: false })
            .order("total_sold", { ascending: false });
        const { data: catalogRows } = await q.limit(500);
        const data = (catalogRows ?? []).map((product: any) => normalizeCatalogProduct(product));
        const blocked = await getBlacklistedIds();
        const terms = searchTerms(input.query);
        const phrase = input.query.toLowerCase().trim();
        const scored = (data ?? [])
          .filter((p: any) => !blocked.has(p.id))
          .map((p: any) => {
            const categoryName = cats.get(p.category_id) ?? "";
            const haystack = [
              p.name,
              p.brand,
              p.sku,
              p.product_code,
              categoryName,
              p.short_description,
              p.description,
              stringifyProductField(p.features),
              stringifyProductField(p.specifications),
              stringifyProductField(p.variants),
            ]
              .join(" ")
              .toLowerCase();
            let score = 0;
            if (phrase && haystack.includes(phrase)) score += 60;
            for (const term of terms) {
              if (haystack.includes(term)) score += 25;
              if (
                String(p.name ?? "")
                  .toLowerCase()
                  .includes(term)
              )
                score += 20;
              if (String(categoryName).toLowerCase().includes(term)) score += 15;
              if (
                String(p.brand ?? "")
                  .toLowerCase()
                  .includes(term)
              )
                score += 10;
            }
            if (p.stock > 0) score += 8;
            if (p.is_featured) score += 6;
            score += Math.min(Number(p.total_sold) || 0, 50) / 10;
            score += Math.min(Number(p.rating) || 0, 5);
            return { product: p, score };
          });
        const hasMeaningfulTerms = terms.length > 0;
        const matches = scored.filter((row) => row.score >= 25);
        const noMatch = hasMeaningfulTerms && matches.length === 0;
        // When the query matches nothing, never pass off unrelated products as
        // "recommendations" — return a small suggestion list instead and don't log it.
        const ranked = noMatch ? scored : hasMeaningfulTerms ? matches : scored;
        ranked.sort((a, b) => b.score - a.score);
        const filtered = ranked
          .slice(0, noMatch ? 3 : (input.limit ?? 6))
          .map((row) => row.product);
        if (!noMatch) await logRecommendations("searchProducts", filtered, input.query);
        return {
          products: filtered.map((p: any) => compactSummary(ctx, p, cats.get(p.category_id))),
          query_terms: terms,
          fallback_used: noMatch,
          no_match: noMatch,
          note: noMatch
            ? "No product matched the customer's query. Tell the customer this item is not available and only offer these as optional alternatives — do not claim they match the request."
            : undefined,
        };
      },
    }),

    getRecentRecommendations: tool({
      description:
        "Return the most recent products shown/recommended in this conversation. Use when the customer says this/that/এটা/এইটা/ছবি/details after a previous product recommendation.",
      inputSchema: z.object({
        limit: z.number().optional().default(5),
      }),
      execute: async ({ limit }) => {
        if (!convId) return { products: [] };
        const { data: recs } = await sb
          .from("ai_product_recommendations")
          .select("product_id,created_at,context")
          .eq("store_id", storeId)
          .eq("conversation_id", convId)
          .order("created_at", { ascending: false })
          .limit(Math.max(Number(limit ?? 5) * 3, 5));
        const ids = Array.from(
          new Set((recs ?? []).map((r: any) => r.product_id).filter(Boolean)),
        ).slice(0, limit ?? 5);
        if (!ids.length) return { products: [] };
        const [blocked, cats, productsResult] = await Promise.all([
          getBlacklistedIds(),
          categoryMap(),
          sb
            .from("ai_product_catalog")
            .select(catalogProductSelect)
            .eq("store_id", storeId)
            .eq("status", "active")
            .in("product_id", ids),
        ]);
        const byId = new Map((productsResult.data ?? []).map((row: any) => {
          const p = normalizeCatalogProduct(row);
          return [p.id, p];
        }));
        const products = ids
          .map((id) => byId.get(id))
          .filter((p: any) => p && !blocked.has(p.id))
          .map((p: any) => productSummary(ctx, p, cats.get(p.category_id)));
        return { products };
      },
    }),

    getProduct: tool({
      description:
        "Get full details of one product by id. Use before quoting exact price or specs.",
      inputSchema: z.object({ productId: z.string().uuid() }),
      execute: async ({ productId }) => {
        const blocked = await getBlacklistedIds();
        if (blocked.has(productId)) {
          return { blocked: true, message: "This product is unavailable. Suggest an alternative." };
        }
        const { data } = await sb
          .from("ai_product_catalog")
          .select(catalogProductSelect)
          .eq("store_id", storeId)
          .eq("product_id", productId)
          .maybeSingle();
        const product = data ? normalizeCatalogProduct(data as any) : null;
        if (product) await logRecommendations("getProduct", [product], "detail_view");
        const cats = await categoryMap();
        return product ? productSummary(ctx, product, cats.get(product.category_id)) : null;
      },
    }),

    listCategories: tool({
      description: "List product categories in this store.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await sb.from("categories").select("id,name").eq("store_id", storeId);
        return data ?? [];
      },
    }),

    listBrands: tool({
      description: "List distinct product brands sold in this store.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await sb
          .from("ai_product_catalog")
          .select("brand")
          .eq("store_id", storeId)
          .not("brand", "is", null);
        const set = new Set((data ?? []).map((r: any) => r.brand).filter(Boolean));
        return Array.from(set);
      },
    }),

    checkStock: tool({
      description: "Check real-time stock for a product (and variant if given).",
      inputSchema: z.object({
        productId: z.string().uuid(),
        variant: z.string().optional().describe("e.g. 'Red / M'"),
      }),
      execute: async ({ productId, variant }) => {
        const { data } = await sb
          .from("ai_product_catalog")
          .select("product_id,name,stock,variants,low_stock_threshold")
          .eq("store_id", storeId)
          .eq("product_id", productId)
          .maybeSingle();
        if (!data) return { found: false };
        let variantStock: number | null = null;
        if (variant && Array.isArray(data.variants)) {
          const v = (data.variants as any[]).find(
            (x) => String(x.label || x.name || "").toLowerCase() === variant.toLowerCase(),
          );
          if (v) variantStock = Number(v.stock ?? 0);
        }
        return {
          found: true,
          name: data.name,
          stock: variantStock ?? data.stock,
          low_stock: (variantStock ?? data.stock) <= (data.low_stock_threshold ?? 5),
        };
      },
    }),

    getDeliveryCharge: tool({
      description:
        "Get the exact delivery charge from the store's delivery areas. ALWAYS call this before quoting any delivery charge. Pass the customer's area/address if known, and productId if a product is being discussed.",
      inputSchema: z.object({
        area: z.string().optional().describe("Customer area/district/address, e.g. 'Dhaka' or 'Chittagong'"),
        productId: z.string().uuid().optional(),
      }),
      execute: async ({ area, productId }) => {
        const { cached } = await import("@/lib/ttl-cache.server");
        const zones = await cached(`zones:${storeId}`, 60_000, () => fetchDeliveryZones(sb, storeId));
        let productCharge: number | null = null;
        if (productId) {
          const { data } = await sb
            .from("products")
            .select("delivery_charge")
            .eq("store_id", storeId)
            .eq("id", productId)
            .maybeSingle();
          productCharge = (data as any)?.delivery_charge ?? null;
        }
        const matched = area ? resolveDeliveryCharge(area, zones, productCharge) : null;
        return {
          zones: zones.map((z: any) => ({ name: z.name, charge: Number(z.charge ?? 0), eta: z.eta ?? null })),
          matched_zone: matched?.zone?.name ?? null,
          matched_charge: matched ? matched.charge : null,
          product_delivery_charge: productCharge,
          instruction: "Quote only these numbers. If area is unknown, list the zone charges.",
        };
      },
    }),

    getStorePolicy: tool({
      description:
        "Get the store's real delivery time (per area) and return/exchange policy. ALWAYS call this before stating any delivery time or return/exchange rule. Never state a policy the tool didn't return.",
      inputSchema: z.object({ productId: z.string().uuid().optional() }),
      execute: async ({ productId }) => {
        const { loadStorePolicy } = await import("@/lib/agents/store-policy.server");
        return loadStorePolicy(sb, storeId, productId ?? null);
      },
    }),


    getRelatedProducts: tool({
      description:
        "Get related products for upsell/cross-sell. kind='similar' returns same-category products; 'accessory'/'upsell' returns curated related_product_ids.",
      inputSchema: z.object({
        productId: z.string().uuid(),
        kind: z.enum(["similar", "accessory", "upsell"]).default("similar"),
        limit: z.number().int().min(1).max(6).default(4),
      }),
      execute: async ({ productId, kind, limit }) => {
        const { data: p } = await sb
          .from("ai_product_catalog")
          .select("product_id,category_id,related_product_ids")
          .eq("store_id", storeId)
          .eq("product_id", productId)
          .maybeSingle();
        if (!p) return [];
        if (
          kind !== "similar" &&
          Array.isArray(p.related_product_ids) &&
          p.related_product_ids.length
        ) {
          const { data } = await sb
            .from("ai_product_catalog")
            .select(catalogProductSelect)
            .eq("store_id", storeId)
            .in("product_id", p.related_product_ids as any)
            .eq("status", "active")
            .gt("stock", 0)
            .limit(limit);
          return (data ?? []).map((row: any) => normalizeCatalogProduct(row));
        }
        if (!p.category_id) return [];
        const { data } = await sb
          .from("ai_product_catalog")
          .select(catalogProductSelect)
          .eq("store_id", storeId)
          .eq("category_id", p.category_id)
          .neq("product_id", productId)
          .eq("status", "active")
          .gt("stock", 0)
          .limit(limit);
        return (data ?? []).map((row: any) => normalizeCatalogProduct(row));
      },
    }),

    compareProducts: tool({
      description:
        "Compare 2-4 products side by side (price, features, stock, rating) and get a recommended pick.",
      inputSchema: z.object({
        productIds: z.array(z.string().uuid()).min(2).max(4),
      }),
      execute: async ({ productIds }) => {
        const { data } = await sb
          .from("ai_product_catalog")
          .select("product_id,name,price,old_price,stock,features,specifications,rating,total_sold")
          .eq("store_id", storeId)
          .in("product_id", productIds);
        const rows = (data ?? []).map((row: any) => normalizeCatalogProduct(row));
        // Score: rating * 20 + in-stock bonus + normalized price (lower better)
        const maxPrice = Math.max(...rows.map((r) => Number(r.price) || 0), 1);
        const scored = rows.map((r) => {
          const s =
            (Number(r.rating) || 0) * 20 +
            (r.stock > 0 ? 15 : 0) +
            (1 - Number(r.price) / maxPrice) * 30 +
            (Number(r.total_sold) || 0) * 0.1;
          return { ...r, score: s };
        });
        scored.sort((a, b) => (b as any).score - (a as any).score);
        return { comparison: scored, recommended: scored[0]?.id };
      },
    }),
  };

  // Messenger-only tools that need PSID + token
  if (ctx.psid && ctx.pageToken) {
    const messengerPsid = ctx.psid;
    const messengerPageToken = ctx.pageToken;
    tools.sendProductCard = tool({
      description:
        "Send one product to the customer as a rich Messenger card with Buy Now / View Product buttons. Prefer this over describing a product in plain text.",
      inputSchema: z.object({ productId: z.string().uuid() }),
      execute: async ({ productId }) => {
        if (ctx.focusProductId && productId !== ctx.focusProductId) {
          return {
            sent: false,
            error: "must_use_focus_product",
            focus_product_id: ctx.focusProductId,
          };
        }
        const { data: p } = await sb
          .from("ai_product_catalog")
          .select(
            "product_id,name,slug,short_description,price,old_price,stock,product_type,meta,primary_image_url,gallery",
          )
          .eq("store_id", storeId)
          .eq("product_id", productId)
          .maybeSingle();
        if (!p) return { sent: false, error: "not_found" };
        const product = normalizeCatalogProduct(p as any);

        const kind = productKind(product);
        const orderable = kind === "physical";
        const priceLine = product.old_price ? `৳${product.price} (was ৳${product.old_price})` : `৳${product.price}`;
        const statusLine = orderable
          ? product.stock > 0
            ? "In stock"
            : "Out of stock"
          : "Buy on website";
        const subtitle = `${priceLine} · ${statusLine}${product.short_description ? " — " + product.short_description : ""}`;
        try {
          await fbSendProductCard(messengerPageToken, messengerPsid, {
            title: product.name,
            subtitle,
            image_url: firstImage(ctx, product),
            buy_url: productUrl(ctx, product.slug, product.id),
            product_id: product.id,
            orderable,
          });

          // Ordering runs through the card's own "Buy Now" postback button, so
          // no extra quick reply is attached below the card.
          if (ctx.conversationId) {
            await sb.from("ai_messages").insert({
              conversation_id: ctx.conversationId,
              role: "assistant",
              direction: "out",
              message_type: "product_card",
              content: `[card] ${product.name}`,
              attachments: [{ type: "product_card", product_id: product.id }],
            } as any);
          }
          return {
            sent: true,
            canonical_caption: canonicalCaption(product as any),
            product_id: product.id,
            name: product.name,
            product_type: kind,
            purchase_channel: orderable ? "messenger" : "website",
            product_url: productUrl(ctx, product.slug, product.id),
            ...(kind === "subscription" ? { subscription: subscriptionBilling(product) } : {}),
          };
        } catch (e) {
          return { sent: false, error: (e as Error).message };
        }
      },
    });

    tools.sendProductCarousel = tool({
      description:
        "Send multiple products as a scrollable carousel. Use for search results, comparisons, and upsell suggestions.",
      inputSchema: z.object({
        productIds: z.array(z.string().uuid()).min(1).max(10),
      }),
      execute: async ({ productIds }) => {
        const { data } = await sb
          .from("ai_product_catalog")
          .select(
            "product_id,name,slug,short_description,price,old_price,stock,product_type,meta,primary_image_url,gallery",
          )
          .eq("store_id", storeId)
          .in("product_id", productIds);
        const items = (data ?? []).map((row: any) => {
          const p = normalizeCatalogProduct(row);
          const kind = productKind(p);
          const orderable = kind === "physical";
          return {
            title: p.name,
            subtitle: `${p.old_price ? `৳${p.price} (was ৳${p.old_price})` : `৳${p.price}`} · ${orderable ? (p.stock > 0 ? "In stock" : "Out of stock") : "Buy on website"}`,
            image_url: firstImage(ctx, p),
            buy_url: productUrl(ctx, p.slug, p.id),
            product_id: p.id,
            orderable,
            product_type: kind,
          };
        });

        if (!items.length) return { sent: false, error: "no_products" };
        try {
          await fbSendProductCarousel(ctx.pageToken!, ctx.psid!, items);
          // Ordering runs through each card's own "Buy Now" postback button, so
          // no extra quick reply row is attached below the carousel.
          if (ctx.conversationId) {
            await sb.from("ai_messages").insert({
              conversation_id: ctx.conversationId,
              role: "assistant",
              direction: "out",
              message_type: "product_carousel",
              content: `[carousel] ${items.length} products`,
              attachments: items.map((i) => ({ type: "product_card", product_id: i.product_id })),
            } as any);
          }
          return {
            sent: true,
            count: items.length,
            products: items.map((i) => ({
              product_id: i.product_id,
              product_type: i.product_type,
              purchase_channel: i.orderable ? "messenger" : "website",
              product_url: i.buy_url,
            })),
          };
        } catch (e) {
          return { sent: false, error: (e as Error).message };
        }
      },
    });

    tools.sendProductLink = tool({
      description:
        "Send a 'View site' button that opens the product page on the website. Use this whenever a digital/service/subscription product is discussed, when the customer asks for a link, or when you need to share any product URL — NEVER type the raw URL in a text reply.",
      inputSchema: z.object({
        productId: z.string().uuid(),
        text: z
          .string()
          .min(1)
          .max(640)
          .describe(
            "Short friendly sentence above the button, e.g. 'এই প্রোডাক্টটি আমাদের ওয়েবসাইট থেকে নিরাপদে কিনতে পারবেন'",
          ),
      }),
      execute: async ({ productId, text }) => {
        const { data: p } = await sb
          .from("ai_product_catalog")
          .select("product_id,name,slug,product_type")
          .eq("store_id", storeId)
          .eq("product_id", productId)
          .maybeSingle();
        if (!p) return { sent: false, error: "not_found" };
        const product = normalizeCatalogProduct(p as any);
        const url = productUrl(ctx, product.slug, product.id);
        try {
          await fbSendViewSiteButton(ctx.pageToken!, ctx.psid!, text, url);
          return { sent: true, product_url: url };
        } catch (e) {
          return { sent: false, error: (e as Error).message };
        }
      },
    });
  }

  // WhatsApp tools — image + caption, plus a Buy now / View site button.
  if (ctx.channel === "whatsapp" && ctx.waTo && ctx.waToken && ctx.waPhoneNumberId) {
    const waSend = () => import("@/lib/integrations/whatsapp-send.server");

    tools.sendProductCard = tool({
      description:
        "Send one product to the WhatsApp customer with its photo, price, stock and a Buy now button. Prefer this over describing a product in plain text.",
      inputSchema: z.object({ productId: z.string().uuid() }),
      execute: async ({ productId }) => {
        if (ctx.focusProductId && productId !== ctx.focusProductId) {
          return {
            sent: false,
            error: "must_use_focus_product",
            focus_product_id: ctx.focusProductId,
          };
        }
        const { data: p } = await sb
          .from("products")
          .select(
            "id,name,slug,short_description,price,old_price,stock,product_type,meta,primary_image_url,gallery",
          )
          .eq("store_id", storeId)
          .eq("id", productId)
          .maybeSingle();
        if (!p) return { sent: false, error: "not_found" };

        const kind = productKind(p);
        const orderable = kind === "physical";
        const url = productUrl(ctx, p.slug, p.id);
        const image = firstImage(ctx, p);
        const priceLine = p.old_price ? `৳${p.price} (আগে ৳${p.old_price})` : `৳${p.price}`;
        const statusLine = orderable
          ? p.stock > 0
            ? "স্টকে আছে"
            : "স্টকে নেই"
          : "ওয়েবসাইট থেকে কিনতে হবে";
        const caption = [`*${p.name}*`, `${priceLine} · ${statusLine}`, p.short_description ?? ""]
          .filter(Boolean)
          .join("\n");
        try {
          const wa = await waSend();
          if (image) {
            await wa.sendWaImage(ctx.waPhoneNumberId!, ctx.waToken!, ctx.waTo!, image, caption);
          } else {
            await wa.sendWaText(ctx.waPhoneNumberId!, ctx.waToken!, ctx.waTo!, caption);
          }
          if (orderable && p.stock > 0) {
            await wa.sendWaButtons(ctx.waPhoneNumberId!, ctx.waToken!, ctx.waTo!, "কী করতে চান?", [
              { id: `BUY_${p.id}`, title: "Buy now" },
            ]);
          } else {
            await wa.sendWaCtaUrl(
              ctx.waPhoneNumberId!,
              ctx.waToken!,
              ctx.waTo!,
              "ওয়েবসাইট থেকে নিরাপদে কিনতে পারবেন",
              url,
            );
          }
          if (ctx.conversationId) {
            await sb.from("ai_messages").insert({
              conversation_id: ctx.conversationId,
              role: "assistant",
              direction: "out",
              message_type: "product_card",
              content: `[card] ${p.name}`,
              attachments: [{ type: "product_card", product_id: p.id, image_url: image, url }],
              delivery_status: "sent",
            } as any);
          }
          return {
            sent: true,
            has_image: !!image,
            canonical_caption: canonicalCaption(p as any),
            product_id: p.id,
            name: p.name,
            product_type: kind,
            purchase_channel: orderable ? "whatsapp" : "website",
            product_url: url,
          };
        } catch (e) {
          return { sent: false, error: (e as Error).message };
        }
      },
    });

    tools.sendProductLink = tool({
      description:
        "Send a 'View site' button that opens the product page on the website. Use for digital/service/subscription products or whenever the customer asks for a link — never type the raw URL yourself.",
      inputSchema: z.object({
        productId: z.string().uuid(),
        text: z.string().min(1).max(600).describe("Short friendly sentence above the button"),
      }),
      execute: async ({ productId, text }) => {
        const { data: p } = await sb
          .from("products")
          .select("id,name,slug,product_type")
          .eq("store_id", storeId)
          .eq("id", productId)
          .maybeSingle();
        if (!p) return { sent: false, error: "not_found" };
        const url = productUrl(ctx, p.slug, p.id);
        try {
          const wa = await waSend();
          await wa.sendWaCtaUrl(ctx.waPhoneNumberId!, ctx.waToken!, ctx.waTo!, text, url);
          if (ctx.conversationId) {
            await sb.from("ai_messages").insert({
              conversation_id: ctx.conversationId,
              role: "assistant",
              direction: "out",
              message_type: "button",
              content: text,
              attachments: [{ type: "web_url", url }],
              delivery_status: "sent",
            } as any);
          }
          return { sent: true, product_url: url };
        } catch (e) {
          return { sent: false, error: (e as Error).message };
        }
      },
    });
  }

  // Web-only display tools — return structured JSON that the chat panel renders inline.
  if (ctx.channel === "web") {
    async function loadProducts(ids: string[]) {
      if (!ids.length) return [];
      const [blocked, cats, res] = await Promise.all([
        getBlacklistedIds(),
        categoryMap(),
        sb.from("ai_product_catalog").select(catalogProductSelect).eq("store_id", storeId).in("product_id", ids),
      ]);
      const byId = new Map((res.data ?? []).map((row: any) => {
        const p = normalizeCatalogProduct(row);
        return [p.id, p];
      }));
      return ids
        .map((id) => byId.get(id))
        .filter((p: any) => p && !blocked.has(p.id))
        .map((p: any) => productSummary(ctx, p, cats.get(p.category_id)));
    }

    tools.showProduct = tool({
      description:
        "Display ONE product to the web-chat customer as a rich card (image, name, price, stock, view/buy buttons). Use whenever you want the customer to see a specific product.",
      inputSchema: z.object({ productId: z.string().uuid() }),
      execute: async ({ productId }) => {
        if (ctx.focusProductId && productId !== ctx.focusProductId) {
          return {
            rendered: false,
            error: "must_use_focus_product",
            focus_product_id: ctx.focusProductId,
          };
        }
        const products = await loadProducts([productId]);
        if (!products.length) return { rendered: false, error: "not_found" };
        await logRecommendations("showProduct", products, "web_card");
        return {
          rendered: true,
          products,
          canonical_caption: canonicalCaption(products[0] as any),
        };
      },
    });

    tools.showProducts = tool({
      description:
        "Display up to 10 products to the web-chat customer as a scrollable carousel. Use for search results, comparisons, and cross-sell suggestions.",
      inputSchema: z.object({ productIds: z.array(z.string().uuid()).min(1).max(10) }),
      execute: async ({ productIds }) => {
        const products = await loadProducts(productIds);
        if (!products.length) return { rendered: false, error: "no_products" };
        await logRecommendations("showProducts", products, "web_carousel");
        return { rendered: true, products };
      },
    });
  }

  // Conversation-aware tools (order flow, memory, escalation)
  if (ctx.conversationId) {
    const convId = ctx.conversationId;

    tools.collectOrderInfo = tool({
      description:
        "Save one or more fields the customer just provided for their pending order. Only pass fields the customer explicitly gave. Returns which required fields are still missing.",
      inputSchema: z.object({
        customer_name: z.string().optional(),
        phone: z.string().optional(),
        district: z.string().optional(),
        upazila: z.string().optional(),
        union: z.string().optional(),
        village: z.string().optional(),
        full_address: z.string().optional(),
        product_id: z.string().uuid().optional(),
        variant: z.string().optional(),
        qty: z.number().int().min(1).max(99).optional(),
        delivery_method: z.string().optional(),
        payment_method: z.enum(["cod", "bkash", "nagad", "rocket", "bank"]).optional(),
      }),
      execute: async (input) => {
        const patch: Record<string, any> = {};
        Object.entries(input).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") patch[k] = v;
        });
        // Never store a question, greeting or product talk as name/address.
        const rejected: Record<string, string> = {};
        {
          const { checkPersonName, cleanNameValue, isLikelyAddress } = await import("@/lib/agents/slot-validate");
          if (patch.customer_name) {
            const nm = cleanNameValue(String(patch.customer_name));
            const c = checkPersonName(nm);
            if (!c.ok && c.hard) {
              delete patch.customer_name;
              rejected.customer_name = `"${input.customer_name}" is not a person's name (${c.reason}). Ask the customer for their name.`;
            } else patch.customer_name = nm;
          }
          if (patch.full_address && !isLikelyAddress(String(patch.full_address), { lenient: true })) {
            rejected.full_address = `"${input.full_address}" is not an address. Ask the customer for their full address.`;
            delete patch.full_address;
          }
        }
        // Hard rule: only physical products can be ordered inside Messenger.
        if (patch.product_id) {
          const { data: p } = await sb
            .from("ai_product_catalog")
            .select("product_id,name,slug,product_type")
            .eq("store_id", storeId)
            .eq("product_id", patch.product_id)
            .maybeSingle();
          if (!p) return { saved: {}, error: "product_not_found" };
          const product = normalizeCatalogProduct(p as any);
          if (!isMessengerOrderable(product)) {
            return {
              saved: {},
              error: "not_orderable_in_messenger",
              product_type: productKind(product),
              product_name: product.name,
              product_url: productUrl(ctx, product.slug, product.id),
              instruction:
                "This product is purchased on the website only. Do not collect order or payment details. Politely tell the customer and send the product_url.",
            };
          }
        }
        const slot = await updateConversationSlot(convId, patch);
        const cfg = await loadOrderFlow(storeId);
        const required = requiredSlotFields(cfg);
        const missing = required.filter((f) => !slot[f]);
        const optional = optionalSlotFields(cfg).filter((f) => !slot[f]);
        return {
          saved: patch,
          ...(Object.keys(rejected).length ? { rejected } : {}),
          current: slot,
          missing,
          optional_not_asked: optional,
          collection_style: cfg.collection_style,
          allowed_payment_methods: (await loadMessengerPaymentMethods(storeId)).map((m) => m.id),
        };
      },
    });

    tools.finalizeOrder = tool({
      description:
        "Create the order after collectOrderInfo has all required fields. Reserves stock, generates invoice, sends confirmation. Returns orderId and totals.",
      inputSchema: z.object({}),
      execute: async () => {
        const slot = await getConversationSlot(convId);
        const cfg = await loadOrderFlow(storeId);
        const required = requiredSlotFields(cfg);
        const missing = required.filter((f) => !slot[f]);
        if (missing.length) return { ok: false, error: "missing_fields", missing };
        // Quantity is optional in some store configs — default to 1.
        const qty = Math.max(1, Number(slot.qty ?? 1) || 1);
        slot.qty = qty;

        const { data: product } = await sb
          .from("products")
          .select("id,name,slug,price,stock,delivery_charge,product_type")
          .eq("store_id", storeId)
          .eq("id", slot.product_id)
          .maybeSingle();
        if (!product) return { ok: false, error: "product_not_found" };
        // Defence in depth: never create a digital/service/subscription order from Messenger.
        if (!isMessengerOrderable(product)) {
          return {
            ok: false,
            error: "not_orderable_in_messenger",
            product_type: productKind(product),
            product_name: product.name,
            product_url: productUrl(ctx, product.slug, product.id),
            instruction:
              "Do not create an order. Tell the customer this is purchased on the website and send the product_url.",
          };
        }
        if (product.stock < slot.qty)
          return { ok: false, error: "out_of_stock", available: product.stock };

        const duplicateBlocked = await blockDuplicateMessengerToolOrder({
          sb,
          storeId,
          conversationId: convId,
          psid: ctx.psid,
          slot,
          product: { id: product.id, name: product.name },
        });
        if (duplicateBlocked) return duplicateBlocked;

        const subtotal = Number(product.price) * Number(slot.qty);
        // Delivery charge follows the merchant's delivery areas, matched by address.
        const addressText = [slot.full_address, slot.village, slot.union, slot.upazila, slot.district]
          .filter(Boolean)
          .join(", ");
        const zones = await fetchDeliveryZones(sb, storeId);
        const { charge: delivery, zone } = resolveDeliveryCharge(
          addressText,
          zones,
          product.delivery_charge,
        );

        // Link to store_customers by phone
        let customerId: string | null = null;
        const phoneNorm = normalizePhone(slot.phone) ?? String(slot.phone).replace(/\D/g, "");
        if (phoneNorm) {
          const { data: existing } = await sb
            .from("store_customers")
            .select("id")
            .eq("store_id", storeId)
            .eq("phone", phoneNorm)
            .maybeSingle();
          if (existing) customerId = existing.id;
        }

        // One transaction: idempotency lock → stock check under row lock →
        // invoice number → order + items. Same key within 30 min = same order.
        const { buildIdempotencyKey, createChatOrder } = await import("@/lib/orders/chat-order.server");
        const created = await createChatOrder(
          sb,
          storeId,
          buildIdempotencyKey({
            channel: String((ctx as any).channel ?? "chat"),
            conversationId: convId,
            productId: product.id,
            variant: (slot as any).variant ?? null,
            qty: slot.qty,
            phone: phoneNorm || slot.phone,
          }),
          {
            customer_name: slot.customer_name,
            phone: phoneNorm || slot.phone,
            address: slot.full_address,
            area:
              [slot.village, slot.union, slot.upazila, slot.district].filter(Boolean).join(", ") ||
              zone?.name ||
              null,
            payment_method: slot.payment_method || "cod",
            subtotal: subtotal + delivery,
            delivery_amount: delivery,
            delivery_zone_id: zone?.id ?? null,
            notes: "Placed via AI Sales Agent (Messenger)",
            customer_id: customerId,
          },
          [{ product_id: product.id, name: product.name, price: Number(product.price), qty: slot.qty }],
        );
        if (!created.ok) {
          if (created.error === "out_of_stock")
            return { ok: false, error: "out_of_stock", available: (created as any).available };
          return { ok: false, error: created.error };
        }
        const order = { id: created.id, invoice_no: created.invoice_no };
        if (created.existing) {
          await clearConversationSlot(convId);
          const no = shortOrderNo(order.invoice_no, order.id);
          return {
            ok: true,
            duplicate: true,
            orderId: order.id,
            invoice_no: no,
            instruction: `This order was ALREADY placed. Do not create another. Tell the customer: "আপনার অর্ডার #${no} আগেই নেওয়া হয়েছে।"`,
          };
        }

        // Admin notification
        await sb.from("admin_notifications").insert({
          store_id: storeId,
          kind: "new_order",
          title: "New AI order",
          body: `${slot.customer_name} ordered ${slot.qty}× ${product.name}`,
          meta: { order_id: order.id },
        } as any);

        await clearConversationSlot(convId);

        const orderNo = shortOrderNo(order.invoice_no, order.id);
        const confirmation = [
          renderConfirmation(cfg.confirmation_message, {
            product: product.name,
            qty,
            total: money(subtotal + delivery),
            customer_name: slot.customer_name,
            address: slot.full_address,
            payment_method: "ক্যাশ অন ডেলিভারি",
            invoice_no: orderNo,
          }),
          `অর্ডার নম্বর: ${orderNo}`,
          `পণ্যের মূল্য: ${money(subtotal)}`,
          `ডেলিভারি চার্জ${zone ? ` (${zone.name})` : ""}: ${money(delivery)}`,
          `সর্বমোট: ${money(subtotal + delivery)}`,
          "পেমেন্ট: ক্যাশ অন ডেলিভারি",
        ]
          .filter(Boolean)
          .join("\n");

        return {
          ok: true,
          orderId: order.id,
          invoice_no: orderNo,
          subtotal,
          delivery,
          grand_total: subtotal + delivery,
          product_name: product.name,
          qty,
          confirmation_message: confirmation,
          instruction:
            "Send confirmation_message to the customer exactly as written. Never show the internal orderId; the order number is invoice_no.",
        };
      },
    });

    tools.trackOrder = tool({
      description:
        "Look up the customer's orders (placed on ANY channel: website, landing page, phone call, Messenger, WhatsApp). Pass phone and/or invoice_no. If omitted, the customer's known number (e.g. WhatsApp) is used automatically.",
      inputSchema: z.object({
        invoice_no: z.string().optional(),
        phone: z.string().optional(),
      }),
      execute: async ({ invoice_no, phone }) => {
        const { lookupOrders, extractPhone, TRACKING_GUIDE } = await import("@/lib/orders/order-lookup.server");
        let usedPhone = phone ? extractPhone(phone) ?? phone : null;
        let source: "given" | "known" | "none" = usedPhone ? "given" : "none";
        if (!usedPhone && convId) {
          const { data: conv } = await sb
            .from("ai_conversations")
            .select("phone")
            .eq("id", convId)
            .maybeSingle();
          if ((conv as any)?.phone) {
            usedPhone = (conv as any).phone;
            source = "known";
          }
        }
        if (!usedPhone && !invoice_no) {
          return { orders: [], need: "phone", instruction: TRACKING_GUIDE };
        }
        const orders = await lookupOrders(sb, storeId, { phone: usedPhone, invoice: invoice_no });
        if (orders.length && source === "given" && convId) {
          await sb.from("ai_conversations").update({ phone: usedPhone } as never).eq("id", convId);
        }
        return { phone_source: source, orders, instruction: TRACKING_GUIDE };
      },
    });

    tools.getCustomerMemory = tool({
      description:
        "Get what we know about the current customer: previous orders, favourite products, preferred language.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data: conv } = await sb
          .from("ai_conversations")
          .select("customer_name,phone,psid_profile")
          .eq("id", convId)
          .maybeSingle();
        if (!conv) return {};
        const phoneNorm = conv.phone ? String(conv.phone).replace(/\D/g, "") : null;
        let customer: any = null;
        if (phoneNorm) {
          const { data } = await sb
            .from("store_customers")
            .select("id,full_name,ai_memory,preferred_language")
            .eq("store_id", storeId)
            .eq("phone", phoneNorm)
            .maybeSingle();
          customer = data;
        }
        let recentOrders: any[] = [];
        if (customer?.id) {
          const { data } = await sb
            .from("orders")
            .select("id,invoice_no,status,subtotal,created_at")
            .eq("store_id", storeId)
            .eq("customer_id", customer.id)
            .order("created_at", { ascending: false })
            .limit(5);
          recentOrders = data ?? [];
        }
        return {
          name: conv.customer_name,
          profile: conv.psid_profile,
          customer,
          recent_orders: recentOrders,
        };
      },
    });

    tools.escalateToHuman = tool({
      description:
        "Hand this conversation to a human agent. Use when you cannot answer confidently or the customer asks for a person.",
      inputSchema: z.object({ reason: z.string().min(1).max(500) }),
      execute: async ({ reason }) => {
        await sb
          .from("ai_conversations")
          .update({
            handoff_mode: "human",
            handoff_reason: reason,
            handoff_at: new Date().toISOString(),
          } as any)
          .eq("id", convId);
        await sb.from("admin_notifications").insert({
          store_id: storeId,
          kind: "human_handoff",
          title: "Customer needs a human",
          body: reason,
          meta: { conversation_id: convId },
        } as any);
        return { ok: true, message: "Handed off to human agent" };
      },
    });
  }

  return tools;
}
