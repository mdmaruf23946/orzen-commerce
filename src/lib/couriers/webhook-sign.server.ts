// Per-store signed courier webhook URL (couriers send no verifiable signature).
import { createHmac, timingSafeEqual } from "node:crypto";

function key() {
  const k = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!k) throw new Error("missing key");
  return k;
}

export function courierWebhookSig(storeId: string) {
  return createHmac("sha256", key()).update(`courier-webhook:${storeId}`).digest("hex").slice(0, 40);
}

export function verifyCourierWebhookSig(storeId: string, sig: string) {
  const a = Buffer.from(courierWebhookSig(storeId));
  const b = Buffer.from(String(sig ?? ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function courierWebhookUrl(origin: string, storeId: string) {
  return `${origin.replace(/\/+$/, "")}/api/public/couriers/webhook?s=${storeId}&k=${courierWebhookSig(storeId)}`;
}
