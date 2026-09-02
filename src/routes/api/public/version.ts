import { createFileRoute } from "@tanstack/react-router";

// Build stamp baked in at bundle time, so a single request tells us which
// build a given host (platform, storefront subdomain, landing host) is running.
const BUILT_AT = new Date().toISOString();

/** Public build-version probe: GET /api/public/version */
export const Route = createFileRoute("/api/public/version")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        return new Response(
          JSON.stringify({
            builtAt: BUILT_AT,
            commit:
              process.env["CF_PAGES_COMMIT_SHA"] ??
              process.env["COMMIT_SHA"] ??
              process.env["GIT_COMMIT"] ??
              null,
            branch: process.env["CF_PAGES_BRANCH"] ?? null,
            host: url.hostname,
          }),
          {
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store",
            },
          },
        );
      },
    },
  },
});
