import { test, expect, beforeAll, afterAll } from "bun:test";
import { createClient } from "@supabase/supabase-js";

const REF = "rljisleyqluoexmtncos";
const STORE = "870d92cc-999f-4246-b0b7-2a879f12c2a3";
let sb: any;
let hooks: any;
let tryFastPath: any;
let runWithTrace: any;
let setTraceMeta: any;
const convIds: string[] = [];
let productId: string | null = null;
const orderIds: string[] = [];

async function q(sql: string) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PROD_SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  return r.json();
}

beforeAll(async () => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/api-keys?reveal=true`, {
    headers: { Authorization: `Bearer ${process.env.PROD_SUPABASE_ACCESS_TOKEN}` },
  });
  const keys = (await r.json()) as any[];
  const service = keys.find((k) => k.name === "service_role" || k.name === "secret")?.api_key;
  process.env.SUPABASE_URL = `https://${REF}.supabase.co`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = service;
  sb = createClient(process.env.SUPABASE_URL!, service, { auth: { persistSession: false } });
  hooks = (await import("./src/lib/messenger-webhook.server")).__messengerTestHooks;
  tryFastPath = (await import("./src/lib/fast-path.server")).tryFastPath;
  const tel = await import("./src/lib/telemetry.server");
  runWithTrace = tel.runWithTrace;
  setTraceMeta = tel.setTraceMeta;
  const { data: p, error } = await sb
    .from("products")
    .insert({ store_id: STORE, name: "loadtest মধু 500g", slug: `loadtest-honey-${Date.now()}`, price: 980, stock: 5, status: "active", product_type: "physical" })
    .select("id")
    .single();
  if (error) throw error;
  productId = p.id;
}, 60_000);

afterAll(async () => {
  for (const id of orderIds) {
    await sb.from("order_timeline").delete().eq("order_id", id);
    await sb.from("order_items").delete().eq("order_id", id);
    await sb.from("orders").delete().eq("id", id);
  }
  // Any order created by the test conversations.
  const { data: extra } = await sb.from("orders").select("id").eq("store_id", STORE).eq("phone", "01799999999");
  for (const o of extra ?? []) {
    await sb.from("order_timeline").delete().eq("order_id", o.id);
    await sb.from("order_items").delete().eq("order_id", o.id);
    await sb.from("orders").delete().eq("id", o.id);
  }
  for (const id of convIds) {
    await sb.from("ai_messages").delete().eq("conversation_id", id);
    await sb.from("ai_product_recommendations").delete().eq("conversation_id", id);
    await sb.from("ai_conversations").delete().eq("id", id);
  }
  if (productId) {
    await sb.from("stock_movements").delete().eq("product_id", productId);
    await sb.from("products").delete().eq("id", productId);
  }
}, 60_000);

async function newConv() {
  const { data, error } = await sb
    .from("ai_conversations")
    .insert({ store_id: STORE, channel: "messenger", status: "open", external_id: `loadtest_${crypto.randomUUID()}` })
    .select("id,external_id")
    .single();
  if (error) throw error;
  convIds.push(data.id);
  return { id: data.id as string, psid: data.external_id as string };
}
async function userSays(convId: string, text: string) {
  await sb.from("ai_messages").insert({ conversation_id: convId, role: "user", direction: "in", message_type: "text", content: text });
}
async function lastBot(convId: string) {
  const { data } = await sb.from("ai_messages").select("content").eq("conversation_id", convId).eq("role", "assistant").order("created_at", { ascending: false }).limit(1);
  return String(data?.[0]?.content ?? "");
}
async function slot(convId: string) {
  const { data } = await sb.from("ai_conversations").select("psid_profile").eq("id", convId).single();
  return (data?.psid_profile?.pending_order ?? {}) as Record<string, any>;
}
async function apply(conv: { id: string; psid: string }, text: string) {
  await userSays(conv.id, text);
  const t = runWithTrace(async () => {
    setTraceMeta("dry_run", true);
    return hooks.maybeApplyPendingOrderText({ sb, storeId: STORE, conversationId: conv.id, psid: conv.psid, token: "dry", text });
  });
  return t.result;
}

test("parser never takes a question as a name", () => {
  const { patch } = hooks.parseOrderDetailsTextEx("ডেলিভারি সার্চ কত", { awaitingName: true, awaitingAddress: true });
  expect(patch.customer_name).toBeUndefined();
  expect(patch.full_address).toBeUndefined();
  const a = hooks.parseOrderDetailsTextEx("ডেলিভারি সার্চ কত", {});
  expect(Object.keys(a.patch).length).toBe(0);
  const b = hooks.parseOrderDetailsTextEx("আমার নাম রহিম", { awaitingName: true });
  expect(b.patch.customer_name).toBe("রহিম");
  const c = hooks.parseOrderDetailsTextEx("Rahim\n01799999999\nMirpur 10, Dhaka", {});
  expect(c.patch).toMatchObject({ customer_name: "Rahim", phone: "01799999999", full_address: "Mirpur 10, Dhaka" });
});

