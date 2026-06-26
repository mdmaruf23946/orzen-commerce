import { createFileRoute, Link, Outlet, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ShoppingCart, Phone, MessageCircle, Facebook } from "lucide-react";
import { getStoreBySlug } from "@/lib/storefront.functions";
import { cartCount } from "@/lib/cart";

const storeQuery = (slug: string) =>
  queryOptions({
    queryKey: ["store", slug],
    queryFn: () => getStoreBySlug({ data: { slug } }),
  });

export const Route = createFileRoute("/store/$slug")({
  loader: async ({ context, params }) => {
    const store = await context.queryClient.ensureQueryData(storeQuery(params.slug));
    if (!store) throw notFound();
    return { store };
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: loaderData.store.name },
            { name: "description", content: loaderData.store.description ?? loaderData.store.name },
            { property: "og:title", content: loaderData.store.name },
            { property: "og:description", content: loaderData.store.description ?? loaderData.store.name },
          ],
        }
      : {},
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center p-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold">Store not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">This store doesn't exist or is unavailable.</p>
      </div>
    </div>
  ),
  errorComponent: () => (
    <div className="flex min-h-screen items-center justify-center p-6">Something went wrong.</div>
  ),
  component: StoreLayout,
});

function StoreLayout() {
  const { slug } = Route.useParams();
  const { data: store } = useSuspenseQuery(storeQuery(slug));
  if (!store) return null;

  return (
    <div
      className="min-h-screen bg-background"
      style={{ ["--primary" as string]: store.primary_color } as React.CSSProperties}
    >
      <StoreHeader slug={slug} name={store.name} logoUrl={store.logo_url} />
      <main className="mx-auto max-w-5xl px-4 pb-12 pt-4 sm:px-6">
        <Outlet />
      </main>
      <StoreFooter store={store} />
    </div>
  );
}

function StoreHeader({
  slug,
  name,
  logoUrl,
}: {
  slug: string;
  name: string;
  logoUrl: string | null;
}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const update = () => setCount(cartCount(slug));
    update();
    window.addEventListener("cart-changed", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("cart-changed", update);
      window.removeEventListener("storage", update);
    };
  }, [slug]);

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link
          to="/store/$slug"
          params={{ slug }}
          className="flex min-w-0 items-center gap-2"
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" loading="eager" />
          ) : (
            <div
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold text-primary-foreground"
              style={{ backgroundColor: "var(--primary)" }}
            >
              {name.charAt(0)}
            </div>
          )}
          <span className="truncate text-sm font-semibold sm:text-base">{name}</span>
        </Link>
        <Link
          to="/store/$slug/cart"
          params={{ slug }}
          className="relative flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted"
          aria-label="Cart"
        >
          <ShoppingCart className="h-5 w-5" />
          {count > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold text-primary-foreground"
              style={{ backgroundColor: "var(--primary)" }}
            >
              {count}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

function StoreFooter({
  store,
}: {
  store: { name: string; phone: string | null; whatsapp: string | null; facebook: string | null };
}) {
  return (
    <footer className="mt-8 border-t bg-muted/30">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {store.phone && (
            <a href={`tel:${store.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground">
              <Phone className="h-4 w-4" /> {store.phone}
            </a>
          )}
          {store.whatsapp && (
            <a
              href={`https://wa.me/${store.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          )}
          {store.facebook && (
            <a
              href={store.facebook}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-foreground"
            >
              <Facebook className="h-4 w-4" /> Facebook
            </a>
          )}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          © {new Date().getFullYear()} {store.name}. Powered by ShopFlow.
        </p>
      </div>
    </footer>
  );
}
