import { ProductCard } from "@/components/storefront/ProductCard";

type Product = {
  id: string;
  name: string;
  price: number | string;
  old_price: number | string | null;
  stock: number;
  primary_image_url: string | null;
};

export function RelatedRail({
  title,
  slug,
  products,
  variant = "grid",
}: {
  title: string;
  slug: string;
  products: Product[];
  variant?: "grid" | "scroll";
}) {
  if (!products || products.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {variant === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {products.map((p) => (
            <ProductCard key={p.id} slug={slug} p={p} />
          ))}
        </div>
      ) : (
        <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
          {products.map((p) => (
            <div key={p.id} className="w-40 shrink-0 snap-start sm:w-48">
              <ProductCard slug={slug} p={p} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
