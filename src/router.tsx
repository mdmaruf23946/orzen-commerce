import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { getTenantRewrite } from "./lib/tenant-rewrite";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    // On a store subdomain / custom domain the browser URL stays at "/" while
    // the app renders /store/<slug>; keep the client router in the same frame.
    rewrite: getTenantRewrite(),
  });

  return router;
};
