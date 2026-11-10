// Cloudflare SSL for SaaS integration.
// Server-only helpers that call the Cloudflare "Custom Hostnames" API to
// attach, verify, and detach merchant custom domains under the platform's
// fallback origin (stores.orzen.top). Cloudflare provisions the TLS cert
// automatically per hostname — no per-domain DNS or cert config on our end.
//
// Reference: https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/

const CF_API = "https://api.cloudflare.com/client/v4";

type CFResponse<T> = {
  success: boolean;
  errors: { code: number; message: string }[];
  messages: unknown[];
  result: T;
};

export type CFHostname = {
  id: string;
  hostname: string;
  status: "pending" | "active" | "active_redeploying" | "moved" | "pending_deletion" | "deleted" | "pending_blocked" | "pending_migration" | "pending_provisioned" | "test_pending" | "test_active" | "test_active_apex" | "test_blocked" | "test_failed" | "provisioned" | "blocked";
  ssl: {
    id: string;
    status: string;
    method: "http" | "txt" | "cname";
    type: "dv";
    validation_records?: { txt_name?: string; txt_value?: string; http_url?: string; http_body?: string }[];
    validation_errors?: { message: string }[];
  };
  ownership_verification?: { type: "txt"; name: string; value: string };
  verification_errors?: string[];
  custom_origin_server?: string;
};

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}. Push it with scripts/cf-push-secrets.sh`);
  return v;
}

async function cf<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = requireEnv("CF_API_TOKEN");
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const json = (await res.json()) as CFResponse<T>;
  if (!json.success) {
    throw new Error(
      `Cloudflare API ${res.status}: ${json.errors?.map((e) => `[${e.code}] ${e.message}`).join(", ") || "unknown error"}`,
    );
  }
  return json.result;
}

/** Attach a customer custom hostname to the platform zone. */
export async function attachCustomHostname(hostname: string): Promise<CFHostname> {
  const zoneId = requireEnv("CF_ZONE_ID");
  return cf<CFHostname>(`/zones/${zoneId}/custom_hostnames`, {
    method: "POST",
    body: JSON.stringify({
      hostname,
      ssl: {
        method: "http",             // http-01 challenge; fastest when DNS is already CNAMEd
        type: "dv",
        settings: { min_tls_version: "1.2", http2: "on" },
        bundle_method: "ubiquitous",
        wildcard: false,
      },
    }),
  });
}

/** Poll a hostname's status (SSL + ownership verification). */
export async function getCustomHostname(cfHostnameId: string): Promise<CFHostname> {
  const zoneId = requireEnv("CF_ZONE_ID");
  return cf<CFHostname>(`/zones/${zoneId}/custom_hostnames/${cfHostnameId}`);
}

/** Detach a customer custom hostname. Safe to call on already-deleted rows. */
export async function detachCustomHostname(cfHostnameId: string): Promise<void> {
  const zoneId = requireEnv("CF_ZONE_ID");
  try {
    await cf<unknown>(`/zones/${zoneId}/custom_hostnames/${cfHostnameId}`, { method: "DELETE" });
  } catch (e) {
    // 1436 = "custom hostname not found" — treat as success (idempotent)
    if (!/1436/.test((e as Error).message)) throw e;
  }
}

/** Trigger Cloudflare to re-check ownership + reissue TLS if needed. */
export async function revalidateCustomHostname(cfHostnameId: string): Promise<CFHostname> {
  const zoneId = requireEnv("CF_ZONE_ID");
  return cf<CFHostname>(`/zones/${zoneId}/custom_hostnames/${cfHostnameId}`, {
    method: "PATCH",
    body: JSON.stringify({ ssl: { method: "http", type: "dv" } }),
  });
}
