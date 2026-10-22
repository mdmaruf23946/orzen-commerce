import { getRequest } from "@tanstack/react-start/server";

const TRUSTED_SUFFIXES = [".orzen.top", ".lovable.app", ".lovableproject.com"];
const TRUSTED_HOSTS = new Set(["orzen.top", "localhost", "127.0.0.1"]);

function trustedHost(host: string, requestHost: string | null) {
  const h = host.toLowerCase();
  if (requestHost && h === requestHost.toLowerCase()) return true;
  if (TRUSTED_HOSTS.has(h)) return true;
  return TRUSTED_SUFFIXES.some((s) => h.endsWith(s));
}

/**
 * Payment return/cancel/webhook URLs must point back at this platform.
 * Accept the caller-supplied origin only when it is the current request host
 * or a known platform host; otherwise fall back to the request's own origin.
 */
export function safeReturnOrigin(supplied: string): string {
  let reqOrigin: string | null = null;
  let reqHost: string | null = null;
  try {
    const req = getRequest();
    const fwdHost = req?.headers.get("x-forwarded-host") ?? req?.headers.get("host");
    const u = req ? new URL(req.url) : null;
    reqHost = (fwdHost ?? u?.host ?? "").split(":")[0] || null;
    if (u) reqOrigin = `${u.protocol}//${fwdHost ?? u.host}`;
  } catch {
    /* no request context */
  }
  try {
    const u = new URL(supplied);
    if ((u.protocol === "https:" || u.hostname === "localhost") && trustedHost(u.hostname, reqHost)) {
      return u.origin;
    }
  } catch {
    /* fall through */
  }
  if (reqOrigin) return reqOrigin.replace(/\/$/, "");
  return "https://orzen.top";
}
