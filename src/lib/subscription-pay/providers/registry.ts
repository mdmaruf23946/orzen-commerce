import type { SubscriptionPaymentProvider } from "./types";
import { sslcommerz } from "./sslcommerz";
import { manual } from "./manual";
import { bkash } from "./bkash";

// Add a new provider by importing it and pushing it here.
// Nothing else in the subscription flow needs to change.
export const PROVIDERS: Record<string, SubscriptionPaymentProvider> = {
  sslcommerz,
  bkash,
  manual,
};

export function getProvider(id: string): SubscriptionPaymentProvider {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Unknown payment provider: ${id}`);
  return p;
}

export function listProviderMeta() {
  return Object.values(PROVIDERS).map((p) => p.meta);
}
