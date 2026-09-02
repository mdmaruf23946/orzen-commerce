import { createFileRoute } from "@tanstack/react-router";

// Stamp of when this worker instance first served a request: together with the
// commit below it tells us which build a given host is running.
let BUILT_AT: string | null = null;

/** Public build-version probe: GET /api/public/version */
export const Route = createFileRoute("/api/public/version")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        return new Response(
          JSON.stringify({
            bootedAt: (BUILT_AT ??= new Date().toISOString()),
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
