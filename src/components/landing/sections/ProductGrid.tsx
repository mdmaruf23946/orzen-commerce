// Product cards for Recommended / Related / Recently Viewed sections.
// Products come from the store catalogue and open on the storefront.
import { lpImage } from "@/lib/landing-builder";

export type LandingProductCard = {
  id: string;
  name: string;
  price: number;
  old_price: number | null;
  primary_image_url: string | null;
};

function money(n: number) {
  return `৳${Number(n || 0).toLocaleString("en-US")}`;
}

export function ProductGrid({
  title, products, storeUrl,
}: {
  title: string;
  products: LandingProductCard[];
  storeUrl: string;
}) {
  if (!products.length) return null;

  return (
    <section className="px-4 py-12">
      <div className="mx-auto max-w-5xl">
        {title && <h2 className="text-center text-2xl font-bold">{title}</h2>}
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {products.map((p) => (
            <a
              key={p.id}
              href={`${storeUrl}/product/${p.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group block overflow-hidden bg-white ring-1 ring-neutral-200 transition-shadow hover:shadow-lg lp-round"
            >
              <div className="aspect-square w-full overflow-hidden bg-neutral-100">
                {p.primary_image_url && (
                  <img
                    src={lpImage(p.primary_image_url)}
                    alt={p.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                )}
              </div>
              <div className="space-y-1 p-3">
                <div className="line-clamp-2 text-sm font-medium text-neutral-800">{p.name}</div>
                <div className="flex items-baseline gap-2">
                  <span className="font-bold lp-primary-text">{money(p.price)}</span>
                  {p.old_price != null && Number(p.old_price) > Number(p.price) && (
                    <span className="text-xs text-neutral-400 line-through">{money(Number(p.old_price))}</span>
                  )}
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
