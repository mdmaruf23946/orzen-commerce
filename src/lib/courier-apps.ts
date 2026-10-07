// Registry of Courier Apps. A courier gets its own sidebar menu ONLY while it
// is connected (switched on + required credentials saved); otherwise it shows
// only on the "Courier Apps" hub. Each courier's settings/data stay isolated.
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LayoutDashboard, Plug, type LucideIcon } from "lucide-react";
import { getMyStore, listPublicCourierProviders } from "@/lib/admin.functions";
import { COURIERS, readCredential, emptyConfig, type CourierKey, type CourierMeta } from "@/components/admin/couriers/providers";

export const COURIER_HUB_PATH = "/admin/couriers/apps";
export const COURIER_OVERVIEW_PATH = "/admin/couriers/overview";

export type CourierSection = { key: "overview" | "integration"; label: string; icon: LucideIcon };
export const COURIER_SECTIONS: CourierSection[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "integration", label: "Integration", icon: Plug },
];

export type CourierConnectionMap = Partial<Record<CourierKey, boolean>>;

export function isCourierConnected(meta: CourierMeta, raw: any): boolean {
  const cfg = { ...emptyConfig, ...(raw ?? {}) };
  if (!cfg.enabled) return false;
  const required = (meta.credentialFields ?? []).filter((f) => f.required);
  return required.every((f) => !!readCredential(cfg, f.key).trim());
}

export function courierConnections(couriers: any): CourierConnectionMap {
  const c = couriers ?? {};
  const out: CourierConnectionMap = {};
  for (const m of COURIERS) out[m.key] = isCourierConnected(m, c[m.key]);
  return out;
}

export function useCourierConnections() {
  const fetchStore = useServerFn(getMyStore);
  const { data, isLoading } = useQuery({ queryKey: ["admin", "store"], queryFn: () => fetchStore(), staleTime: 60_000 });
  return { connected: courierConnections((data as any)?.couriers), isLoading };
}

/** Current platform logos/wordmarks (unchanged from Courier Brand Assets). */
export function useCourierBrandAssets() {
  const fetchProviders = useServerFn(listPublicCourierProviders);
  const { data } = useQuery({ queryKey: ["courier-providers-public"], queryFn: () => fetchProviders(), staleTime: 5 * 60_000 });
  const logo: Record<string, string | null> = {};
  const wordmark: Record<string, string | null> = {};
  for (const p of (data ?? []) as Array<{ code: string; logo_url: string | null; wordmark_url: string | null }>) {
    logo[p.code] = p.logo_url;
    wordmark[p.code] = p.wordmark_url;
  }
  return { logo, wordmark };
}

export function courierPath(key: CourierKey) {
  return `/admin/couriers/${key}`;
}

export function imgSrc(v: string | null | undefined) {
  if (!v) return null;
  return v.startsWith("http") ? v : `/api/img/${v}`;
}
