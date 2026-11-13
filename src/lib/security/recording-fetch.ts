// SSRF-safe fetch for call-recording URLs supplied by providers/callbacks.
// Validates the final URL (https, port 443, no credentials, no internal/private
// hosts) and never follows redirects. Returns null when the URL is unsafe.
import { outboundUrlProblem } from "@/lib/security/outbound-url";

export async function safeRecordingFetch(
  url: string,
  init: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
): Promise<Response | null> {
  if (outboundUrlProblem(url)) return null;
  return fetchImpl(url, { ...init, redirect: "error" });
}
