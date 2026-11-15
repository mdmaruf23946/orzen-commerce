// AI Business Co-pilot data tools (beta). Store is always resolved from the
// signed-in user; only beta testers can call these until released.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { storeAccess } from "@/lib/accounts/store-access";
import { isBetaTester } from "@/lib/beta-features";
import { draftProduct, loadProductPerformance, loadSalesSummary, loadSeoAudit, loadStoreConfig, saveConfirmedDraft, applyCopilotAction } from "./data.server";
import { copilotActionSchema } from "./actions";

function gate(context: any) {
  if (!isBetaTester(context.claims?.email)) throw new Error("This feature is not available yet.");
  return { db: context.supabase, storeId: context.access.storeId as string };
}
const rangeInput = z.object({ days: z.number().int().min(1).max(365).default(30) });

export const copilotSalesSummary = createServerFn({ method: "POST" })
  .middleware([storeAccess("orders")])
  .inputValidator((d: unknown) => rangeInput.parse(d ?? {}))
  .handler(async ({ data, context }) => { const { db, storeId } = gate(context); return loadSalesSummary(db, storeId, data.days); });

export const copilotProductPerformance = createServerFn({ method: "POST" })
  .middleware([storeAccess("products")])
  .inputValidator((d: unknown) => rangeInput.parse(d ?? {}))
  .handler(async ({ data, context }) => { const { db, storeId } = gate(context); return loadProductPerformance(db, storeId, data.days); });

export const copilotSeoAudit = createServerFn({ method: "POST" })
  .middleware([storeAccess("products")])
  .handler(async ({ context }) => { const { db, storeId } = gate(context); return loadSeoAudit(db, storeId); });

export const copilotStoreConfig = createServerFn({ method: "POST" })
  .middleware([storeAccess("settings")])
  .handler(async ({ context }) => { const { db, storeId } = gate(context); return loadStoreConfig(db, storeId); });

export const copilotDraftProduct = createServerFn({ method: "POST" })
  .middleware([storeAccess("products")])
  .inputValidator((d: unknown) => z.object({
    name: z.string(), price: z.number(), stock: z.number().optional(),
    description: z.string().optional(), categoryId: z.string().uuid().nullable().optional(),
  }).parse(d))
  .handler(async ({ data, context }) => { gate(context); return draftProduct(data); });

export const copilotChat = createServerFn({ method: "POST" })
  .middleware([storeAccess("orders")])
  .inputValidator((d: unknown) => z.object({
    messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(4000) })).min(1).max(40),
  }).parse(d))
  .handler(async ({ data, context }) => {
    const { db, storeId } = gate(context);
    const { runCopilot } = await import("./agent.server");
    try { return await runCopilot(db, storeId, data.messages); }
    catch (e) { console.error("copilotChat failed", e); throw new Error("Co-pilot is busy right now. Please try again."); }
  });

export const copilotSaveProduct = createServerFn({ method: "POST" })
  .middleware([storeAccess("products")])
  .inputValidator((d: unknown) => z.object({
    name: z.string().min(2).max(150), price: z.number().positive().max(10_000_000),
    stock: z.number().int().min(0).max(1_000_000).optional(), description: z.string().max(5000).optional(),
  }).parse(d))
  .handler(async ({ data, context }) => { const { db, storeId } = gate(context); return saveConfirmedDraft(db, storeId, data); });

export const copilotApplyAction = createServerFn({ method: "POST" })
  .middleware([storeAccess("settings")])
  .inputValidator((d: unknown) => copilotActionSchema.parse(d))
  .handler(async ({ data, context }) => { const { db, storeId } = gate(context); return applyCopilotAction(db, storeId, data); });
