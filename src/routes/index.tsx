import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ShoppingBag, Smartphone, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ShopFlow — Launch your mobile-first online store in minutes" },
      {
        name: "description",
        content:
          "ShopFlow is a lightweight multi-store SaaS platform. Get your own admin panel, storefront, and checkout — no setup needed.",
      },
      { property: "og:title", content: "ShopFlow — Mobile-first SaaS e-commerce" },
      {
        property: "og:description",
        content: "One subscription. Your own store. Built for speed and conversion.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link to="/" className="text-lg font-bold tracking-tight">
          ShopFlow
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            Sign in
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5">
        <section className="py-16 sm:py-24">
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            Launch your online store.
            <br />
            <span className="text-muted-foreground">Mobile-first, blazing fast.</span>
          </h1>
          <p className="mt-6 max-w-xl text-base text-muted-foreground sm:text-lg">
            ShopFlow gives every subscriber their own admin panel and storefront. Add products, accept
            orders, get paid. No setup, no plugins, no slowdowns.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Start your store <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-3">
          {[
            {
              icon: Smartphone,
              title: "Mobile-first",
              body: "Designed for the 80% of customers shopping on a phone.",
            },
            { icon: Zap, title: "Lightning fast", body: "Optimized payloads, lazy images, instant pages." },
            {
              icon: ShoppingBag,
              title: "Conversion-focused",
              body: "Frictionless checkout in under a minute.",
            },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t">
        <div className="mx-auto max-w-6xl px-5 py-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} ShopFlow
        </div>
      </footer>
    </div>
  );
}
