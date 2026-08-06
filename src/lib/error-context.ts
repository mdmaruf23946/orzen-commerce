// Shared helpers for end-to-end runtime error tracking.
//
// Collects a serialisable snapshot (error + stack + user/session context) and
// forwards it to the Lovable error pipeline + console, so any runtime failure
// on an instrumented route is visible immediately instead of being hidden
// behind a generic "page didn't load" screen.

import { reportLovableError } from "./lovable-error-reporting";

export type ErrorSnapshot = {
  name: string;
  message: string;
  stack: string;
  cause?: string;
  route: string;
  scope: string;
  at: string;
  userId?: string;
  email?: string;
  storeId?: string;
  url?: string;
  userAgent?: string;
  buildMode: string;
};

export function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  if (typeof value === "string") return new Error(value);
  try {
    return new Error(JSON.stringify(value));
  } catch {
    return new Error(String(value));
  }
}

/** Best-effort user context. Never throws, never blocks rendering. */
export async function readUserContext(): Promise<{ userId?: string; email?: string }> {
  if (typeof window === "undefined") return {};
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    return { userId: data.session?.user?.id, email: data.session?.user?.email ?? undefined };
  } catch {
    return {};
  }
}

export function buildSnapshot(
  error: unknown,
  scope: string,
  extra: Partial<ErrorSnapshot> = {},
): ErrorSnapshot {
  const err = toError(error);
  return {
    name: err.name,
    message: err.message,
    stack: err.stack ?? "(no stack captured)",
    cause: err.cause ? String((err.cause as any)?.message ?? err.cause) : undefined,
    route: typeof window !== "undefined" ? window.location.pathname : "(ssr)",
    scope,
    at: new Date().toISOString(),
    url: typeof window !== "undefined" ? window.location.href : undefined,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    buildMode: import.meta.env.DEV ? "development" : "production",
    ...extra,
  };
}

export function formatSnapshot(s: ErrorSnapshot): string {
  return [
    `[${s.scope}] ${s.name}: ${s.message}`,
    s.cause ? `cause: ${s.cause}` : "",
    `route: ${s.route}`,
    `time: ${s.at}`,
    `user: ${s.email ?? s.userId ?? "anonymous"}`,
    s.storeId ? `store: ${s.storeId}` : "",
    `build: ${s.buildMode}`,
    s.url ? `url: ${s.url}` : "",
    s.userAgent ? `ua: ${s.userAgent}` : "",
    "",
    s.stack,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Log + forward one error. Returns the snapshot for UI display. */
export function trackError(
  error: unknown,
  scope: string,
  extra: Partial<ErrorSnapshot> = {},
): ErrorSnapshot {
  const snapshot = buildSnapshot(error, scope, extra);
  // eslint-disable-next-line no-console
  console.error(`[error-tracking] ${formatSnapshot(snapshot)}`);
  reportLovableError(toError(error), { ...snapshot });
  return snapshot;
}
