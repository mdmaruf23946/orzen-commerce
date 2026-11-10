// Platform testimonials — public read + owner-only write.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PlatformReview = {
  id: string;
  name: string;
  store_name: string;
  avatar_url: string | null;
  rating: number;
  review: string;
  tone: string;
  is_visible: boolean;
  sort_order: number;
};

export const REVIEWS_FALLBACK: PlatformReview[] = [
  {
    id: "f1",
    name: "Nusrat Jahan",
    store_name: "Deshi Basket",
    avatar_url: null,
    rating: 5,
    review: "Setup took a Sunday afternoon. Courier booking with Pathao inside ORZEN saved us 4 hours a day.",
    tone: "#16a34a",
    is_visible: true,
    sort_order: 1,
  },
  {
    id: "f2",
    name: "Sabbir Hossain",
    store_name: "Techmart BD",
    avatar_url: null,
    rating: 5,
    review: "Pixel + retargeting is baked in. Our Facebook ROAS jumped from 2.1x to 5.4x.",
    tone: "#f59e0b",
    is_visible: true,
    sort_order: 2,
  },
  {
    id: "f3",
    name: "Ayesha Rahman",
    store_name: "Bloom Beauty",
    avatar_url: null,
    rating: 5,
    review: "The themes are beautiful. Customers keep asking who designed our store.",
    tone: "#db2777",
    is_visible: true,
    sort_order: 3,
  },
  {
    id: "f4",
    name: "Tanvir Ahmed",
    store_name: "Voltronics",
    avatar_url: null,
    rating: 5,
    review: "Inventory, invoices, analytics — one login. I stopped juggling five tabs.",
    tone: "#0ea5e9",
    is_visible: true,
    sort_order: 4,
  },
  {
    id: "f5",
    name: "Mahi Chowdhury",
    store_name: "Foodly",
    avatar_url: null,
    rating: 5,
    review: "Messenger AI confirms orders overnight. Morning routine: just print labels.",
    tone: "#dc2626",
    is_visible: true,
    sort_order: 5,
  },
  {
    id: "f6",
    name: "Arif Hossain",
    store_name: "Gadget Hub BD",
    avatar_url: null,
    rating: 5,
    review: "Landing pages plus COD confirmation calls doubled our conversion in a month.",
    tone: "#0f766e",
    is_visible: true,
    sort_order: 6,
  },
];

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  store_name: z.string().trim().max(80).default(""),
  avatar_url: z.string().max(600).nullable().default(null),
  rating: z.number().int().min(1).max(5).default(5),
  review: z.string().trim().min(1).max(600),
  tone: z.string().max(20).default("#0ea5e9"),
  is_visible: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(9999).default(0),
});

function publicClient() {
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function assertOwner(context: any) {
  const { data: role } = await (context.supabase as any)
    .from("user_roles")
    .select("id")
    .eq("user_id", context.userId)
    .eq("role", "owner")
    .maybeSingle();
  if (!role) throw new Error("Forbidden");
}

export const getPublicReviews = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { data, error } = await publicClient()
      .from("platform_reviews")
      .select("id, name, store_name, avatar_url, rating, review, tone, is_visible, sort_order")
      .eq("is_visible", true)
      .order("sort_order", { ascending: true })
      .limit(60);
    if (error || !data || !data.length) return REVIEWS_FALLBACK;
    return data as PlatformReview[];
  } catch {
    return REVIEWS_FALLBACK;
  }
});

export const listReviewsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context);
    const { data, error } = await (context.supabase as any)
      .from("platform_reviews")
      .select("id, name, store_name, avatar_url, rating, review, tone, is_visible, sort_order")
      .order("sort_order", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as PlatformReview[];
  });

export const upsertReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const payload: Record<string, unknown> = { ...data, updated_at: new Date().toISOString() };
    if (!data.id) delete payload["id"];
    const { error } = await (context.supabase as any).from("platform_reviews").upsert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertOwner(context);
    const { error } = await (context.supabase as any)
      .from("platform_reviews")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
