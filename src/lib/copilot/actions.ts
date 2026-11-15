// Co-pilot change proposals. The AI only proposes; the merchant confirms in the
// chat and the server re-validates and applies them to the caller's store only.
import { z } from "zod";

export const copilotActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("store_seo"), title: z.string().trim().min(5).max(70), description: z.string().trim().min(30).max(170) }),
  z.object({
    type: z.literal("product_update"), productId: z.string().uuid(), productName: z.string().max(200).optional(),
    price: z.number().positive().max(10_000_000).optional(), stock: z.number().int().min(0).max(1_000_000).optional(),
    description: z.string().trim().min(20).max(5000).optional(),
  }).refine((a) => a.price !== undefined || a.stock !== undefined || a.description !== undefined, "Nothing to change"),
  z.object({ type: z.literal("delivery_charge"), zoneId: z.string().uuid(), zoneName: z.string().max(100).optional(), charge: z.number().min(0).max(100_000) }),
]);
export type CopilotAction = z.infer<typeof copilotActionSchema> & { before?: Record<string, string | number | null> };

const SALAM_IN = /(সালাম|salam|slm|assalam|আস্?সালাম)/i;
const SALAM_REPLY = /^\s*(ওয়া?(লাইকুম|আলাইকুম)\s*(আস্?সালাম|সালাম)[^\n।!.]*[।!.]?|wa\s*alaikum[^\n.!]*[.!]?|আস্?সালামু?\s*আ?লাইকুম[^\n।!.]*[।!.]?)\s*/i;

/** Remove a salam reply the model added when the merchant did not greet with salam. */
export function stripUnaskedSalam(reply: string, userText: string) {
  if (SALAM_IN.test(userText)) return reply;
  const out = reply.replace(SALAM_REPLY, "").trimStart();
  return out || reply;
}
