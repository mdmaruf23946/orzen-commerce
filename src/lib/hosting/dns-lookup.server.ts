// DNS lookups that work inside the Cloudflare Workers runtime.
//
// `node:dns` is a non-functional stub on workerd (every call throws
// "[unenv] ... is not implemented yet"), so all DNS verification goes through
// DNS-over-HTTPS instead. Cloudflare's resolver is used first with Google as a
// fallback, so a single resolver outage does not break domain verification.

const DOH_ENDPOINTS = [
  "https://cloudflare-dns.com/dns-query",
  "https://dns.google/resolve",
];

type DohAnswer = { name: string; type: number; TTL?: number; data: string };
type DohResponse = { Status: number; Answer?: DohAnswer[] };

const TYPE_CODE: Record<string, number> = { A: 1, CNAME: 5, TXT: 16 };

function clean(v: string) {
  return v.trim().replace(/^"(.*)"$/s, "$1").replace(/"\s+"/g, "").replace(/\.$/, "");
}

async function query(name: string, type: "A" | "CNAME" | "TXT"): Promise<string[]> {
  const host = name.trim().toLowerCase().replace(/\.$/, "");
  if (!host) return [];
  let lastError: unknown = null;

  for (const endpoint of DOH_ENDPOINTS) {
    try {
      const res = await fetch(
        `${endpoint}?name=${encodeURIComponent(host)}&type=${type}`,
        { headers: { accept: "application/dns-json" } },
      );
      if (!res.ok) {
        lastError = new Error(`DoH ${res.status}`);
        continue;
      }
      const json = (await res.json()) as DohResponse;
      const wanted = TYPE_CODE[type];
      return (json.Answer ?? [])
        .filter((a) => a.type === wanted)
        .map((a) => clean(a.data))
        .filter(Boolean);
    } catch (e) {
      lastError = e;
    }
  }
  if (lastError) return [];
  return [];
}

export const resolveTxt = (host: string) => query(host, "TXT");
export const resolveCname = (host: string) => query(host, "CNAME");
export const resolveA = (host: string) => query(host, "A");

/**
 * Follow the chain for a hostname and report everything we know about it.
 * CNAME chains are flattened by public resolvers, so we also inspect the
 * A records to detect that a host ultimately lands on the platform.
 */
export async function inspectHost(host: string) {
  const [a, cname, txt] = await Promise.all([
    resolveA(host),
    resolveCname(host),
    resolveTxt(host),
  ]);
  return { a, cname, txt };
}

/** HTTP-01 style fallback: fetch the well-known token file over http/https. */
export async function fetchHttpChallenge(host: string, token: string): Promise<boolean> {
  const path = `/.well-known/orzen-domain-verification/${encodeURIComponent(token)}`;
  for (const scheme of ["https", "http"]) {
    try {
      const res = await fetch(`${scheme}://${host}${path}`, {
        redirect: "follow",
        headers: { accept: "text/plain" },
      });
      if (!res.ok) continue;
      const body = (await res.text()).trim();
      if (body === token) return true;
    } catch {
      /* try next scheme */
    }
  }
  return false;
}
