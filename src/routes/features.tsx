import { createFileRoute, Link } from "@tanstack/react-router";
import { PLAN_DISPLAY_FEATURES } from "@/lib/features";
import { getPlatformSeoOverrides } from "@/lib/platform-seo-pages.functions";
import { effectiveSeo } from "@/lib/platform-seo-pages";
import { platformHead, ORG_NODE, WEBSITE_NODE, softwareAppNode, faqNode } from "@/lib/platform-seo";
import { PlatformFaq } from "@/components/platform/PlatformFaq";

const TITLE = "Features — ORZEN AI eCommerce Platform";
const DESC =
  "AI sales agent, Messenger & WhatsApp automation, AI call center, landing pages, courier, fraud checker, custom domain and analytics — all in ORZEN.";

export const Route = createFileRoute("/features")({
  loader: async () => ({ seo: await getPlatformSeoOverrides().catch(() => ({})) }),
  head: ({ loaderData }) =>
    platformHead({ path: "/features", ...effectiveSeo("features", loaderData?.seo), jsonLd: [ORG_NODE, WEBSITE_NODE, softwareAppNode(), faqNode("/features")] }),
  component: FeaturesPage,
});

function FeaturesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h1 className="text-4xl font-bold tracking-tight">ORZEN features</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Everything you need to run and grow an online store — with AI that sells, replies and
          follows up for you.
        </p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {PLAN_DISPLAY_FEATURES.map((f) => (
            <li key={f.key} className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold">{f.label}</h2>
            </li>
          ))}
        </ul>
        <div className="mt-10 flex gap-3">
          <Link to="/pricing" className="rounded-lg bg-primary px-5 py-3 font-medium text-primary-foreground">
            See pricing
          </Link>
          <Link to="/" className="rounded-lg border border-border px-5 py-3 font-medium">
            Home
          </Link>
        </div>
      </section>
      <PlatformFaq />
    </main>
  );
}
