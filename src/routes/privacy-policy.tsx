import { createFileRoute } from "@tanstack/react-router";
import { PLATFORM_OG_IMAGE } from "@/lib/platform-seo";
import { getLegalPagePublic } from "@/lib/legal.functions";
import { LegalPage, LegalPageMissing } from "@/components/storefront/LegalPage";

const PAGE_KEY = "privacy";
const PAGE_PATH = "/privacy-policy";
const DEFAULT_TITLE = "Privacy Policy";

export const Route = createFileRoute("/privacy-policy")({
  loader: () => getLegalPagePublic({ data: { page: PAGE_KEY } }),
  head: ({ loaderData }) => {
    const d: any = loaderData ?? {};
    const p = d.page;
    const store = d.store;
    const title = p?.title || `${DEFAULT_TITLE}${store?.name ? ` — ${store.name}` : ""}`;
    const description = p?.description || `${DEFAULT_TITLE} for ${store?.name || "our store"}.`;
    const canonical = d.origin ? `${d.origin}${PAGE_PATH}` : undefined;
    const meta: any[] = [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { property: "og:image", content: PLATFORM_OG_IMAGE },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: PLATFORM_OG_IMAGE },
    ];
    if (canonical) meta.push({ property: "og:url", content: canonical });
    const links: any[] = canonical ? [{ rel: "canonical", href: canonical }] : [];
    return { meta, links };
  },
  component: Page,
});

function Page() {
  const d = Route.useLoaderData() as any;
  const disclosure = !d?.store ? <MetaDisclosure /> : null;
  if (!d?.page) return (<><LegalPageMissing title={DEFAULT_TITLE} />{disclosure}</>);
  return (
    <>
      <LegalPage
        title={d.page.title}
        html={d.page.html}
        storeName={d.store?.name}
        updatedAt={d.page.updated_at}
      />
      {disclosure}
    </>
  );
}

/** ORZEN main website only: what Meta receives and how to opt out. */
function MetaDisclosure() {
  return (
    <section className="mx-auto max-w-3xl px-4 pb-12 text-sm text-muted-foreground">
      <h2 className="mb-2 text-base font-semibold text-foreground">Advertising measurement (Meta)</h2>
      <p>
        The ORZEN website uses the Meta Pixel and Meta Conversions API to measure our ads and improve ad delivery.
        When allowed, we share with Meta (Meta Platforms Ireland Ltd.): pages you visit, sign-up, store creation,
        trial start, checkout and verified payments (plan and amount), your browser, IP address, Meta cookies
        (_fbp/_fbc), your account id and a hashed (one-way encrypted) email. Visitors from the EU/EEA, UK and
        Switzerland are tracked only after they click “Accept”; you can change or withdraw your choice any time with
        the “Cookie settings” button, and we keep a record of each choice. Merchant stores hosted on ORZEN run their
        own, separate tracking under their own policies.
      </p>
    </section>
  );
}
