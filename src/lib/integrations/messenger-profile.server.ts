/**
 * Fetch a Messenger customer's real Facebook name + picture.
 *
 * The direct PSID profile call only works for every customer when the Meta app
 * has "Business Asset User Profile Access". Without it Meta returns error 100/33
 * for ordinary customers. In that case we fall back to the page Conversations
 * API, which still returns the participant's real Facebook name (no picture).
 */
export async function fetchMessengerProfile(
  token: string,
  psid: string,
): Promise<Record<string, any> | null> {
  const now = new Date().toISOString();
  try {
    const r = await fetch(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(psid)}?fields=first_name,last_name,name,profile_pic,locale,timezone&access_token=${encodeURIComponent(token)}`,
    );
    if (r.ok) {
      const j = (await r.json()) as Record<string, any>;
      return { ...j, profile_source: "profile", fetched_at: now };
    }
  } catch {
    /* fall through */
  }
  try {
    const r = await fetch(
      `https://graph.facebook.com/v19.0/me/conversations?platform=messenger&user_id=${encodeURIComponent(psid)}&fields=participants&access_token=${encodeURIComponent(token)}`,
    );
    if (!r.ok) return null;
    const j = (await r.json()) as any;
    for (const conv of j?.data ?? []) {
      const p = (conv?.participants?.data ?? []).find((x: any) => String(x?.id) === String(psid));
      if (p?.name) {
        return { id: psid, name: String(p.name), profile_pic: null, profile_source: "conversations", fetched_at: now };
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function profileDisplayName(p: Record<string, any> | null | undefined): string | null {
  if (!p) return null;
  return (p["name"] as string | undefined) || [p["first_name"], p["last_name"]].filter(Boolean).join(" ") || null;
}
