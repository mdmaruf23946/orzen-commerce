import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { queryOptions } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { getStoreBySlug, listStoreCategories } from "@/lib/storefront.functions";
import { CategoryIconCluster } from "@/components/CategoryIconCluster";
import { getCategoryIcon } from "@/lib/category-icons";
import { useStoreUI } from "@/lib/store-ui";
import { useStoreT } from "@/lib/store-i18n";
import { StoreErrorState } from "@/components/storefront/StoreErrorState";

const stable = {
  staleTime: 5 * 60_000,
  gcTime: 30 * 60_000,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
} as const;

const storeQuery = (slug: string) =>
  queryOptions({
    queryKey: ["store", slug],
    queryFn: () => getStoreBySlug({ data: { slug } }),
    ...stable,
  });

const categoriesQuery = (storeId: string) =>
  queryOptions({
    queryKey: ["categories", storeId],
    queryFn: () => listStoreCategories({ data: { storeId } }),
    ...stable,
  });

export const Route = createFileRoute("/store/$slug/categories")({
  head: () => ({
    meta: [
      { title: "All Categories — Browse the full catalog" },
      {
        name: "description",
        content:
          "Browse every product category in this store, with sub-categories, in one clean grid.",
      },
      { property: "og:title", content: "All Categories — Browse the full catalog" },
      {
        property: "og:description",
        content: "Browse every product category in this store, with sub-categories, in one clean grid.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  loader: async ({ context, params }) => {
    const store = await context.queryClient.ensureQueryData(storeQuery(params.slug));
    if (!store) return null;
    const categories = await context.queryClient.ensureQueryData(categoriesQuery(store.id));
    return { categories };
  },
  errorComponent: ({ error }) => <StoreErrorState error={error} scope="storefront:categories" />,
  component: CategoriesPage,
});

function CategoriesPage() {
  const data = Route.useLoaderData();
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const { t } = useStoreT();
  const { selectMain, selectSub } = useStoreUI();
  const [openId, setOpenId] = useState<string | null>(null);

  const categories = data?.categories ?? [];
  const mains = useMemo(() => categories.filter((c: any) => !c.parent_id), [categories]);
  const subsByParent = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const c of categories as any[]) {
      if (!c.parent_id) continue;
      if (!m.has(c.parent_id)) m.set(c.parent_id, []);
      m.get(c.parent_id)!.push(c);
    }
    return m;
  }, [categories]);

  function goMain(id: string) {
    selectMain(id, "icon");
    navigate({ to: "/store/$slug", params: { slug } });
  }

  function goSub(mainId: string, subId: string) {
    selectMain(mainId, "icon");
    selectSub(subId);
    navigate({ to: "/store/$slug", params: { slug } });
  }

  return (
    <div className="p-4">
      <h1 className="mb-4 text-xl font-bold text-sf-ink">{t("nav.categories")}</h1>

      {mains.length === 0 ? (
        <p className="text-sm text-sf-muted">—</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {mains.map((c: any) => {
            const subs = subsByParent.get(c.id) ?? [];
            const hasSubs = subs.length > 0;
            const open = openId === c.id;
            const PresetIcon = getCategoryIcon(c.icon_name);
            return (
              <div key={c.id} className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => (hasSubs ? setOpenId(open ? null : c.id) : goMain(c.id))}
                  className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-sf-line bg-white p-4 text-center shadow-sm transition-all hover:shadow-md"
                >
                  <span className="grid h-16 w-16 place-items-center">
                    {PresetIcon ? (
                      <CategoryIconCluster
                        iconName={c.icon_name}
                        iconStyle={c.icon_style ?? "outline"}
                      />
                    ) : c.image_url ? (
                      <img
                        src={c.image_url}
                        alt={c.name}
                        loading="lazy"
                        className="h-16 w-16 rounded-xl object-cover"
                      />
                    ) : (
                      <span className="grid h-16 w-16 place-items-center rounded-xl bg-sf-accent-soft text-lg font-bold text-sf-accent">
                        {c.name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span className="line-clamp-2 text-xs font-semibold text-sf-ink">{c.name}</span>
                  {hasSubs && (
                    <ChevronDown
                      className={`h-4 w-4 text-sf-muted transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  )}
                </button>

                {hasSubs && open && (
                  <div className="flex flex-wrap gap-1.5 rounded-2xl border border-sf-line bg-white p-2">
                    <button
                      type="button"
                      onClick={() => goMain(c.id)}
                      className="rounded-full bg-sf-accent px-3 py-1 text-[11px] font-semibold text-white"
                    >
                      {t("home.categoryAll")}
                    </button>
                    {subs.map((s: any) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => goSub(c.id, s.id)}
                        className="rounded-full border border-sf-line px-3 py-1 text-[11px] font-medium text-sf-muted hover:text-sf-accent"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
