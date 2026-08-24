import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import {
  clearChunkRecoveryFlag,
  installChunkRecovery,
  recoverFromChunkError,
} from "../lib/chunk-recovery";
import { Toaster } from "@/components/ui/sonner";
import { usePlatformBranding } from "@/lib/platform-branding";
import { PlatformInstallPrompt } from "@/components/PlatformInstallPrompt";



function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const [recovering] = useState(() => recoverFromChunkError(error));
  useEffect(() => {
    if (recovering) return;
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error, recovering]);

  if (recovering) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Updating to the latest version…</p>
      </div>
    );
  }


  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ORZEN — Create Your Online Store in Minutes" },
      {
        name: "description",
        content:
          "Launch, run, and grow your online store with ORZEN — an all-in-one platform for store building, AI sales assistance, messenger automation, courier delivery, analytics, and secure payments.",
      },
      { name: "author", content: "ORZEN" },
      { property: "og:title", content: "ORZEN — Launch your online store in minutes" },
      {
        property: "og:description",
        content:
          "Everything you need to launch and grow your eCommerce business — store, AI agent, couriers, analytics — in one platform.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@orzen" },
      { property: "og:site_name", content: "ORZEN" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function PlatformFavicon() {
  const { data } = usePlatformBranding();
  const pathname = useRouterState({
    select: (st): string => st.location.pathname,
  });
  const isTenant = pathname.startsWith("/store/") || pathname.startsWith("/lp/");
  useEffect(() => {
    if (typeof document === "undefined") return;
    // Storefronts/landing pages own their favicon (see StoreBranding).
    if (isTenant) return;
    const favicon = data?.assets?.favicon?.url;
    const apple = data?.assets?.appIcon192?.url ?? favicon;
    if (favicon) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = favicon;
    }
    if (apple) {
      let link = document.querySelector<HTMLLinkElement>("link[rel='apple-touch-icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "apple-touch-icon";
        document.head.appendChild(link);
      }
      link.href = apple;
    }
  }, [data]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useEffect(() => {
    // App rendered fine: arm chunk recovery and reset the one-shot guard.
    installChunkRecovery();
    clearChunkRecoveryFlag();
  }, []);
  useEffect(() => {
    let mounted = true;

    import("@/integrations/supabase/client").then(({ supabase }) => {
      const { data: sub } = supabase.auth.onAuthStateChange((event) => {
        if (!mounted) return;
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      });
      return () => sub.subscription.unsubscribe();
    });
    return () => {
      mounted = false;
    };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <PlatformFavicon />
      <PlatformInstallPrompt />
      <Outlet />
      <Toaster richColors position="top-center" />
    </QueryClientProvider>
  );
}

