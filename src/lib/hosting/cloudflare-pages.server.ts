// Automatic store-subdomain provisioning on Cloudflare.
//
// The app is deployed as a Cloudflare **Worker** (not Pages). A request to
// <slug>.orzen.top that only has DNS (or a wildcard) but is not registered as
// a Worker Custom Domain fails at the edge with 522 / 1016.
//
// So for every new store we register <slug>.<root> as a Worker custom domain
// through the Cloudflare API. Cloudflare creates/manages the proxied DNS
// record and the certificate for that hostname automatically, so no
// Zone:DNS:Edit permission is required.
//
// Required env (Lovable secrets + the Worker's own env):
//   CF_API_TOKEN      token with Account: Workers Scripts:Edit + Zone: Workers Routes:Edit
//   CF_ZONE_ID        zone id of the root domain
//   CF_ACCOUNT_ID     Cloudflare account id
//   CF_WORKER_NAME    worker service name (falls back to CF_PAGES_PROJECT)

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
  const service = process.env["CF_WORKER_NAME"] || process.env["CF_PAGES_PROJECT"];
  if (!token || !zoneId || !accountId || !service) return null;
  return { token, zoneId, accountId, service };
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

type WorkerDomain = { id: string; hostname: string; service: string; environment: string };

async function listWorkerDomains(env: NonNullable<ReturnType<typeof cfEnv>>, hostname: string) {
  const all = await cf<WorkerDomain[]>(
    env.token,
    `/accounts/${env.accountId}/workers/domains?zone_id=${env.zoneId}&hostname=${encodeURIComponent(hostname)}`,
  ).catch(() => [] as WorkerDomain[]);
  return (all ?? []).filter((d) => d.hostname.toLowerCase() === hostname);
}

/**
 * Make <hostname> live on the Worker. Safe to call repeatedly (PUT is an upsert).
 */
export async function ensureSubdomainAttached(hostname: string): Promise<SubdomainProvisionResult> {
  const host = hostname.trim().toLowerCase();
  const env = cfEnv();
  if (!env) return { ok: false, hostname: host, reason: "not_configured" };

  try {
    const before = await listWorkerDomains(env, host);
    await cf<WorkerDomain>(env.token, `/accounts/${env.accountId}/workers/domains`, {
      method: "PUT",
      body: JSON.stringify({
        environment: "production",
        hostname: host,
        service: env.service,
        zone_id: env.zoneId,
      }),
    });
    return {
      ok: true,
      hostname: host,
      dns: "skipped",
      pages: before.length ? "exists" : "created",
      status: "active",
    };
  } catch (e) {
    return { ok: false, hostname: host, reason: "error", error: (e as Error).message };
  }
}

/** Read the current custom-domain status for a hostname. */
export async function getSubdomainStatus(hostname: string): Promise<string | null> {
  const env = cfEnv();
  if (!env) return null;
  const found = await listWorkerDomains(env, hostname.trim().toLowerCase());
  return found.length ? "active" : null;
}

/** Remove a subdomain from the Worker (used when a merchant renames it). */
export async function detachSubdomain(hostname: string): Promise<void> {
  const env = cfEnv();
  if (!env) return;
  const found = await listWorkerDomains(env, hostname.trim().toLowerCase());
  for (const d of found) {
    await cf(env.token, `/accounts/${env.accountId}/workers/domains/${d.id}`, {
      method: "DELETE",
    }).catch(() => null);
  }
}
