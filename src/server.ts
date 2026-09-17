import "./lib/error-capture";
import { captureServerEnv } from "./lib/server-env";
// Loaded lazily inside the handler: the worker bundle has been observed to
// evaluate this entry before the statically-imported tenant-host module
// bindings are initialised ("isRewritablePath is not defined" → 500).
type TenantHost = typeof import("./lib/tenant-host");
let tenantHostPromise: Promise<TenantHost> | undefined;
function getTenantHost(): Promise<TenantHost> {
  if (!tenantHostPromise) tenantHostPromise = import("./lib/tenant-host");
  return tenantHostPromise;
}


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
    // Cloudflare delivers secrets as a per-request binding; share them with
    // every server module before any handler runs.
    captureServerEnv(env);
    try {
      const url = new URL(request.url);

      const envRecord = {
        ...(typeof process !== "undefined" ? (process.env as Record<string, string | undefined>) : {}),
        ...((env ?? {}) as Record<string, string | undefined>),
      };
      const { getRoutingHosts, isRewritablePath, resolveHostTarget, landingPublicHost } =
        await getTenantHost();
      const hosts = await getRoutingHosts(envRecord);
      const rootDomain = hosts.rootDomain;

      // Canonical host: redirect www.<root> → <root> (301, preserve path + query)
      if (url.hostname === `www.${rootDomain}`) {
        url.hostname = rootDomain;
        return Response.redirect(url.toString(), 301);
      }

      // A storefront must never be served under the platform host: that URL is
      // inside the platform PWA scope, so an installed ORZEN app would open the
      // store inside itself (ORZEN splash + icon). Send it to the store's own
      // host, where the store's own manifest/branding applies.
      if (url.hostname === rootDomain) {
        const m = url.pathname.match(/^\/store\/([a-z0-9-]+)(\/.*)?$/i);
        if (m && !url.searchParams.has("theme_preview")) {
          const target = new URL(url.toString());
          target.protocol = "https:";
          target.port = "";
          target.hostname = `${m[1].toLowerCase()}.${rootDomain}`;
          target.pathname = m[2] ?? "/";
          return Response.redirect(target.toString(), 301);
        }

        // Same rule for landing pages: a landing page must open on its own host
        // (custom domain or <slug>.<root>), never inside the platform PWA scope.
        const lp = url.pathname.match(/^\/lp\/([a-z0-9-]+)\/?$/i);
        if (lp && !url.searchParams.has("preview")) {
          const host = await landingPublicHost(lp[1], envRecord);
          if (host && host !== url.hostname) {
            const target = new URL(url.toString());
            target.protocol = "https:";
            target.port = "";
            target.hostname = host;
            target.pathname = "/";
            return Response.redirect(target.toString(), 301);
          }
        }
      }



      // Multi-tenant: serve store subdomains and verified custom domains at
      // clean root URLs by rewriting the path internally (browser URL is kept).
      let workRequest = request;
      let injectedTenant: { kind: string; slug: string } | null = null;
      if (isRewritablePath(url.pathname)) {
        const tenant = await resolveHostTarget(url.hostname, envRecord);
        if (tenant) {
          // Non-primary host → 301 to the canonical hostname.
          const primary = tenant.primaryHostname;
          if (primary && primary !== url.hostname.toLowerCase()) {
            const canonical = new URL(url.toString());
            canonical.hostname = primary;
            canonical.port = "";
            canonical.protocol = "https:";
            return Response.redirect(canonical.toString(), 301);
          }
          const rewritten = new URL(url.toString());
          if (tenant.kind === "landing") {
            // A landing-page host only ever serves that one page.
            rewritten.pathname = `/lp/${tenant.slug}`;
          } else {
            const suffix = url.pathname === "/" ? "" : url.pathname.replace(/\/$/, "");
            rewritten.pathname = `/store/${tenant.slug}${suffix}`;
          }
          workRequest = new Request(rewritten.toString(), request);
          injectedTenant = { kind: tenant.kind, slug: tenant.slug };
        }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(workRequest, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);

      const isHtml = (normalized.headers.get("content-type") ?? "").includes("text/html");

      // Tell the client router which tenant this host serves, so it keeps
      // rendering the storefront instead of hydrating the platform landing page.
      if (injectedTenant && isHtml) {
        const script = `<script>window.__ORZEN_TENANT__=${JSON.stringify(
          injectedTenant,
        )};window.__ORZEN_ROOT_DOMAIN__=${JSON.stringify(rootDomain)};</script>`;
        const html = await normalized.text();
        const patched = html.includes("<head>")
          ? html.replace("<head>", `<head>${script}`)
          : `${script}${html}`;
        const headers = new Headers(normalized.headers);
        headers.delete("content-length");
        // Storefront / landing HTML is merchant-editable: never let a CDN or
        // browser reuse it, or a freshly published edit stays invisible.
        headers.set("cache-control", "no-store, must-revalidate");
        return new Response(patched, { status: normalized.status, headers });
      }

      // Same rule for landing/store HTML reached through a platform path.
      if (isHtml && /^\/(lp|store)\//i.test(url.pathname)) {
        const headers = new Headers(normalized.headers);
        headers.set("cache-control", "no-store, must-revalidate");
        return new Response(normalized.body, { status: normalized.status, headers });
      }
      return normalized;
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
