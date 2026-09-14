// Single place every server module reads environment values from.
//
// On Lovable hosting the values live in `process.env`. On Cloudflare
// (Workers / Pages) secrets are delivered as a per-request `env` binding and,
// depending on the compatibility flags, may never appear in `process.env` —
// which made every admin/agent request crash on the custom domain while the
// same code worked on the Lovable URL.
//
// `src/server.ts` captures the binding on the first request; every lookup
// checks `process.env` first and falls back to that captured binding.
//
// The store hangs off globalThis so a split bundle still shares one copy.
// Values are never logged or returned to the browser.

const STORE_KEY = "__ORZEN_SERVER_ENV__";

type EnvRecord = Record<string, string | undefined>;

function store(): EnvRecord {
  const g = globalThis as unknown as Record<string, EnvRecord | undefined>;
  if (!g[STORE_KEY]) g[STORE_KEY] = {};
  return g[STORE_KEY]!;
}

/** Merge a Cloudflare-style `env` binding into the shared lookup store. */
export function captureServerEnv(env: unknown): void {
  if (!env || typeof env !== "object") return;
  const target = store();
  for (const [key, value] of Object.entries(env as Record<string, unknown>)) {
    if (typeof value === "string" && value.length > 0) target[key] = value;
  }
}

/** Read a server-side environment value from process.env or the worker binding. */
export function serverEnv(name: string): string | undefined {
  const fromProcess =
    typeof process !== "undefined" && process.env
      ? (process.env as EnvRecord)[name]
      : undefined;
  if (typeof fromProcess === "string" && fromProcess.length > 0) return fromProcess;
  const fromBinding = store()[name];
  return typeof fromBinding === "string" && fromBinding.length > 0 ? fromBinding : undefined;
}

/** Same as serverEnv, but throws a clear, actionable error when unset. */
export function requireServerEnv(name: string): string {
  const value = serverEnv(name);
  if (!value) {
    throw new Error(
      `Server key ${name} is missing on this deployment. Add it to the hosting environment (Cloudflare Pages → Settings → Variables and Secrets) and redeploy.`,
    );
  }
  return value;
}

/** Names that must exist for the admin panel and AI agents to work. */
export const REQUIRED_SERVER_KEYS = [
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "CREDENTIALS_ENCRYPTION_KEY",
  "LOVABLE_API_KEY",
] as const;

/** Presence-only report (never values) for the owner health check. */
export function serverEnvReport(): { name: string; present: boolean }[] {
  return REQUIRED_SERVER_KEYS.map((name) => ({
    name,
    present:
      Boolean(serverEnv(name)) ||
      (name === "CREDENTIALS_ENCRYPTION_KEY" && Boolean(serverEnv("PAYMENT_CREDENTIALS_KEY"))),
  }));
}
