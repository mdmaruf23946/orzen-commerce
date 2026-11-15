import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/agents/ai-provider.server", () => ({ resolveAiModel: vi.fn() }));
import { stripUnaskedSalam } from "./actions";
import { buildCopilotTools } from "./agent.server";

describe("salam guard", () => {
  it("removes salam reply when merchant did not greet", () => {
    expect(stripUnaskedSalam("ওয়ালাইকুম আসসালাম\n\nআপনার SEO স্কোর 97", "আমার এই সিও টা ঠিক করে দাও")).toBe("আপনার SEO স্কোর 97");
  });
  it("keeps salam reply when merchant greeted", () => {
    expect(stripUnaskedSalam("ওয়ালাইকুম আসসালাম। স্কোর 97", "আসসালামু আলাইকুম, সিও দেখো")).toBe("ওয়ালাইকুম আসসালাম। স্কোর 97");
  });
});

describe("change proposals", () => {
  it("propose_store_seo only proposes and never writes", async () => {
    const update = vi.fn();
    const db = { from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { seo: {} } }) }) }), update })) };
    const actions: any[] = [];
    const tools = buildCopilotTools(db, "s1", [], actions);
    const r: any = await (tools.propose_store_seo as any).execute({ title: "ORZEN Fashion Store", description: "বাংলাদেশে সেরা দামে অরিজিনাল পোশাক, দ্রুত ক্যাশ অন ডেলিভারি।" }, {});
    expect(r.requiresConfirmation).toBe(true);
    expect(actions).toHaveLength(1);
    expect(update).not.toHaveBeenCalled();
  });
});
