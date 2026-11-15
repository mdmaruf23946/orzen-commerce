import { describe, expect, it, vi } from "vitest";
vi.mock("@/lib/agents/ai-provider.server", () => ({ resolveAiModel: vi.fn() }));
import { buildCopilotTools } from "./agent.server";

describe("copilot tools", () => {
  it("draft_product only drafts and requires confirmation", async () => {
    const drafts: any[] = [];
    const db = { from: vi.fn() };
    const tools = buildCopilotTools(db, "s1", drafts);
    const r: any = await (tools.draft_product as any).execute({ name: "Panjabi", price: 1200 }, {});
    expect(r.requiresConfirmation).toBe(true);
    expect(drafts).toHaveLength(1);
    expect(db.from).not.toHaveBeenCalled();
  });
});
