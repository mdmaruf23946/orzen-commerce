// Recovers from transient "failed to load a JS chunk" errors.
//
// Why this exists: when a new version of the app is deployed (or the network
// blips) while a tab is open, navigating to a lazily-loaded page such as
// /admin/orders tries to fetch a chunk hash that no longer exists. The dynamic
// import rejects, the router error boundary catches it and the user sees
// "This page didn't load" even though nothing is actually broken.
//
// The fix: detect that specific failure and reload the page once (guarded by
// sessionStorage so we can never loop), which pulls the fresh asset manifest.

const RELOAD_FLAG = "orzen:chunk-reload";

const CHUNK_ERROR_PATTERNS = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "importing a module script failed",
  "unable to preload css",
  "loading chunk",
  "loading css chunk",
];

export function isChunkLoadError(error: unknown): boolean {
  const message =
    typeof error === "string"
      ? error
      : error instanceof Error
        ? `${error.name} ${error.message}`
        : "";
  const lower = message.toLowerCase();
  return CHUNK_ERROR_PATTERNS.some((pattern) => lower.includes(pattern));
}

// Never reload more than once inside this window — that would loop on a
// genuinely broken build. Outside it (e.g. a later deploy in a long-lived
// tab) recovery is allowed again instead of being dead for the whole session.
const RELOAD_COOLDOWN_MS = 60_000;

/** Reload to pick up the new build. Returns true if a reload was started. */
export function recoverFromChunkError(error: unknown): boolean {
  if (typeof window === "undefined") return false;
  if (!isChunkLoadError(error)) return false;
  try {
    const last = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0);
    if (last && Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    /* storage unavailable — still attempt one reload */
  }
  window.location.reload();
  return true;
}

/** Clear the guard after a healthy render so future deploys can recover too. */
export function clearChunkRecoveryFlag() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* ignore */
  }
}

export function installChunkRecovery() {
  if (typeof window === "undefined") return;
  if ((window as any).__orzenChunkRecovery) return;
  (window as any).__orzenChunkRecovery = true;

  // Vite emits this when a preloaded module/CSS asset 404s.
  window.addEventListener("vite:preloadError", (event) => {
    if (recoverFromChunkError((event as any).payload ?? event)) event.preventDefault?.();
  });

  window.addEventListener("unhandledrejection", (event) => {
    recoverFromChunkError((event as PromiseRejectionEvent).reason);
  });

  window.addEventListener("error", (event) => {
    recoverFromChunkError((event as ErrorEvent).error ?? (event as ErrorEvent).message);
  });
}
