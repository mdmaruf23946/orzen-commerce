import { createHmac } from "node:crypto";
import { describe, expect, test, vi } from "vitest";
import { verifyMessengerSignature } from "@/lib/integrations/messenger-graph.server";
import { parseMessage } from "@/lib/integrations/messenger-transport.server";
import { buildIdempotencyKey, createChatOrder } from "@/lib/orders/chat-order.server";

vi.mock("@/lib/integrations/orzen-sync.server", () => ({ pushOrzenOrder: vi.fn() }));

const SECRET = "test-app-secret";
const body = JSON.stringify({ object: "page", entry: [{ id: "page-1" }] });
const sign = (raw: string, s = SECRET) => "sha256=" + createHmac("sha256", s).update(raw, "utf8").digest("hex");

describe("Messenger signature check", () => {
  test("accepts a valid Meta signature", async () => {
    expect(await verifyMessengerSignature(body, sign(body), SECRET)).toBe(true);
  });
  test("rejects a tampered body", async () => {
    expect(await verifyMessengerSignature(body + " ", sign(body), SECRET)).toBe(false);
  });
  test("rejects a signature made with another secret", async () => {
    expect(await verifyMessengerSignature(body, sign(body, "other"), SECRET)).toBe(false);
  });
  test("rejects malformed or empty headers", async () => {
    expect(await verifyMessengerSignature(body, "", SECRET)).toBe(false);
    expect(await verifyMessengerSignature(body, "sha256=xyz", SECRET)).toBe(false);
    expect(await verifyMessengerSignature(body, "sha1=" + "a".repeat(40), SECRET)).toBe(false);
  });
});

describe("Fake / odd Messenger payloads", () => {
  test("empty message becomes plain text without attachments", () => {
    const r = parseMessage({});
    expect(r.attachments ?? []).toEqual([]);
  });
  test("quick reply keeps only its own payload", () => {
    expect(parseMessage({ text: "x", quick_reply: { payload: "BUY_1" } }).attachments).toEqual([{ type: "quick_reply", payload: "BUY_1" }]);
  });
});

describe("Chat order idempotency", () => {
  const base = { channel: "messenger", conversationId: "c1", productId: "p1", variant: "M", qty: 1, phone: "+8801712345678" };
  test("same order → same key; phone format does not matter", () => {
    expect(buildIdempotencyKey(base)).toBe(buildIdempotencyKey({ ...base, phone: "01712-345678" }));
  });
  test("different qty, product, variant or chat → different key", () => {
    const k = buildIdempotencyKey(base);
    for (const c of [{ qty: 2 }, { productId: "p2" }, { variant: "L" }, { conversationId: "c2" }, { channel: "whatsapp" }])
      expect(buildIdempotencyKey({ ...base, ...c })).not.toBe(k);
  });

  const order = { customer_name: "R", phone: "01712345678", address: "Dhaka", subtotal: 1060, delivery_amount: 60 };
  const items = [{ product_id: "p1", name: "T", price: 1000, qty: 1 }];

  test("duplicate message returns the existing order (no second invoice)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { id: "o1", invoice_no: "INV-1", existing: true }, error: null });
    const r = await createChatOrder({ rpc }, "store-a", "k", order, items);
    expect(r).toEqual({ ok: true, id: "o1", invoice_no: "INV-1", existing: true });
    expect(rpc).toHaveBeenCalledWith("create_chat_order", expect.objectContaining({ _store_id: "store-a", _idem_key: "k" }));
  });
  test("out of stock reports available amount", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "out_of_stock:2" } });
    expect(await createChatOrder({ rpc }, "s", "k", order, items)).toEqual({ ok: false, error: "out_of_stock", available: 2 });
  });
  test("missing product is reported, never created", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "product_not_found" } });
    expect(await createChatOrder({ rpc }, "s", "k", order, items)).toEqual({ ok: false, error: "product_not_found" });
  });
});
