// Track recently viewed products per store in localStorage.
const key = (slug: string) => `recent:${slug}`;
const MAX = 12;

export function pushRecent(slug: string, productId: string) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(key(slug));
    const list: string[] = raw ? JSON.parse(raw) : [];
    const next = [productId, ...list.filter((id) => id !== productId)].slice(0, MAX);
    localStorage.setItem(key(slug), JSON.stringify(next));
  } catch {
    /* noop */
  }
}

export function readRecent(slug: string, excludeId?: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(slug));
    const list: string[] = raw ? JSON.parse(raw) : [];
    return excludeId ? list.filter((id) => id !== excludeId) : list;
  } catch {
    return [];
  }
}
