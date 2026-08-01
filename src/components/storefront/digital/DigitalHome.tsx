import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Sparkles,
  Flame,
  Rocket,
  RefreshCw,
  Gift,
  Package,
  Search,
  ShieldCheck,
  Zap,
  Download,
  ChevronRight,
  Mail,
  Plus,
  Minus,
} from "lucide-react";
import { listDigitalCategories } from "@/lib/storefront.functions";
import { DigitalProductCard, type DigitalProduct } from "./DigitalProductCard";

type P = DigitalProduct & {
  is_featured?: boolean | null;
  created_at?: string | null;
  status?: string;
  product_type?: string | null;
};

type SortKey = "latest" | "best" | "updated" | "price-asc" | "price-desc";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "latest", label: "Latest" },
  { key: "best", label: "Best selling" },
  { key: "updated", label: "Recently updated" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
];

const FAQS = [
  {
    q: "How do I receive my files?",
    a: "Right after payment your download unlocks instantly. You will also get an email with the link, and everything stays available in My Downloads.",
  },
  {
    q: "Do I get future updates?",
    a: "Yes. When a seller ships a new version you can re-download the latest files from your account at no extra cost, as long as your access is active.",
  },
  {
    q: "What about license keys?",
    a: "Products that need activation deliver the key together with the download, visible in My Downloads and in your purchase email.",
  },
  {
    q: "Can I get a refund?",
    a: "Digital goods are delivered instantly, so refunds are handled case by case — contact the store if a file is broken or not as described.",
  },
];

