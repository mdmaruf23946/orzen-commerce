// Cloudflare Turnstile verification (server-only).
// When TURNSTILE_SECRET_KEY is not configured the check is skipped so forms
// keep working; this lets the bot shield be rolled out gradually.
import { clientIp } from "@/lib/rate-limit.server";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileEnabled(): boolean {
  return !!process.env["TURNSTILE_SECRET_KEY"];
}

export async function verifyTurnstile(
  token: string | null | undefined,
  request?: Request,
): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  const secret = process.env["TURNSTILE_SECRET_KEY"];
  if (!secret) return { ok: true, skipped: true };
  if (!token) return { ok: false, error: "missing-token" };

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", token);
  if (request) form.set("remoteip", clientIp(request));

  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body: form });
    const json = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (json.success) return { ok: true };
    return { ok: false, error: (json["error-codes"] ?? []).join(",") || "failed" };
  } catch {
    // Network failure on Cloudflare's side must not block real orders.
    return { ok: true, skipped: true };
  }
}

export const TURNSTILE_FAILED_BN =
  "নিরাপত্তা যাচাই সম্পন্ন হয়নি। পেজটি রিফ্রেশ করে আবার চেষ্টা করুন।";
