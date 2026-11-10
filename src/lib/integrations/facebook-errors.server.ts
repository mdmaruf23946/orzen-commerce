// Turns raw Meta Graph API errors into actionable, human-readable guidance.
// Server-only: never expose tokens or secrets in these messages.

export type GraphLikeError = Error & { code?: number; subcode?: number };

const MISSING_PERMISSION_RE = /one of these permissions is needed:\s*([a-z_,\s]+)/i;

/** Extracts the permission names Meta says are missing, if any. */
export function missingPermissions(message: string): string[] {
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(MISSING_PERMISSION_RE.source, "gi");
  while ((m = re.exec(message))) {
    for (const p of (m[1] ?? "").split(/[,\s]+/)) {
      const t = p.trim();
      if (t.startsWith("pages_") || t.startsWith("business_")) out.add(t);
    }
  }
  return [...out];
}

/**
 * Maps common Messenger / Page errors to a clear explanation the merchant can
 * act on. Falls back to the original Meta message.
 */
export function explainGraphError(err: unknown, ctx?: "send" | "subscribe"): string {
  const e = (err ?? {}) as GraphLikeError;
  const raw = typeof err === "string" ? err : e.message || "Facebook request failed";
  const code = e.code;

  const perms = missingPermissions(raw);
  if (perms.length || code === 200) {
    const list = perms.length ? perms.join(", ") : "pages_manage_metadata";
    return `Your Page access token is missing the ${list} permission, so Facebook refuses to send events to this app. Regenerate a Page access token with ${list} (plus pages_messaging and pages_read_engagement) granted, then paste it here and connect again.`;
  }

  if (code === 100 && /matching user|No matching user found/i.test(raw)) {
    return "No matching Messenger user. The recipient must be a PSID (Page-scoped ID) — not your Facebook profile ID or username. A PSID only exists after that person messages your Page, and the Page must receive the message through this app's webhook. Send a message to the Page first, then pick the PSID captured in the inbox and retry.";
  }

  if (code === 283) {
    return "Facebook refused this because the Page access token is missing the pages_read_engagement permission. Regenerate the Page access token with pages_read_engagement, pages_manage_posts, pages_manage_engagement and pages_manage_metadata granted, then reconnect the Page.";
  }

  if (code === 3 || code === 299) {
    return "Facebook says this app/token is not allowed to perform this action yet. Grant the required Page permissions to the token (pages_manage_posts for publishing, pages_manage_engagement for replying/hiding/deleting, pages_manage_metadata for blocking and event delivery) and reconnect the Page.";
  }

  if (code === 10 || code === 200) {
    return `${raw} — this usually means the Page access token lacks the required permission or the Page is not subscribed to this app.`;
  }

  if (code === 190) {
    return "The saved Page access token is invalid or expired. Generate a new Page access token and reconnect the Page.";
  }

  if (code === 551 || code === 1545041) {
    return "This person can't be messaged right now (outside the 24-hour messaging window or they blocked the Page). Ask them to message the Page again and reply within 24 hours.";
  }

  if (ctx === "subscribe") {
    return `Could not enable event delivery for this Page: ${raw}`;
  }
  return raw;
}
