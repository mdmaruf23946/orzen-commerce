// Automatic store-subdomain provisioning on Cloudflare.
//
// Cloudflare Pages does not serve a hostname it does not know about: a request
// to <slug>.orzen.top that only has a DNS record (or a wildcard) but no custom
// domain registered on the Pages project fails at the edge (522 / 1016).
// So for every new store we do two things through the Cloudflare API:
//
//   1. create a proxied CNAME  <slug>.<root>  ->  <project>.pages.dev
//   2. register <slug>.<root> as a custom domain on the Pages project
//
// Both calls are idempotent and every failure is non-fatal for store creation.
//
// Required env (Cloudflare Pages project + Lovable secrets):
//   CF_API_TOKEN      token with Zone:DNS:Edit + Pages:Edit
//   CF_ZONE_ID        zone id of the root domain
//   CF_ACCOUNT_ID     Cloudflare account id
//   CF_PAGES_PROJECT  Pages project name
//   CF_PAGES_HOST     optional, defaults to <CF_PAGES_PROJECT>.pages.dev

const CF_API = "https://api.cloudflare.com/client/v4";

export type SubdomainProvisionResult = {
  ok: boolean;
  hostname: string;
  reason?: "not_configured" | "error";
  dns?: "created" | "updated" | "exists" | "skipped";
  pages?: "created" | "exists" | "skipped";
  status?: string | null;
  error?: string;
};

type CFResponse<T> = {
  success: boolean;
  errors?: { code: number; message: string }[];
  result: T;
};

function cfEnv() {
  const token = process.env["CF_API_TOKEN"];
  const zoneId = process.env["CF_ZONE_ID"];
  const accountId = process.env["CF_ACCOUNT_ID"];
  const project = process.env["CF_PAGES_PROJECT"];
  if (!token || !zoneId || !accountId || !project) return null;
  const pagesHost = (process.env["CF_PAGES_HOST"] || `${project}.pages.dev`).toLowerCase();
  return { token, zoneId, accountId, project, pagesHost };
}

/** True when automatic subdomain attachment can run at all. */
export function subdomainAutomationConfigured() {
  return cfEnv() !== null;
}

async function cf<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const json = (await res.json()) as CFResponse<T>;
  if (!json.success) {
    const msg = json.errors?.map((e) => `[${e.code}] ${e.message}`).join(", ") || `HTTP ${res.status}`;
    const err = new Error(`Cloudflare API: ${msg}`);
    (err as any).codes = json.errors?.map((e) => e.code) ?? [];
    throw err;
  }
  return json.result;
}

/**
 * Make <hostname> live on the Pages project. Safe to call repeatedly.
 */
export async function ensureSubdomainAttached(hostname: string): Promise<SubdomainProvisionResult> {
  const host = hostname.trim().toLowerCase();
  const env = cfEnv();
  if (!env) return { ok: false, hostname: host, reason: "not_configured" };

  try {
    // 1. DNS — proxied CNAME to the Pages host.
    let dns: SubdomainProvisionResult["dns"] = "exists";
    const records = await cf<{ id: string; content: string; type: string; proxied: boolean }[]>(
      env.token,
      `/zones/${env.zoneId}/dns_records?name=${encodeURIComponent(host)}`,
    );
    const existing = records?.[0];
    if (!existing) {
      await cf(env.token, `/zones/${env.zoneId}/dns_records`, {
        method: "POST",
        body: JSON.stringify({
          type: "CNAME",
          name: host,
          content: env.pagesHost,
          proxied: true,
          ttl: 1,
          comment: "ORZEN store subdomain (auto)",
        }),
      });
      dns = "created";
    } else if (
      existing.type !== "CNAME" ||
      existing.content.toLowerCase() !== env.pagesHost ||
      !existing.proxied
    ) {
      await cf(env.token, `/zones/${env.zoneId}/dns_records/${existing.id}`, {
        method: "PUT",
        body: JSON.stringify({ type: "CNAME", name: host, content: env.pagesHost, proxied: true, ttl: 1 }),
      });
      dns = "updated";
    }

    // 2. Pages custom domain.
    let pages: SubdomainProvisionResult["pages"] = "exists";
    let status: string | null = null;
    const base = `/accounts/${env.accountId}/pages/projects/${env.project}/domains`;
    try {
      const created = await cf<{ name: string; status?: string }>(env.token, base, {
        method: "POST",
        body: JSON.stringify({ name: host }),
      });
      pages = "created";
      status = created?.status ?? null;
    } catch (e) {
      const msg = (e as Error).message;
      // 8000000 / "already exists" — treat as success and just read the status.
      if (!/already|exists|8000000/i.test(msg)) throw e;
      const info = await cf<{ status?: string }>(
        env.token,
        `${base}/${encodeURIComponent(host)}`,
      ).catch(() => null);
      status = info?.status ?? null;
    }

    // Nudge validation for a freshly added / pending domain.
    if (status && status !== "active") {
      await cf(env.token, `${base}/${encodeURIComponent(host)}`, { method: "PATCH", body: "{}" }).catch(
        () => null,
      );
    }

    return { ok: true, hostname: host, dns, pages, status };
  } catch (e) {
    return { ok: false, hostname: host, reason: "error", error: (e as Error).message };
  }
}

/** Read the current Pages custom-domain status for a hostname. */
export async function getSubdomainStatus(hostname: string): Promise<string | null> {
  const env = cfEnv();
  if (!env) return null;
  const info = await cf<{ status?: string }>(
    env.token,
    `/accounts/${env.accountId}/pages/projects/${env.project}/domains/${encodeURIComponent(
      hostname.toLowerCase(),
    )}`,
  ).catch(() => null);
  return info?.status ?? null;
}

/** Remove a subdomain from Pages + DNS (used when a merchant renames it). */
export async function detachSubdomain(hostname: string): Promise<void> {
  const env = cfEnv();
  if (!env) return;
  const host = hostname.trim().toLowerCase();
  await cf(
    env.token,
    `/accounts/${env.accountId}/pages/projects/${env.project}/domains/${encodeURIComponent(host)}`,
    { method: "DELETE" },
  ).catch(() => null);
  const records = await cf<{ id: string; comment?: string }[]>(
    env.token,
    `/zones/${env.zoneId}/dns_records?name=${encodeURIComponent(host)}`,
  ).catch(() => [] as { id: string }[]);
  for (const r of records ?? []) {
    await cf(env.token, `/zones/${env.zoneId}/dns_records/${r.id}`, { method: "DELETE" }).catch(() => null);
  }
}
