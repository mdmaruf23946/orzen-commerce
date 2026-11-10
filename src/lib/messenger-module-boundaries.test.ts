import { afterEach, describe, expect, test, vi } from "vitest";
import * as webhook from "./messenger-webhook.server";
import * as catalog from "./messenger-catalog.server";
import * as orders from "./messenger-orders.server";
import { parseMessage } from "./messenger-transport.server";
import type { MessengerClient } from "./messenger-client.server";

afterEach(() => vi.unstubAllGlobals());

describe("Messenger module boundaries", () => {
  test("webhook keeps the public helpers used by routes and tests", () => {
    expect(webhook.handleBuyPostback).toBe(orders.handleBuyPostback);
    expect(webhook.availabilityStripped).toBe(catalog.availabilityStripped);
    expect(webhook.isNameOnlyProductQuery).toBe(catalog.isNameOnlyProductQuery);
  });

  test("Buy Now quick replies keep their payload", () => {
    expect(parseMessage({ text: "Buy Now", quick_reply: { payload: "BUY_123" } })).toEqual({
      text: "Buy Now",
      message_type: "quick_reply",
      attachments: [{ type: "quick_reply", payload: "BUY_123" }],
    });
  });

  test("unsupported attachments become stickers, fallback becomes file", () => {
    expect(parseMessage({ attachments: [{ type: "fallback", payload: { url: "https://x.test/a" } }] }).message_type).toBe("file");
    expect(parseMessage({ attachments: [{ type: "location", payload: {} }] }).message_type).toBe("sticker");
  });

  test("invalid Buy Now payload never reaches the database", async () => {
    const from = vi.fn();
    const sb = { from } as unknown as MessengerClient;
    expect(await webhook.handleBuyPostback({ sb, storeId: "store-a", conversationId: "chat-a", psid: "customer-a", token: "test-token", payload: "BUY_invalid" })).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  test("out-of-stock Buy Now stays store-scoped and never creates an order", async () => {
    const eq = vi.fn();
    const insert = vi.fn().mockResolvedValue({ error: null });
    const query = {
      select: vi.fn().mockReturnThis(),
      eq,
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: "00000000-0000-0000-0000-000000000001", name: "Test product", status: "active", product_type: "physical", stock: 0 } }),
      insert,
    };
    eq.mockReturnValue(query);
    const from = vi.fn().mockReturnValue(query);
    const rpc = vi.fn();
    const sb = { from, rpc } as unknown as MessengerClient;
    const send = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message_id: "out-1" }), { status: 200 }));
    vi.stubGlobal("fetch", send);
    expect(await webhook.handleBuyPostback({ sb, storeId: "store-a", conversationId: "chat-a", psid: "customer-a", token: "test-token", payload: "BUY_00000000-0000-0000-0000-000000000001" })).toBe(true);
    expect(eq).toHaveBeenCalledWith("store_id", "store-a");
    expect(rpc).not.toHaveBeenCalled();
    expect(from.mock.calls.map(([table]) => table)).toEqual(["products", "ai_messages"]);
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ conversation_id: "chat-a", mid: "out-1", delivery_status: "sent" }));
    expect(JSON.parse(send.mock.calls[0]?.[1].body).recipient.id).toBe("customer-a");
  });
});
