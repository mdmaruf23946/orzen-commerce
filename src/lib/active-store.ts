// Client-side memory of which store the Merchant Panel is working in.
// The server re-verifies membership on every request; this is only a hint.
export const ACTIVE_STORE_HEADER = "x-orzen-store";
const KEY = "orzen.activeStore";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getActiveStoreId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem(KEY);
    return v && UUID.test(v) ? v : null;
  } catch {
    return null;
  }
}

export function setActiveStoreId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id) window.localStorage.setItem(KEY, id);
    else window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID.test(v);
}