test("misspelt delivery question → fast path with real zones", async () => {
  const conv = await newConv();
  for (const t of ["ডেলিভারি সার্চ কত", "ডেলিবারি চাজ কতো", "dlvry charj koto", "delivery charge koto hobe"]) {
    const r = await tryFastPath(sb, { storeId: STORE, conversationId: conv.id, text: t, customerPhone: null });
    console.log(t, "→", r?.kind, JSON.stringify(r?.reply));
    expect(r?.kind).toBe("delivery_charge");
  }
}, 30_000);

test("full scenario from the screenshots", async () => {
  const conv = await newConv();
  expect(await apply(conv, "হেই")).toBe(false);
  expect(await apply(conv, "ডেলিভারি সার্চ কত")).toBe(false);
  expect((await slot(conv.id)).customer_name).toBeUndefined();
  // Address after the delivery question → that area's charge.
  expect(await apply(conv, "Chittagong, Sandeep, Mushapur, Hanif Miyaji's house")).toBe(true);
  const reply = await lastBot(conv.id);
  console.log("address reply:", JSON.stringify(reply));
  expect(reply).toContain("৳১২০");
  let s = await slot(conv.id);
  expect(s.full_address).toContain("Chittagong");
  expect(s.customer_name).toBeUndefined();
  // Buy Now on a product.
  await sb.from("ai_conversations").update({ psid_profile: { pending_order: { ...s, product_id: productId, product_name: "loadtest মধু 500g", qty: 1 } } }).eq("id", conv.id);
  // Phone only → must NOT create the order (name still missing).
  await apply(conv, "01799999999");
  s = await slot(conv.id);
  expect(s.phone).toBe("01799999999");
  expect(s.customer_name).toBeUndefined();
  const { data: none } = await sb.from("orders").select("id").eq("store_id", STORE).eq("phone", "01799999999");
  expect((none ?? []).length).toBe(0);
  // A question while we wait for the name is not a name.
  expect(await apply(conv, "মধু কি খাঁটি?")).toBe(false);
  expect((await slot(conv.id)).customer_name).toBeUndefined();
  // The real name → order created with that name.
  expect(await apply(conv, "আমার নাম রহিম")).toBe(true);
  const { data: orders } = await sb.from("orders").select("id,customer_name,subtotal,delivery_amount").eq("store_id", STORE).eq("phone", "01799999999");
  console.log("order:", JSON.stringify(orders));
  expect(orders?.length).toBe(1);
  expect(orders![0].customer_name).toBe("রহিম");
  expect(Number(orders![0].subtotal)).toBe(1100);
  expect(Number(orders![0].delivery_amount)).toBe(120);
  orderIds.push(orders![0].id);
}, 90_000);

test("stored bad name is dropped, unclear name is confirmed", async () => {
  const conv = await newConv();
  await sb.from("ai_conversations").update({
    psid_profile: { pending_order: { product_id: productId, qty: 1, customer_name: "ডেলিভারি সার্চ কত", full_address: "Mirpur 10, Dhaka" } },
  }).eq("id", conv.id);
  // Long, odd name → AI understanding step → saved or confirmation question.
  const handled = await apply(conv, "md abdullah al mamun khan chowdhury");
  const s = await slot(conv.id);
  console.log("unclear name:", handled, JSON.stringify(s), JSON.stringify(await lastBot(conv.id)));
  expect(s.customer_name === "md abdullah al mamun khan chowdhury" || s.confirm?.field === "customer_name" || /নাম/.test(await lastBot(conv.id))).toBe(true);
  if (s.confirm?.field) {
    await apply(conv, "হ্যাঁ");
    const s2 = await slot(conv.id);
    console.log("after yes:", JSON.stringify(s2));
    expect(s2.customer_name).toBeTruthy();
  }
}, 90_000);

test("confirm question: yes saves, no asks again", async () => {
  const conv = await newConv();
  await sb.from("ai_conversations").update({
    psid_profile: { pending_order: { product_id: productId, qty: 1, full_address: "Mirpur 10, Dhaka", confirm: { field: "customer_name", value: "করিম" } } },
  }).eq("id", conv.id);
  expect(await apply(conv, "না")).toBe(true);
  expect(await lastBot(conv.id)).toContain("সঠিক নাম");
  expect((await slot(conv.id)).customer_name).toBeUndefined();
  await sb.from("ai_conversations").update({
    psid_profile: { pending_order: { product_id: productId, qty: 1, full_address: "Mirpur 10, Dhaka", confirm: { field: "customer_name", value: "করিম" } } },
  }).eq("id", conv.id);
  expect(await apply(conv, "হ্যাঁ")).toBe(true);
  const s = await slot(conv.id);
  expect(s.customer_name).toBe("করিম");
  console.log("after yes bot:", JSON.stringify(await lastBot(conv.id)));
  expect(await lastBot(conv.id)).toContain("মোবাইল");
}, 60_000);
