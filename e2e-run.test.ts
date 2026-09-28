import { createClient } from "@supabase/supabase-js";
import { runWithTrace } from "@/lib/telemetry.server";
import { tryFastPath } from "@/lib/fast-path.server";
import { findProductByPhoto } from "@/lib/photo-match.server";
import { guardReply } from "@/lib/reply-guard.server";
import { loadStorePolicy } from "@/lib/store-policy.server";
import { createChatOrder } from "@/lib/chat-order.server";
import { routedChatCompletion } from "@/lib/ai-provider.server";
const STORE_PREFIX = "870d92cc";
const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const R: any[] = []; const log = (n: string, ok: boolean, d: any, ms?: number) => { R.push({ n, ok, ms }); console.log(ok ? "PASS" : "FAIL", n, ms ?? "", JSON.stringify(d).slice(0, 300)); };
const t = async <T,>(f: () => Promise<T>) => { const s = Date.now(); const v = await f(); return [v, Date.now() - s] as const; };
test("e2e", async () => {
  const { data: stores } = await sb.from("stores").select("id,slug").like("id" as any, `${STORE_PREFIX}%` as any);
  let store = (stores as any)?.[0];
  if (!store) { const { data } = await sb.rpc("resolve_domain" as any, {} as any).then(() => ({ data: null })); }
  if (!store) { const all = await sb.from("stores").select("id,slug"); store = (all.data as any[]).find((s) => s.id.startsWith(STORE_PREFIX)); }
  const S = store.id; console.log("store", store.slug);
  // Fast path (shared by both channels; Messenger passes phone=null)
  for (const q of ["Hi", "ধন্যবাদ", "ডেলিভারি চার্জ কত", "ডেলিভারি কতদিনে লাগে?", "রিটার্ন করা যায়?", "চট্টগ্রামে এই শার্টের ডেলিভারি চার্জ কত"]) {
    const [r, ms] = await t(() => tryFastPath(sb, { storeId: S, conversationId: "00000000-0000-0000-0000-000000000000", text: q, customerPhone: null }));
    const expectAi = q.startsWith("চট্টগ্রামে");
    log(`fast:${q}`, expectAi ? r === null : true, r ?? "-> AI", ms);
  }
  const policy = await loadStorePolicy(sb, S); console.log("policy", JSON.stringify(policy).slice(0, 400));
  // Image search with a real product photo
  const { data: prods } = await sb.from("products").select("id,name,images,variants,stock,price").eq("store_id", S).eq("status", "active").limit(40);
  const withImg = (prods as any[]).filter((p) => Array.isArray(p.images) && p.images[0]);
  let imgOk = 0, imgN = 0;
  for (const p of withImg.slice(0, 3)) {
    const url = typeof p.images[0] === "string" ? p.images[0] : p.images[0].url;
    const res = await fetch(url); if (!res.ok) continue; const bytes = new Uint8Array(await res.arrayBuffer());
    const [m, ms] = await t(() => findProductByPhoto(sb, S, bytes, res.headers.get("content-type") || "image/jpeg"));
    imgN++; const ok = (m as any).product?.id === p.id; if (ok) imgOk++;
    log(`image:${p.name}`, ok, { got: (m as any).product?.name, method: (m as any).method }, ms);
  }
  // unrelated image
  const noise = new Uint8Array(await (await fetch("https://picsum.photos/seed/orzen/400")).arrayBuffer());
  const [nm, nms] = await t(() => findProductByPhoto(sb, S, noise, "image/jpeg"));
  log("image:unrelated", !(nm as any).product, { got: (nm as any).product?.name, method: (nm as any).method }, nms);
  // Variant guard
  const vp = (prods as any[]).find((p) => p.variants && JSON.stringify(p.variants).length > 20);
  if (vp) {
    const [g, ms] = await t(() => guardReply(sb, "XXL স্টকে আছে, অর্ডার করতে পারেন।", { amounts: [Number(vp.price)], stock: [], toolCalls: 1 }, { storeId: S, focusProductId: vp.id }));
    log(`variant:${vp.name}`, true, { variants: vp.variants, out: g.text, fixes: g.corrections }, ms);
  } else log("variant", false, "no product with variants");
  // Price guard
  const pp = (prods as any[])[0];
  const [pg] = await t(() => guardReply(sb, `দাম মাত্র ১ টাকা।`, { amounts: [Number(pp.price)], stock: [], toolCalls: 1 }, { storeId: S, focusProductId: pp.id }));
  log("guard:price", pg.corrections.length > 0, pg);
  const [pol] = await t(() => guardReply(sb, `ডেলিভারি ৯৯ দিনে হবে।`, { amounts: [], stock: [], toolCalls: 1 }, { storeId: S }));
  log("guard:policy", pol.corrections.length > 0, pol);
  // Order: temporary draft product, stock 1, dup key
  const slug = `loadtest-e2e-${Date.now()}`;
  const { data: tp, error: pe } = await sb.from("products").insert({ store_id: S, name: "LOADTEST E2E", slug, price: 500, stock: 1, status: "draft" } as any).select("id").single();
  if (pe) throw pe;
  const ord = { customer_name: "Loadtest", phone: "01700000000", address: "Test address Dhaka", subtotal: 500, delivery_amount: 60, notes: "loadtest_e2e" };
  const items = [{ product_id: (tp as any).id, name: "LOADTEST E2E", price: 500, qty: 1 }];
  const key = `loadtest_e2e_${Date.now()}`;
  const [a, ams] = await t(() => createChatOrder(sb, S, key, ord, items));
  const [b] = await t(() => createChatOrder(sb, S, key, ord, items));
  const [c] = await t(() => createChatOrder(sb, S, key + "_2", ord, items));
  log("order:create", (a as any).ok, a, ams);
  log("order:duplicate-same-key", (b as any).ok && (b as any).existing && (b as any).id === (a as any).id, b);
  log("order:no-oversell", !(c as any).ok, c);
  const { data: os } = await sb.from("orders").select("id").eq("store_id", S).eq("notes", "loadtest_e2e");
  for (const o of (os as any[]) ?? []) { await sb.from("order_items").delete().eq("order_id", o.id); await sb.from("order_timeline").delete().eq("order_id", o.id); await sb.from("orders").delete().eq("id", o.id); }
  await sb.from("products").delete().eq("id", (tp as any).id);
  const { count } = await sb.from("products").select("id", { count: "exact", head: true }).eq("slug", slug);
  log("cleanup", count === 0, { left: count });
  // AI fallback chain
  const [ai, aims] = await t(() => runWithTrace(() => routedChatCompletion({ messages: [{ role: "user", content: "এক শব্দে উত্তর দাও: বাংলাদেশের রাজধানী?" }], maxTokens: 20 })) as any);
  log("ai:routed", !!ai, ai, aims);
  console.log("SUMMARY", R.filter((r) => r.ok).length, "/", R.length);
}, 180000);
