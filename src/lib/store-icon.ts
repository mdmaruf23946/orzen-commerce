// Resolves a store's icon and favicon URLs with graceful fallbacks.
// Never returns a broken URL - always yields either a real URL or null.

export type StoreLike = {
  id?: string;
  name?: string | null;
  icon_url?: string | null;
  favicon_url?: string | null;
  custom_favicon_url?: string | null;
  use_icon_as_favicon?: boolean | null;
  logo_url?: string | null;
  seo?: { favicon_url?: string | null } | null;
};

function toDisplayUrl(v?: string | null): string | null {
  if (!v) return null;
  if (v.startsWith("http") || v.startsWith("/")) return v;
  return `/api/img/${v}`;
}

/** Store identity icon: custom store icon → legacy store logo → null (caller renders letter mark). */
export function resolveStoreIcon(store?: StoreLike | null): string | null {
  if (!store) return null;
  return toDisplayUrl(store.icon_url) ?? toDisplayUrl(store.logo_url);
}

/** Browser favicon: store favicon → icon → custom favicon → legacy seo.favicon_url → logo → null. */
export function resolveStoreFavicon(store?: StoreLike | null): string | null {
  if (!store) return null;
  const useIcon = store.use_icon_as_favicon !== false;
  if (useIcon) {
    return (
      toDisplayUrl(store.favicon_url) ??
      toDisplayUrl(store.icon_url) ??
      toDisplayUrl(store.custom_favicon_url) ??
      toDisplayUrl(store.seo?.favicon_url) ??
      toDisplayUrl(store.logo_url)
    );
  }
  return (
    toDisplayUrl(store.custom_favicon_url) ??
    toDisplayUrl(store.favicon_url) ??
    toDisplayUrl(store.icon_url) ??
    toDisplayUrl(store.seo?.favicon_url) ??
    toDisplayUrl(store.logo_url)
  );
}
