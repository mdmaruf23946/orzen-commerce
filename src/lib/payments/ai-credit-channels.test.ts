import { describe, it, expect } from "vitest";
import { isBilledChannel, billableTokens } from "./ai-credit-billing";
describe("AI credit billed channels", () => {
  it("bills Messenger, WhatsApp, Website chat and Instagram", () => {
    for (const c of ["messenger", "whatsapp", "web", "chat", "instagram"]) expect(isBilledChannel(c)).toBe(true);
  });
  it("does not bill other uses", () => {
    for (const c of ["copilot", "call", "seo", "", null]) expect(isBilledChannel(c as any)).toBe(false);
  });
  it("bills input + output tokens", () => expect(billableTokens(1500, 500)).toBe(2000));
});
