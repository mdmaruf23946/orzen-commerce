// Meta Graph helpers for the Messenger/Instagram webhook: signature check, token decrypt, profile fetch.
// Verify Facebook's X-Hub-Signature-256 (HMAC-SHA256 of the raw body with the app secret).
export async function verifyMessengerSignature(rawBody: string, header: string, appSecret: string) {
  const provided = header.trim().toLowerCase().replace(/^sha256=/, "");
  if (!/^[0-9a-f]{64}$/.test(provided)) return false;
  const { createHmac } = await import("node:crypto");
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  return expected === provided;
}

export async function decryptToken(enc: string | null | undefined): Promise<string | null> {

  if (!enc) return null;
  const mod = await import("@/lib/crypto/credentials.server");
  try {
    return mod.decryptJSON<string>(enc);
  } catch {
    return null;
  }
}

export async function fetchPsidProfile(token: string, psid: string, channel: "messenger" | "instagram" = "messenger") {
  if (channel === "instagram") {
    try {
      const r = await fetch(
        `https://graph.facebook.com/v19.0/${encodeURIComponent(psid)}?fields=name,username,profile_pic&access_token=${encodeURIComponent(token)}`,
      );
      const j: any = await r.json().catch(() => null);
      if (!r.ok || !j) return null;
      return { name: j.name || (j.username ? `@${j.username}` : null), username: j.username ?? null, profile_pic: j.profile_pic ?? null, fetched_at: new Date().toISOString() } as Record<string, any>;
    } catch {
      return null;
    }
  }
  const { fetchMessengerProfile } = await import("@/lib/messenger-profile.server");
  return fetchMessengerProfile(token, psid);
}

/** Profile pictures are signed CDN links that expire — refresh every few hours. */
export function profileIsStale(profile: any) {
  if (!profile || Object.keys(profile).length === 0) return true;
  const at = profile.fetched_at ? Date.parse(profile.fetched_at) : NaN;
  if (Number.isNaN(at)) return true;
  return Date.now() - at > 6 * 60 * 60 * 1000;
}
