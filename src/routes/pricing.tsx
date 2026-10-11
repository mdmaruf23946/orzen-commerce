import { createFileRoute, Link } from "@tanstack/react-router";
import { listPublicPlans } from "@/lib/billing.functions";
import { getPlatformSeoOverrides } from "@/lib/platform-seo-pages.functions";
import { effectiveSeo } from "@/lib/platform-seo-pages";
import { platformHead, ORG_NODE, WEBSITE_NODE, softwareAppNode, faqNode } from "@/lib/platform-seo";
import { PlatformFaq } from "@/components/platform/PlatformFaq";

const TITLE = "Pricing — ORZEN eCommerce Plans";
const DESC =
  "Simple monthly plans for your online store on ORZEN. Compare packages, product limits and AI features, and start selling today.";

export const Route = createFileRoute("/pricing")({
  loader: async () => {
    try {
      const [plans, seo] = await Promise.all([listPublicPlans(), getPlatformSeoOverrides().catch(() => ({}))]);
      return { plans: plans as any[], seo };
    } catch {
      return { plans: [] as any[], seo: {} };
    }
  },
  head: ({ loaderData }) =>
    platformHead({
      path: "/pricing",
      ...effectiveSeo("pricing", (loaderData as any)?.seo),
      jsonLd: [ORG_NODE, WEBSITE_NODE, softwareAppNode(loaderData?.plans ?? []), faqNode("/pricing")],
    }),
  component: PricingPage,
});

function PricingPage() {
  const { plans } = Route.useLoaderData();
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight">ORZEN pricing</h1>
        <p className="mt-4 text-lg text-muted-foreground">Choose the package that fits your store.</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((p: any) => (
            <article key={p.id} className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-xl font-semibold">{p.name}</h2>
              <p className="mt-2 text-3xl font-bold">
                ৳{Number(p.price).toLocaleString()}
                <span className="text-base font-normal text-muted-foreground">
                  {" "}/ {p.duration_days ?? 30} days
                </span>
              </p>
              {p.description && <p className="mt-3 text-sm text-muted-foreground">{p.description}</p>}
              <ul className="mt-4 space-y-1 text-sm">
                {p.product_limit != null && <li>Products: {p.product_limit}</li>}
                {p.order_limit != null && <li>Orders: {p.order_limit}</li>}
                {p.staff_limit != null && <li>Staff: {p.staff_limit}</li>}
              </ul>
            </article>
          ))}
        </div>
        <div className="mt-10 flex gap-3">
          <Link to="/features" className="rounded-lg border border-border px-5 py-3 font-medium">
            All features
          </Link>
          <Link to="/" className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground">
            Get started
          </Link>
        </div>
      </section>
    </main>
  );
}
