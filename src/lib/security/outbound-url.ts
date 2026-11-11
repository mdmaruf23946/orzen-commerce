// Guards server-side fetches to user-configured URLs (webhooks) against SSRF:
// HTTPS only, standard port, no credentials, and no localhost / private /
// link-local / metadata hosts. Returns null when the URL is safe.
const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal", "metadata"]);

function privateV4(h: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return (
    a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}

export function outboundUrlProblem(raw: string): string | null {
  let u: URL;
  try { u = new URL(raw); } catch { return "Invalid URL"; }
  if (u.protocol !== "https:") return "Only https:// URLs are allowed";
  if (u.username || u.password) return "URLs with credentials are not allowed";
  if (u.port && u.port !== "443") return "Only the standard HTTPS port is allowed";
  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host || BLOCKED_HOSTS.has(host) || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    return "Internal addresses are not allowed";
  }
  if (privateV4(host)) return "Private IP addresses are not allowed";
  if (host.includes(":")) return "IP address URLs are not allowed"; // any IPv6 literal
  if (/^\d+$/.test(host) || /^0x/i.test(host)) return "IP address URLs are not allowed";
  return null;
}
