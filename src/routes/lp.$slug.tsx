// Public renderer for builder landing pages.
// Fully standalone: no storefront chrome, no storefront theme dependency.
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Award, Check, Clock, Gift, Heart, Package, Shield, Sparkles, Star,
  ThumbsUp, Truck, Zap, Loader2, ChevronDown,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPublicLanding, type PublicLandingPage } from "@/lib/landing-public.functions";
import { getLandingPreviewBySlug } from "@/lib/landing-builder.functions";
import { lpImage, type LandingContent, type LandingFormConfig, type LandingTheme } from "@/lib/landing-builder";

export const Route = createFileRoute("/lp/$slug")({
  validateSearch: (search: Record<string, unknown>) => ({
    preview: search["preview"] === "1" || search["preview"] === true ? true : undefined,
  }),
  loaderDeps: ({ search }) => ({ preview: Boolean(search.preview) }),
  loader: async ({ params, deps }) => {
    // In preview mode the page may still be a draft — it is fetched client-side
    // through the owner-authenticated server function instead.
    if (deps.preview) return null;
    const page = await getPublicLanding({ data: { slug: params.slug } });
    if (!page) throw notFound();
    return page;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Unavailable" }, { name: "robots", content: "noindex" }] };
    }
    const title = loaderData.seo?.title || loaderData.title;
    const description =
      loaderData.seo?.description || loaderData.content?.hero?.subheadline || loaderData.title;
    const image = lpImage(loaderData.content?.hero?.image);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "product" },
        { name: "twitter:card", content: "summary_large_image" },
        ...(image.startsWith("https://")
          ? [
              { property: "og:image", content: image },
              { name: "twitter:image", content: image },
            ]
          : []),
      ],
    };
  },
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center p-8 text-center">
      <div>
        <div className="text-2xl font-semibold">Page not found</div>
        <p className="mt-2 text-sm text-neutral-500">This landing page is not available.</p>
      </div>
    </div>
  ),
  component: LandingPageView,
});

const ICONS: Record<string, typeof Check> = {
  check: Check, star: Star, shield: Shield, truck: Truck, zap: Zap, heart: Heart,
  award: Award, clock: Clock, gift: Gift, "thumbs-up": ThumbsUp, package: Package,
  sparkles: Sparkles,
};

function money(n: number) {
  return `৳${Number(n || 0).toLocaleString("en-US")}`;
}

function LandingPageView() {
  const loaded = Route.useLoaderData() as PublicLandingPage | null;
  const { preview } = Route.useSearch();
  const previewFn = useServerFn(getLandingPreviewBySlug);
  const { slug } = Route.useParams();

  const { data: previewPage, isLoading } = useQuery({
    queryKey: ["lp-preview", slug],
    queryFn: () => previewFn({ data: { slug } }) as Promise<PublicLandingPage | null>,
    enabled: Boolean(preview) && !loaded,
    staleTime: 0,
  });

  const page = loaded ?? (previewPage as PublicLandingPage | null);

  if (!page) {
    return (
      <div className="flex min-h-screen items-center justify-center p-8 text-center">
        {isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-neutral-400" />
        ) : (
          <div>
            <div className="text-2xl font-semibold">Page not found</div>
            <p className="mt-2 text-sm text-neutral-500">
              This landing page is not available. Sign in as the store owner to preview drafts.
            </p>
          </div>
        )}
      </div>
    );
  }

  return <LandingPageBody page={page} preview={Boolean(preview)} />;
}

