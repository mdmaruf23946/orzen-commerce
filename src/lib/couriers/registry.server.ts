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
