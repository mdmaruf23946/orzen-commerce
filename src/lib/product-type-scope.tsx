import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ProductTypeScope = "all" | "physical" | "digital" | "service" | "subscription";
export type ProductTypeOnly = Exclude<ProductTypeScope, "all">;

export const PRODUCT_TYPES: ProductTypeOnly[] = ["physical", "digital", "service", "subscription"];

export const PRODUCT_TYPE_LABEL: Record<ProductTypeOnly, string> = {
  physical: "Physical",
  digital: "Digital",
  service: "Service",
  subscription: "Subscription",
};

const KEY = "orzen.admin.product_type_scope";

function isScope(v: unknown): v is ProductTypeScope {
  return v === "all" || (typeof v === "string" && (PRODUCT_TYPES as string[]).includes(v));
}

function readInitial(): ProductTypeScope {
  if (typeof window === "undefined") return "all";
  try {
    const url = new URL(window.location.href).searchParams.get("ptype");
    if (isScope(url)) return url;
    const stored = window.localStorage.getItem(KEY);
    if (isScope(stored)) return stored;
  } catch {}
  return "all";
}

type Ctx = {
  scope: ProductTypeScope;
  setScope: (s: ProductTypeScope) => void;
  /** The type used for creating new records while scope is "all". */
  activeType: ProductTypeOnly;
  /** Undefined when scope is "all" — pass straight into server fns. */
  filter: ProductTypeOnly | undefined;
};

const ProductTypeScopeContext = createContext<Ctx | null>(null);

export function ProductTypeScopeProvider({ children }: { children: React.ReactNode }) {
  const [scope, setScopeState] = useState<ProductTypeScope>("all");

  useEffect(() => {
    setScopeState(readInitial());
  }, []);

  const setScope = useCallback((s: ProductTypeScope) => {
    setScopeState(s);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(KEY, s);
      const url = new URL(window.location.href);
      if (s === "all") url.searchParams.delete("ptype");
      else url.searchParams.set("ptype", s);
      window.history.replaceState(window.history.state, "", url.toString());
    } catch {}
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      scope,
      setScope,
      activeType: scope === "all" ? "physical" : scope,
      filter: scope === "all" ? undefined : scope,
    }),
    [scope, setScope],
  );

  return <ProductTypeScopeContext.Provider value={value}>{children}</ProductTypeScopeContext.Provider>;
}

export function useProductTypeScope(): Ctx {
  const ctx = useContext(ProductTypeScopeContext);
  if (ctx) return ctx;
  // Safe fallback (e.g. rendered outside the admin layout).
  return { scope: "all", setScope: () => {}, activeType: "physical", filter: undefined };
}

/** Builds the shared tab list with counts. */
export function scopeTabs(counts: Record<string, number>) {
  return [
    { key: "all" as ProductTypeScope, label: `All (${counts.all ?? 0})` },
    ...PRODUCT_TYPES.map((t) => ({
      key: t as ProductTypeScope,
      label: `${PRODUCT_TYPE_LABEL[t]} (${counts[t] ?? 0})`,
    })),
  ];
}