function LandingPageBody({ page, preview }: { page: PublicLandingPage; preview: boolean }) {
  const content = page.content as LandingContent;
  const theme = (page.theme ?? {}) as LandingTheme;
  const form = (page.form_config ?? {}) as LandingFormConfig;

  const style = useMemo(
    () =>
      ({
        "--lp-primary": theme.primary || "#16a34a",
        "--lp-accent": theme.accent || "#f59e0b",
        "--lp-radius": theme.rounded === false ? "0.25rem" : "1rem",
      }) as React.CSSProperties,
    [theme],
  );

  const dark = Boolean(theme.dark);
  const price = content.pricing?.price ?? page.product?.price ?? 0;
  const oldPrice = content.pricing?.oldPrice ?? null;

  return (
    <div
      style={style}
      className={dark ? "min-h-screen bg-neutral-950 text-neutral-100" : "min-h-screen bg-white text-neutral-900"}
    >
      {preview && (
        <div className="bg-amber-500 px-4 py-1.5 text-center text-xs font-semibold text-black">
          Preview mode — only you can see this page until it is published.
        </div>
      )}
      {content.hero?.enabled !== false && (
        <section className="px-4 pb-10 pt-8 sm:pt-14">
          <div className="mx-auto grid max-w-5xl items-center gap-8 md:grid-cols-2">
            <div className="order-2 md:order-1">
              {content.hero?.badge && (
                <span
                  className="inline-block rounded-full px-3 py-1 text-xs font-semibold text-white"
                  style={{ background: "var(--lp-accent)" }}
                >
                  {content.hero.badge}
                </span>
              )}
              <h1 className="mt-3 text-3xl font-extrabold leading-tight sm:text-4xl">
                {content.hero?.headline || page.title}
              </h1>
              {content.hero?.subheadline && (
                <p className="mt-3 text-base opacity-80">{content.hero.subheadline}</p>
              )}
              <div className="mt-5 flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-bold" style={{ color: "var(--lp-primary)" }}>
                  {money(price)}
                </span>
                {oldPrice && oldPrice > price && (
                  <span className="text-lg line-through opacity-50">{money(oldPrice)}</span>
                )}
                {content.pricing?.note && <span className="text-xs opacity-70">{content.pricing.note}</span>}
              </div>
              <a
                href="#order"
                className="mt-6 inline-block px-7 py-3 text-base font-semibold text-white shadow-lg"
                style={{ background: "var(--lp-primary)", borderRadius: "var(--lp-radius)" }}
              >
                {content.hero?.ctaText || "অর্ডার করুন"}
              </a>
            </div>
            <div className="order-1 md:order-2">
              {content.hero?.image && (
                <img
                  src={lpImage(content.hero.image)}
                  alt={content.hero?.headline || page.title}
                  className="w-full object-cover shadow-xl"
                  style={{ borderRadius: "var(--lp-radius)" }}
                  loading="eager"
                />
              )}
            </div>
          </div>
        </section>
      )}

      {content.gallery?.enabled && content.gallery.images?.length > 0 && (
        <Section title={content.gallery.title} dark={dark}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {content.gallery.images.map((img, i) => (
              <img
                key={i}
                src={lpImage(img)}
                alt={`${page.title} ${i + 1}`}
                loading="lazy"
                className="aspect-square w-full object-cover"
                style={{ borderRadius: "var(--lp-radius)" }}
              />
            ))}
          </div>
        </Section>
      )}

      {content.features?.enabled && content.features.items?.length > 0 && (
        <Section title={content.features.title} dark={dark}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {content.features.items.map((f, i) => {
              const Icon = ICONS[f.icon] ?? Check;
              return (
                <div
                  key={i}
                  className={`flex gap-3 p-4 ${dark ? "bg-neutral-900" : "bg-neutral-50"}`}
                  style={{ borderRadius: "var(--lp-radius)" }}
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
                    style={{ background: "var(--lp-primary)" }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="font-semibold">{f.title}</div>
                    {f.text && <div className="mt-1 text-sm opacity-75">{f.text}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {content.benefits?.enabled && content.benefits.items?.length > 0 && (
        <Section title={content.benefits.title} dark={dark}>
          <div className="grid gap-4 sm:grid-cols-2">
            {content.benefits.items.map((b, i) => (
              <div key={i} className="flex gap-3">
                <Check className="mt-1 h-5 w-5 shrink-0" style={{ color: "var(--lp-primary)" }} />
                <div>
                  <div className="font-semibold">{b.title}</div>
                  <div className="text-sm opacity-75">{b.text}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {content.details?.enabled && (content.details.text || content.details.specs?.length > 0) && (
        <Section title={content.details.title} dark={dark}>
          {content.details.text && (
            <p className="whitespace-pre-line text-sm leading-relaxed opacity-85">{content.details.text}</p>
          )}
          {content.details.specs?.length > 0 && (
            <div className="mt-5 overflow-hidden" style={{ borderRadius: "var(--lp-radius)" }}>
              <table className="w-full text-sm">
                <tbody>
                  {content.details.specs.map((s, i) => (
                    <tr key={i} className={i % 2 ? (dark ? "bg-neutral-900" : "bg-neutral-50") : ""}>
                      <td className="w-1/3 p-3 font-medium">{s.label}</td>
                      <td className="p-3 opacity-80">{s.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {content.reviews?.enabled && content.reviews.items?.length > 0 && (
        <Section title={content.reviews.title} dark={dark}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {content.reviews.items.map((r, i) => (
              <div
                key={i}
                className={`p-4 ${dark ? "bg-neutral-900" : "bg-neutral-50"}`}
                style={{ borderRadius: "var(--lp-radius)" }}
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, s) => (
                    <Star
                      key={s}
                      className="h-4 w-4"
                      style={{ color: s < (r.rating || 5) ? "var(--lp-accent)" : "#d4d4d4" }}
                      fill={s < (r.rating || 5) ? "currentColor" : "none"}
                    />
                  ))}
                </div>
                <p className="mt-2 text-sm opacity-85">{r.text}</p>
                <div className="mt-2 text-xs font-semibold opacity-70">— {r.name}</div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {content.faq?.enabled && content.faq.items?.length > 0 && (
        <Section title={content.faq.title} dark={dark}>
          <div className="space-y-2">
            {content.faq.items.map((f, i) => (
              <details
                key={i}
                className={`group p-4 ${dark ? "bg-neutral-900" : "bg-neutral-50"}`}
                style={{ borderRadius: "var(--lp-radius)" }}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                  {f.q}
                  <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
                </summary>
                <p className="mt-2 text-sm opacity-80">{f.a}</p>
              </details>
            ))}
          </div>
        </Section>
      )}

      {content.cta?.enabled && (
        <section className="px-4 py-10">
          <div
            className="mx-auto max-w-5xl p-8 text-center text-white"
            style={{ background: "var(--lp-primary)", borderRadius: "var(--lp-radius)" }}
          >
            <h2 className="text-2xl font-bold">{content.cta.headline}</h2>
            {content.cta.text && <p className="mt-2 opacity-90">{content.cta.text}</p>}
            <a
              href="#order"
              className="mt-5 inline-block bg-white px-7 py-3 font-semibold"
              style={{ color: "var(--lp-primary)", borderRadius: "var(--lp-radius)" }}
            >
              {content.cta.buttonText}
            </a>
          </div>
        </section>
      )}

      {content.order?.enabled !== false && (
        <OrderForm page={page} content={content} form={form} dark={dark} price={price} />
      )}

      {content.contact?.enabled &&
        (content.contact.phone || content.contact.email || content.contact.address) && (
          <Section title={content.contact.title} dark={dark}>
            <div className="grid gap-2 text-sm opacity-85 sm:grid-cols-2">
              {content.contact.phone && <div>📞 {content.contact.phone}</div>}
              {content.contact.email && <div>✉️ {content.contact.email}</div>}
              {content.contact.address && <div>📍 {content.contact.address}</div>}
              {content.contact.hours && <div>🕒 {content.contact.hours}</div>}
            </div>
          </Section>
        )}

      {content.footer?.enabled !== false && (
        <footer className={`px-4 py-8 text-center text-xs opacity-60 ${dark ? "bg-neutral-900" : "bg-neutral-50"}`}>
          {content.footer?.text || `© ${new Date().getFullYear()} ${page.store?.name ?? ""}`}
        </footer>
      )}
    </div>
  );
}

function Section({ title, dark, children }: { title?: string; dark: boolean; children: React.ReactNode }) {
  return (
    <section className={`px-4 py-10 ${dark ? "" : ""}`}>
      <div className="mx-auto max-w-5xl">
        {title && <h2 className="mb-5 text-center text-2xl font-bold">{title}</h2>}
        {children}
      </div>
    </section>
  );
}

function OrderForm({
  page,
  content,
  form,
  dark,
  price,
}: {
  page: PublicLandingPage;
  content: LandingContent;
  form: LandingFormConfig;
  dark: boolean;
  price: number;
}) {
  const fields = (form.fields ?? []).filter((f) => f.enabled);
  const methods = form.paymentMethods?.length ? form.paymentMethods : ["cod"];
  const delivery = Number(form.deliveryCharge ?? 0);

  const [values, setValues] = useState<Record<string, string>>({ quantity: "1" });
  const [method, setMethod] = useState(methods[0]!);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ invoice: string | null } | null>(null);

  const qty = Math.max(1, Number(values["quantity"] || 1));
  const total = price * qty + delivery;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/public/lp/order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          landing_page_id: page.id,
          customer_name: values["customer_name"] ?? "",
          phone: values["phone"] ?? "",
          address: values["address"] ?? "",
          area: values["area"] ?? null,
          email: values["email"] || null,
          note: values["note"] || null,
          quantity: qty,
          payment_method: method,
          txn_id: values["txn_id"] || null,
          page_url: typeof window !== "undefined" ? window.location.href : null,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string; invoice_no?: string | null };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Order failed");
      setDone({ invoice: json.invoice_no ?? null });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const inputClass = `w-full border px-3 py-2 text-sm outline-none ${
    dark ? "border-neutral-700 bg-neutral-900" : "border-neutral-300 bg-white"
  }`;

  return (
    <section id="order" className="px-4 py-10">
      <div
        className={`mx-auto max-w-xl p-5 shadow-lg sm:p-7 ${dark ? "bg-neutral-900" : "bg-white ring-1 ring-neutral-200"}`}
        style={{ borderRadius: "var(--lp-radius)" }}
      >
        <h2 className="text-xl font-bold">{content.order?.title || "অর্ডার ফরম"}</h2>
        {content.order?.note && <p className="mt-1 text-sm opacity-70">{content.order.note}</p>}

        {done ? (
          <div className="mt-6 text-center">
            <div
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-white"
              style={{ background: "var(--lp-primary)" }}
            >
              <Check className="h-7 w-7" />
            </div>
            <p className="mt-4 text-sm">{content.order?.successMessage || "ধন্যবাদ! অর্ডার গ্রহণ করা হয়েছে।"}</p>
            {done.invoice && <p className="mt-1 text-xs opacity-70">Invoice: {done.invoice}</p>}
          </div>
        ) : (
          <form className="mt-5 space-y-3" onSubmit={submit}>
            {fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium opacity-80">
                  {f.label}
                  {f.required && <span className="text-red-500"> *</span>}
                </label>
                {f.key === "address" || f.key === "note" ? (
                  <textarea
                    className={inputClass}
                    style={{ borderRadius: "calc(var(--lp-radius) / 2)" }}
                    rows={2}
                    required={f.required}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                ) : (
                  <input
                    className={inputClass}
                    style={{ borderRadius: "calc(var(--lp-radius) / 2)" }}
                    type={f.key === "quantity" ? "number" : f.key === "email" ? "email" : "text"}
                    min={f.key === "quantity" ? 1 : undefined}
                    required={f.required}
                    value={values[f.key] ?? (f.key === "quantity" ? "1" : "")}
                    onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}

            {methods.length > 1 && (
              <div>
                <label className="mb-1 block text-xs font-medium opacity-80">পেমেন্ট মেথড</label>
                <div className="flex flex-wrap gap-2">
                  {methods.map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setMethod(m)}
                      className={`border px-3 py-1.5 text-xs uppercase ${
                        method === m ? "text-white" : dark ? "border-neutral-700" : "border-neutral-300"
                      }`}
                      style={{
                        background: method === m ? "var(--lp-primary)" : "transparent",
                        borderRadius: "calc(var(--lp-radius) / 2)",
                      }}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {method !== "cod" && (
              <div>
                <label className="mb-1 block text-xs font-medium opacity-80">ট্রানজেকশন আইডি</label>
                <input
                  className={inputClass}
                  style={{ borderRadius: "calc(var(--lp-radius) / 2)" }}
                  value={values["txn_id"] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, txn_id: e.target.value }))}
                />
              </div>
            )}

            <div
              className={`space-y-1 p-3 text-sm ${dark ? "bg-neutral-950" : "bg-neutral-50"}`}
              style={{ borderRadius: "calc(var(--lp-radius) / 2)" }}
            >
              <Row label={`প্রোডাক্ট (${qty})`} value={money(price * qty)} />
              <Row label="ডেলিভারি চার্জ" value={money(delivery)} />
              <div className="flex justify-between border-t pt-1 font-bold">
                <span>সর্বমোট</span>
                <span style={{ color: "var(--lp-primary)" }}>{money(total)}</span>
              </div>
            </div>

            {error && <div className="text-sm text-red-500">{error}</div>}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 py-3 font-semibold text-white disabled:opacity-60"
              style={{ background: "var(--lp-primary)", borderRadius: "var(--lp-radius)" }}
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {form.buttonText || "অর্ডার কনফার্ম করুন"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="opacity-70">{label}</span>
      <span>{value}</span>
    </div>
  );
}
