import { describe, it, expect } from "vitest";
import { canBuyAiCredits } from "./ai-credit-eligibility";

const future = new Date(Date.now() + 86400000).toISOString();

describe("canBuyAiCredits", () => {
  it("allows a plan with WhatsApp/Messenger AI", () => {
    expect(canBuyAiCredits({ pkg: { features: { ai_messenger: true } }, expiresAt: future }).ok).toBe(true);
  });
  it("blocks the free trial even if AI is on", () => {
    expect(canBuyAiCredits({ pkg: { is_trial: true, features: { ai_agent: true } }, expiresAt: future }).ok).toBe(false);
  });
  it("blocks plans without any AI chat feature", () => {
    expect(canBuyAiCredits({ pkg: { features: { courier: true } }, expiresAt: future }).ok).toBe(false);
  });
  it("blocks an expired plan", () => {
    expect(canBuyAiCredits({ pkg: { features: { ai_agent: true } }, expiresAt: "2020-01-01T00:00:00Z" }).ok).toBe(false);
  });
});
