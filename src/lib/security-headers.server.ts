/**
 * Production-grade HTTP security headers applied to every response that
 * leaves the Worker (platform pages, storefronts, and API routes alike).
 *
 * Notes on the choices:
 * - X-Frame-Options uses SAMEORIGIN (not DENY): the admin theme/landing
 *   preview frames embed our own pages in an iframe. SAMEORIGIN still blocks
 *   clickjacking from any external site.
 * - HSTS is only sent on HTTPS requests so local/dev over HTTP keeps working.
 * - CSP is deployed in Report-Only mode first: the browser reports what a
 *   strict policy would break without breaking anything. After reviewing real
 *   reports we can promote it to an enforced policy.
 */

const CROSS_ORIGIN_ISOLATION_EXEMPT = /facebook|google/i; // reserved, documented

function buildCspReportOnly(): string {
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": [
      "'self'",
      "'unsafe-inline'", // required until enforced CSP can be tuned (TanStack hydration inline scripts)
      "https://www.googletagmanager.com",
      "https://www.google-analytics.com",
      "https://connect.facebook.net",
      "https://analytics.tiktok.com",
      "https://static.cloudflareinsights.com",
    ],
    "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "media-src": ["'self'", "https:", "blob:"],
    "connect-src": [
      "'self'",
      "https://*.supabase.co",
      "wss://*.supabase.co",
      "https://www.google-analytics.com",
      "https://www.googletagmanager.com",
      "https://graph.facebook.com",
      "https://www.facebook.com",
      "https://analytics.tiktok.com",
      "https://cloudflareinsights.com",
      "https://*.cloudflare.com",
    ],
    "frame-src": [
      "'self'",
      "https://www.youtube.com",
      "https://www.youtube-nocookie.com",
      "https://player.vimeo.com",
      "https://www.facebook.com",
    ],
    "frame-ancestors": ["'self'"],
    "form-action": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "upgrade-insecure-requests": [],
  };
  return Object.entries(directives)
    .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
    .join("; ");
}

/**
 * Mutates and returns `headers` with the full security header set.
 * Safe to call on any response, including API/webhook JSON responses.
 */
export function applySecurityHeaders(headers: Headers, request: Request): Headers {
  const set = (name: string, value: string) => {
    if (!headers.has(name)) headers.set(name, value);
  };

  // HSTS — force HTTPS for 2 years incl. subdomains (storefronts). HTTPS only.
  if (new URL(request.url).protocol === "https:") {
    set("strict-transport-security", "max-age=63072000; includeSubDomains; preload");
  }

  set("x-content-type-options", "nosniff");
  set("x-frame-options", "SAMEORIGIN");
  set("referrer-policy", "strict-origin-when-cross-origin");
  // Microphone stays allowed for self: the AI voice/call features need it.
  set(
    "permissions-policy",
    "camera=(), microphone=(self), geolocation=(), payment=(self), usb=(), bluetooth=(), accelerometer=(), gyroscope=(), magnetometer=()",
  );
  // Allow OAuth popups (Google sign-in) while keeping tab isolation.
  set("cross-origin-opener-policy", "same-origin-allow-popups");

  // CSP in report-only mode (step 1 of 2 — nothing is blocked yet).
  set("content-security-policy-report-only", buildCspReportOnly());

  return headers;
}

export { CROSS_ORIGIN_ISOLATION_EXEMPT };
