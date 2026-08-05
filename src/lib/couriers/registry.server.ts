// Provider registry — the single place the app resolves an adapter.
import type { CourierAdapter } from "./types.server";
import { steadfastAdapter } from "./steadfast.server";
import { pathaoAdapter } from "./pathao.server";
import { redxAdapter } from "./redx.server";
import { paperflyAdapter } from "./paperfly.server";
import { ecourierAdapter } from "./ecourier.server";
import { manualAdapter } from "./manual.server";

const REGISTRY: Record<string, CourierAdapter> = {
  steadfast: steadfastAdapter,
  pathao: pathaoAdapter,
  redx: redxAdapter,
  paperfly: paperflyAdapter,
  ecourier: ecourierAdapter,
  sa_paribahan: manualAdapter("sa_paribahan"),
  sundarban: manualAdapter("sundarban"),
};

export function getAdapter(key: string): CourierAdapter {
  const a = REGISTRY[key];
  if (!a) throw new Error(`Unsupported courier: ${key}`);
  return a;
}

const LABELS: Record<string, string> = {
  steadfast: "SteadFast",
  pathao: "Pathao",
  redx: "RedX",
  paperfly: "Paperfly",
  ecourier: "eCourier",
  sa_paribahan: "S.A. Paribahan",
  sundarban: "Sundarban Courier",
};

export function courierName(key: string) {
  return LABELS[key] ?? key;
}

const FIELD_LABEL: Record<string, string> = {
  api_key: "API Key",
  secret: "Secret Key",
  api_secret: "API Secret",
  user_id: "User ID",
  client_id: "Client ID",
  client_secret: "Client Secret",
  username: "Username",
  password: "Password",
  store_id: "Store ID",
};

/**
 * Friendly pre-flight check so merchants see "Add your API Key" instead of a
 * raw 401 from the courier.
 */
export function assertCredentials(adapter: CourierAdapter, creds: Record<string, string>) {
  if (!adapter.hasApi) return;
  const missing: string[] = [];
  for (const group of adapter.requiredCreds ?? []) {
    if (!group.some((k) => String(creds[k] ?? "").trim())) {
      missing.push(group.map((k) => FIELD_LABEL[k] ?? k).join(" or "));
    }
  }
  if (missing.length) {
    throw new Error(
      `${courierName(adapter.key)} is not connected — missing ${missing.join(", ")}. Add it in Settings → Courier Integration.`,
    );
  }
}

