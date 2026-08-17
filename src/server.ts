import "./lib/error-capture";
import { getRoutingHosts, isRewritablePath, resolveTenant } from "./lib/tenant-host";


import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      const envRecord = {
        ...(typeof process !== "undefined" ? (process.env as Record<string, string | undefined>) : {}),
        ...((env ?? {}) as Record<string, string | undefined>),
      };
      const hosts = await getRoutingHosts(envRecord);
      const rootDomain = hosts.rootDomain;

      // Canonical host: redirect www.<root> → <root> (301, preserve path + query)
      if (url.hostname === `www.${rootDomain}`) {
        url.hostname = rootDomain;
        return Response.redirect(url.toString(), 301);
      }

      // Multi-tenant: serve store subdomains and verified custom domains at
      // clean root URLs by rewriting the path internally (browser URL is kept).
      let workRequest = request;
      if (isRewritablePath(url.pathname)) {
        const tenant = await resolveTenant(url.hostname, envRecord);
        if (tenant) {
          // Non-primary host → 301 to the store's canonical hostname.
          const primary = tenant.primaryHostname;
          if (primary && primary !== url.hostname.toLowerCase()) {
            const canonical = new URL(url.toString());
            canonical.hostname = primary;
            canonical.port = "";
            canonical.protocol = "https:";
            return Response.redirect(canonical.toString(), 301);
          }
          const rewritten = new URL(url.toString());
          const suffix = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
          rewritten.pathname = `/store/${tenant.slug}${suffix}`;
          workRequest = new Request(rewritten.toString(), request);
        }
      }


      const handler = await getServerEntry();
      const response = await handler.fetch(workRequest, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
