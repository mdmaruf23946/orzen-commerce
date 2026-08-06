import { useEffect } from "react";

import { isChunkLoadError } from "@/lib/chunk-recovery";
import { readUserContext, trackError } from "@/lib/error-context";

/**
 * While the component is mounted, forward any uncaught error or unhandled
 * promise rejection (async handlers, server-fn calls, background work) to the
 * error pipeline tagged with this route's scope. Chunk-load errors are skipped
 * because chunk-recovery already handles them.
 */
export function useRouteErrorTracking(scope: string) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let user: { userId?: string; email?: string } = {};
    let alive = true;
    readUserContext().then((u) => {
      if (alive) user = u;
    });

    const onError = (event: ErrorEvent) => {
      const err = event.error ?? event.message;
      if (isChunkLoadError(err)) return;
      trackError(err, `${scope} (window.onerror)`, user);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) return;
      trackError(event.reason, `${scope} (unhandledrejection)`, user);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      alive = false;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [scope]);
}
