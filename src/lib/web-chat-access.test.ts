import { describe, it, expect } from "vitest";
import { canAccessWebConv, sha256Hex, newChatKey } from "./web-chat-access.server";

describe("web chat browser isolation", () => {
  it("opens only for the browser holding the key", async () => {
    const key = newChatKey();
    const conv = { id: "c", store_id: "s", web_access_hash: await sha256Hex(key), web_customer_id: null };
    expect(await canAccessWebConv(conv, "s", key)).toBe(true);
    expect(await canAccessWebConv(conv, "s", newChatKey())).toBe(false);
    expect(await canAccessWebConv(conv, "s", undefined)).toBe(false);
  });
  it("never opens another store's chat", async () => {
    const key = newChatKey();
    const conv = { id: "c", store_id: "s", web_access_hash: await sha256Hex(key) };
    expect(await canAccessWebConv(conv, "other", key)).toBe(false);
  });
  it("same signed-in account opens it on another browser", async () => {
    const conv = { id: "c", store_id: "s", web_access_hash: "x", web_customer_id: "cust1" };
    expect(await canAccessWebConv(conv, "s", null, "cust1")).toBe(true);
    expect(await canAccessWebConv(conv, "s", null, "cust2")).toBe(false);
  });
  it("old chats without a key stay closed", async () => {
    const conv = { id: "c", store_id: "s", web_access_hash: null, web_customer_id: null };
    expect(await canAccessWebConv(conv, "s", "anything")).toBe(false);
  });
});