/** Full digital-marketplace homepage. Rendered when the store is in digital mode. */
export function DigitalHome({
  slug,
  storeId,
  storeName,
  products,
  bestSelling,
  query,
}: {
  slug: string;
  storeId: string;
  storeName: string;
  products: P[];
  bestSelling: P[];
  query: string;
}) {
  const [category, setCategory] = useState<string | null>(null);
  const [priceMode, setPriceMode] = useState<"all" | "free" | "premium">("all");
  const [sort, setSort] = useState<SortKey>("latest");
  const [pageSize, setPageSize] = useState(12);

  const catsQ = useQuery({
    queryKey: ["digital-categories", storeId],
    queryFn: () => listDigitalCategories({ data: { storeId } }),
    staleTime: 10 * 60_000,
  });
  const cats = catsQ.data ?? [];
  const catLabel = useMemo(() => new Map(cats.map((c) => [c.key, c.name])), [cats]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) {
      const k = p.digital_category ?? null;
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [products]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = products.filter((p) => {
      if (category && p.digital_category !== category) return false;
      const price = Number(p.price);
      if (priceMode === "free" && price > 0) return false;
      if (priceMode === "premium" && price <= 0) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      switch (sort) {
        case "best":
          return (b.total_sold ?? 0) - (a.total_sold ?? 0);
        case "updated":
          return (
            new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()
          );
        case "price-asc":
          return Number(a.price) - Number(b.price);
        case "price-desc":
          return Number(b.price) - Number(a.price);
        default:
          return (
            new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
          );
      }
    });
    return list;
  }, [products, category, priceMode, sort, query]);

  const featured = useMemo(() => products.filter((p) => p.is_featured).slice(0, 8), [products]);
  const newReleases = useMemo(
    () =>
      [...products]
        .sort(
          (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
        )
        .slice(0, 8),
    [products],
  );
  const trending = useMemo(
    () => [...products].sort((a, b) => (b.total_sold ?? 0) - (a.total_sold ?? 0)).slice(0, 8),
    [products],
  );
  const recentlyUpdated = useMemo(
    () =>
      [...products]
        .filter((p) => p.updated_at && p.created_at && p.updated_at !== p.created_at)
        .sort(
          (a, b) => new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime(),
        )
        .slice(0, 8),
    [products],
  );
  const freebies = useMemo(
    () => products.filter((p) => Number(p.price) <= 0).slice(0, 8),
    [products],
  );
  const bundles = useMemo(
    () =>
      products
        .filter((p) => /bundle|pack|kit|collection/i.test(p.name))
        .slice(0, 8),
    [products],
  );

  const totalDownloads = useMemo(
    () => products.reduce((n, p) => n + (p.total_sold ?? 0), 0),
    [products],
  );

  const isFiltering =
    !!category || priceMode !== "all" || query.trim().length > 0 || sort !== "latest";

  return (
    <div className="dg -mx-4 -mt-4 bg-[#0a0b10] px-4 pb-16 pt-4 text-white sm:-mx-6 sm:px-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-600/25 via-[#0f1018] to-fuchsia-600/15 p-6 sm:p-10">
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(99,102,241,.45), transparent 70%)" }}
        />
        <div className="relative max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/70">
            <Sparkles className="h-3 w-3" /> Instant digital delivery
          </span>
          <h1 className="mt-4 text-2xl font-bold leading-tight tracking-tight sm:text-4xl">
            Premium digital assets from {storeName}
          </h1>
          <p className="mt-3 text-sm text-white/60 sm:text-base">
            Templates, source code, ebooks, courses and more — download the moment you pay. No
            shipping, no waiting.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <a
              href="#browse"
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25"
            >
              <Search className="h-4 w-4" /> Browse products
            </a>
            <button
              type="button"
              onClick={() => {
                setPriceMode("free");
                document.getElementById("browse")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold text-white/85 hover:bg-white/5"
            >
              <Gift className="h-4 w-4" /> Free resources
            </button>
          </div>
          <div className="mt-7 grid max-w-md grid-cols-3 gap-3 text-center">
            <Stat label="Products" value={products.length} />
            <Stat label="Downloads" value={totalDownloads} />
            <Stat label="Categories" value={counts.size} />
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Perk icon={<Zap className="h-4 w-4" />} title="Instant access" />
        <Perk icon={<Download className="h-4 w-4" />} title="Lifetime re-downloads" />
        <Perk icon={<RefreshCw className="h-4 w-4" />} title="Free updates" />
        <Perk icon={<ShieldCheck className="h-4 w-4" />} title="Secure checkout" />
      </div>

      {/* Categories */}
      {cats.length > 0 && (
        <section className="mt-10">
          <Head title="Popular categories" icon={<Package className="h-4 w-4 text-indigo-400" />} />
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
            {cats.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  setCategory(category === c.key ? null : c.key);
                  document.getElementById("browse")?.scrollIntoView({ behavior: "smooth" });
                }}
                className={`rounded-2xl border p-3 text-left transition-colors ${
                  category === c.key
                    ? "border-indigo-400/60 bg-indigo-500/15"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <div className="text-[13px] font-semibold text-white/90">{c.name}</div>
                <div className="mt-0.5 text-[11px] text-white/40">
                  {counts.get(c.key) ?? 0} items
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {!isFiltering && (
        <>
          <Rail slug={slug} title="Featured" icon={<Sparkles className="h-4 w-4 text-amber-400" />} items={featured} catLabel={catLabel} />
          <Rail slug={slug} title="Best selling" icon={<Flame className="h-4 w-4 text-rose-400" />} items={bestSelling.length ? bestSelling : trending} catLabel={catLabel} />
          <Rail slug={slug} title="New releases" icon={<Rocket className="h-4 w-4 text-sky-400" />} items={newReleases} catLabel={catLabel} />
          <Rail slug={slug} title="Trending now" icon={<Flame className="h-4 w-4 text-orange-400" />} items={trending} catLabel={catLabel} />
          <Rail slug={slug} title="Recently updated" icon={<RefreshCw className="h-4 w-4 text-emerald-400" />} items={recentlyUpdated} catLabel={catLabel} />
          <Rail slug={slug} title="Free resources" icon={<Gift className="h-4 w-4 text-emerald-400" />} items={freebies} catLabel={catLabel} />
          <Rail slug={slug} title="Bundle deals" icon={<Package className="h-4 w-4 text-fuchsia-400" />} items={bundles} catLabel={catLabel} />
        </>
      )}

      {/* Browse + filters */}
      <section id="browse" className="mt-12 scroll-mt-28">
        <Head title="Browse all products" icon={<Search className="h-4 w-4 text-indigo-400" />} />
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Chip active={priceMode === "all"} onClick={() => setPriceMode("all")}>
            All
          </Chip>
          <Chip active={priceMode === "free"} onClick={() => setPriceMode("free")}>
            Free
          </Chip>
          <Chip active={priceMode === "premium"} onClick={() => setPriceMode("premium")}>
            Premium
          </Chip>
          <span className="mx-1 h-5 w-px bg-white/10" />
          {cats.length > 0 && (
            <select
              value={category ?? ""}
              onChange={(e) => setCategory(e.target.value || null)}
              className="h-8 rounded-full border border-white/15 bg-white/[0.04] px-3 text-xs text-white/80 outline-none"
            >
              <option value="">All categories</option>
              {cats.map((c) => (
                <option key={c.key} value={c.key} className="bg-[#12131a]">
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="h-8 rounded-full border border-white/15 bg-white/[0.04] px-3 text-xs text-white/80 outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.key} value={s.key} className="bg-[#12131a]">
                {s.label}
              </option>
            ))}
          </select>
          <span className="ml-auto text-xs text-white/40">{filtered.length} results</span>
        </div>

        {filtered.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-white/15 p-10 text-center text-sm text-white/50">
            Nothing matches these filters yet.
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {filtered.slice(0, pageSize).map((p) => (
                <DigitalProductCard
                  key={p.id}
                  slug={slug}
                  p={p}
                  categoryLabel={p.digital_category ? catLabel.get(p.digital_category) : null}
                />
              ))}
            </div>
            {filtered.length > pageSize && (
              <div className="mt-6 flex justify-center">
                <button
                  type="button"
                  onClick={() => setPageSize((n) => n + 12)}
                  className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-semibold text-white/85 hover:bg-white/5"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Reviews */}
      <section className="mt-14">
        <Head title="What buyers say" icon={<Sparkles className="h-4 w-4 text-amber-400" />} />
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { n: "Rafi H.", t: "Downloaded in seconds and the files were exactly as described." },
            { n: "Nabila K.", t: "Great value — the update came through free a month later." },
            { n: "Imran S.", t: "License key arrived instantly with the download email." },
          ].map((r) => (
            <div key={r.n} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex gap-0.5 text-amber-400">{"★★★★★"}</div>
              <p className="mt-2 text-sm text-white/70">{r.t}</p>
              <div className="mt-3 text-[11px] font-medium text-white/40">{r.n}</div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mt-14">
        <Head title="Frequently asked" icon={<ShieldCheck className="h-4 w-4 text-emerald-400" />} />
        <div className="mt-4 divide-y divide-white/10 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          {FAQS.map((f) => (
            <Faq key={f.q} q={f.q} a={f.a} />
          ))}
        </div>
      </section>

      {/* Newsletter */}
      <section className="mt-14 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-r from-indigo-600/20 to-fuchsia-600/10 p-6 text-center sm:p-10">
        <Mail className="mx-auto h-6 w-6 text-indigo-300" />
        <h3 className="mt-3 text-lg font-bold sm:text-xl">New drops, straight to your inbox</h3>
        <p className="mt-1.5 text-sm text-white/55">
          Be first to know about new releases, updates and free resources.
        </p>
        <form
          className="mx-auto mt-5 flex max-w-md gap-2"
          onSubmit={(e) => e.preventDefault()}
        >
          <input
            type="email"
            required
            placeholder="you@email.com"
            className="h-11 flex-1 rounded-xl border border-white/15 bg-black/30 px-4 text-sm text-white placeholder:text-white/30 outline-none focus:border-indigo-400"
          />
          <button className="h-11 rounded-xl bg-indigo-500 px-5 text-sm font-semibold">
            Subscribe
          </button>
        </form>
      </section>

      <div className="mt-10 text-center">
        <Link
          to="/store/$slug/account"
          params={{ slug }}
          className="inline-flex items-center gap-1 text-sm text-white/50 hover:text-white"
        >
          Go to My Downloads <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] py-2.5">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-white/40">{label}</div>
    </div>
  );
}

function Perk({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-[12px] font-medium text-white/70">
      <span className="text-indigo-400">{icon}</span>
      {title}
    </div>
  );
}

function Head({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <h2 className="text-lg font-bold tracking-tight sm:text-xl">{title}</h2>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 rounded-full px-4 text-xs font-semibold transition-colors ${
        active
          ? "bg-indigo-500 text-white"
          : "border border-white/15 text-white/70 hover:bg-white/5"
      }`}
    >
      {children}
    </button>
  );
}

function Rail({
  slug,
  title,
  icon,
  items,
  catLabel,
}: {
  slug: string;
  title: string;
  icon: React.ReactNode;
  items: P[];
  catLabel: Map<string, string>;
}) {
  if (items.length === 0) return null;
  return (
    <section className="mt-12">
      <Head title={title} icon={icon} />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((p) => (
          <DigitalProductCard
            key={p.id}
            slug={slug}
            p={p}
            categoryLabel={p.digital_category ? catLabel.get(p.digital_category) : null}
          />
        ))}
      </div>
    </section>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      className="flex w-full items-start gap-3 px-4 py-4 text-left"
    >
      <span className="mt-0.5 text-indigo-400">
        {open ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold text-white/90">{q}</span>
        {open && <span className="mt-1.5 block text-sm text-white/55">{a}</span>}
      </span>
    </button>
  );
}
