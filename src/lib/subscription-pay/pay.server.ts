// Server-only dispatch layer. Loads provider credentials from the
// database, hands them to the modular adapter, and normalises errors.
// Route/component code must NEVER import this file directly — always
// go through `pay.functions.ts`.
import { getProvider } from "./providers/registry";
import type {
  CheckoutContext,
  ProviderConfig,
  SubscriptionPaymentProvider,
} from "./providers/types";

export type LoadedProvider = {
  id: string;
  label: string;
  sandbox: boolean;
  enabled: boolean;
  adapter: SubscriptionPaymentProvider;
  config: ProviderConfig;
};

export async function loadProvider(id: string): Promise<LoadedProvider> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("subscription_payment_providers")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Provider ${id} is not registered`);
  const adapter = getProvider(id);
  return {
    id: (data as any).id,
    label: (data as any).label,
    sandbox: !!(data as any).sandbox,
    enabled: !!(data as any).enabled,
    adapter,
    config: {
      credentials: ((data as any).credentials ?? {}) as Record<string, string | boolean>,
      sandbox: !!(data as any).sandbox,
    },
  };
}

export async function loadActiveProvider(): Promise<LoadedProvider | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("subscription_payment_providers")
    .select("*")
    .eq("is_active", true)
    .eq("enabled", true)
    .maybeSingle();
  if (!data) return null;
  const adapter = getProvider((data as any).id);
  return {
    id: (data as any).id,
    label: (data as any).label,
    sandbox: !!(data as any).sandbox,
    enabled: !!(data as any).enabled,
    adapter,
    config: {
      credentials: ((data as any).credentials ?? {}) as Record<string, string | boolean>,
      sandbox: !!(data as any).sandbox,
    },
  };
}

export async function dispatchCheckout(
  provider: LoadedProvider,
  ctx: CheckoutContext,
) {
  return provider.adapter.createCheckout(provider.config, ctx);
}
