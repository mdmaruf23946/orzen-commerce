// Web Chat ownership: a guest chat belongs to the browser holding its secret
// key (only a SHA-256 hash is stored); a signed-in customer's chat also opens
// on any browser where that same store account is signed in. IP/device are
// recorded for the merchant, never used as proof (mobile IPs change constantly).

export async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function newChatKey(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

export type WebConv = { id: string; store_id: string; web_access_hash?: string | null; web_customer_id?: string | null };

/** Resolve a signed-in store customer id from their session token (null when guest/invalid). */
export async function customerIdFromToken(sb: any, storeId: string, token?: string | null): Promise<string | null> {
  if (!token || token.length < 16 || token.length > 128) return null;
  const { data } = await sb.rpc("customer_from_token", { _token: token, _store_id: storeId });
  return (data as any)?.id ?? null;
}

export async function canAccessWebConv(conv: WebConv | null, storeId: string, key?: string | null, customerId?: string | null): Promise<boolean> {
  if (!conv || conv.store_id !== storeId) return false;
  if (customerId && conv.web_customer_id && conv.web_customer_id === customerId) return true;
  if (key && conv.web_access_hash && conv.web_access_hash === (await sha256Hex(key))) return true;
  return false;
}

export function clientInfo(request: Request) {
  const h = request.headers;
  const ua = (h.get("user-agent") ?? "").slice(0, 300);
  const ip = h.get("cf-connecting-ip") || (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || null;
  const mobile = /Mobi|Android|iPhone|iPad/i.test(ua);
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /SamsungBrowser/.test(ua) ? "Samsung" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Other";
  return { ip, device: mobile ? "mobile" : "desktop", browser, ua, seen_at: new Date().toISOString() };
}
